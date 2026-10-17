import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { SwarmClient, SwarmStreamError } from "../src/index.js";

function fixture(chunks, close = true) {
  let cancelled = false;
  let body;
  const requests = [];
  const client = new SwarmClient({baseUrl: "https://swarm.example", fetch: async (url, options) => {
    requests.push({url, options});
    body = new ReadableStream({start(controller) { for (const chunk of chunks) controller.enqueue(chunk); if (close) controller.close(); }, cancel() { cancelled = true; }});
    return new Response(body, {headers: {"content-type": "text/event-stream"}});
  }});
  return {client, requests, cancelled: () => cancelled, locked: () => body.locked};
}

test("SDK stream entrypoint preserves split CRLF, UTF-8, whitespace and inherited/reset IDs", async () => {
  const bytes = new TextEncoder().encode("\ufeffid: a\r\nevent: message\r\ndata:  alpha\t \r\ndata:\r\n\r\n: comment\r\n\r\ndata: \u03b2\r\rid:\ndata: reset\n\nid: bad\u0000id\ndata: unchanged\n\nid: incomplete\ndata: discarded");
  for (let split = 0; split <= bytes.length; split++) {
    const {client} = fixture([bytes.slice(0, split), bytes.slice(split)]);
    const events = [];
    const id = await client.streamAuditEvents({}, (data, meta) => events.push({data, id: meta.id}));
    assert.deepEqual(events, [{data: " alpha\t \n", id: "a"}, {data: "\u03b2", id: "a"}, {data: "reset", id: ""}, {data: "unchanged", id: ""}], `split ${split}`);
    assert.equal(id, "");
  }
});

test("SDK cancels and releases its reader when the application callback fails", async () => {
  const stream = fixture([new TextEncoder().encode("id: a\ndata: value\n\n")], false);
  const failure = new Error("apply failed");
  await assert.rejects(stream.client.streamAuditEvents({}, () => { throw failure; }), error => error === failure);
  assert.equal(stream.cancelled(), true);
  assert.equal(stream.locked(), false);
});

test("SDK drops an oversized frame through its delimiter rather than delivering its tail", async () => {
  const encoder = new TextEncoder();
  const stream = fixture([encoder.encode("id: dropped\ndata: " + "x".repeat(400)), encoder.encode('\ndata: {"tail":true}\n\nid: good\nevent: audit_event\ndata: {"ok":true}\n\n')]);
  const events = [];
  await stream.client.streamAuditEvents({}, (data) => events.push(data), {sseMaxEventBytes: 120, sseMaxBufferBytes: 80});
  assert.deepEqual(events, [{ok: true}]);
});

for (const kind of ["audit_event", "runtime_hint"]) {
  const call = (stream, callback, options) => kind === "audit_event"
    ? stream.client.streamAuditEvents({}, callback, options)
    : stream.client.streamRuntimeHints("agent", callback, options);
  for (const failure of ["invalid_json", "callback_failed", "truncated_frame", "invalid_utf8", "event_too_large", "buffer_limit_exceeded"]) {
    test(`${kind} strict ${failure} retains applied cursor and stops before later events`, async () => {
      const encoder = new TextEncoder();
      let bad = `id: b\nevent: ${kind}\ndata: `;
      if (failure === "invalid_json") bad += "{bad}\n\n";
      else if (failure === "truncated_frame") bad += '{"n":2}';
      else if (failure.endsWith("exceeded") || failure === "event_too_large") bad += "x".repeat(250) + "\n\n";
      else bad += '{"n":2}\n\n';
      const chunks = [encoder.encode(`id: a\nevent: ${kind}\ndata: {"n":1}\n\n`)];
      if (failure === "invalid_utf8") chunks.push(new Uint8Array([0xff]));
      else chunks.push(encoder.encode(bad));
      if (failure !== "truncated_frame") chunks.push(encoder.encode(`id: c\nevent: ${kind}\ndata: {"n":3}\n\n`));
      const stream = fixture(chunks);
      const seen = [];
      let stopped;
      const options = {strict: true, lastEventId: "prior"};
      if (failure === "event_too_large") options.sseMaxEventBytes = 80;
      if (failure === "buffer_limit_exceeded") options.sseMaxBufferBytes = 80;
      await assert.rejects(call(stream, (data) => {
        if (failure === "callback_failed" && data.n === 2) throw new Error("not committed");
        seen.push(data.n);
      }, options), error => {
        stopped = error;
        return error instanceof SwarmStreamError && error.code === failure && error.lastEventId === "a";
      });
      assert.deepEqual(seen, [1]);
      assert.equal(stream.locked(), false);
      const retry = fixture([encoder.encode(`id: b\nevent: ${kind}\ndata: {"n":2}\n\n`)]);
      const id = await call(retry, data => seen.push(data.n), {strict: true, lastEventId: stopped.lastEventId});
      assert.equal(new Headers(retry.requests[0].options.headers).get("Last-Event-ID"), "a");
      assert.equal(new URL(retry.requests[0].url).searchParams.has("strict"), false);
      assert.deepEqual(seen, [1, 2]);
      assert.equal(id, "b");
    });
  }
}

test("ID-only frames are inherited but never falsely acknowledged in strict mode", async () => {
  const encoder = new TextEncoder();
  const stream = fixture([encoder.encode("id: future\n\n: heartbeat\n\n")]);
  assert.equal(await stream.client.streamAuditEvents({}, () => assert.fail("no data"), {strict: true, lastEventId: "applied"}), "applied");
  const reset = fixture([encoder.encode("id:\ndata: reset\n\n")]);
  assert.equal(await reset.client.streamAuditEvents({}, (_, meta) => assert.equal(meta.id, ""), {strict: true, lastEventId: "applied"}), "");
});

test("empty JSON events are reported instead of silently treated as successful payloads", async () => {
  const stream = fixture([new TextEncoder().encode("id: bad\nevent: audit_event\ndata:\n\n")]);
  const errors = [];
  const cursor = await stream.client.streamAuditEvents({}, () => assert.fail("invalid JSON"), {lastEventId: "prior", onStreamError: error => errors.push(error)});
  assert.equal(cursor, "bad");
  assert.equal(errors[0].last_event_id, "prior");
  assert.equal(errors[0].last_received_event_id, "bad");
});

test("native HTTP transport dispatches before EOF and forwards the resume cursor", {timeout: 5000}, async (t) => {
  let release;
  let resumeHeader;
  const server = createServer((req, res) => {
    resumeHeader = req.headers["last-event-id"];
    res.writeHead(200, {"content-type": "text/event-stream"});
    release = () => res.end('id: b\nevent: audit_event\ndata: {"n":2}\n\n');
    res.write('id: a\r\nevent: audit_event\r\ndata: {"n":1}\r\n\r\n');
  });
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const client = new SwarmClient({baseUrl: `http://127.0.0.1:${server.address().port}`});
  const seen = [];
  const cursor = await client.streamAuditEvents({}, data => {
    seen.push(data.n);
    if (data.n === 1) release();
  }, {strict: true, lastEventId: "prior", signal: AbortSignal.timeout(3000)});
  assert.deepEqual(seen, [1, 2]);
  assert.equal(cursor, "b");
  assert.equal(resumeHeader, "prior");
});
