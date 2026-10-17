import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import { SwarmClient, SwarmStreamError } from "../src/index.js";

function fixture(options = {}) {
  let signal;
  let closed = false;
  const client = new SwarmClient({ baseUrl: "https://audit.example", ...options, fetch: async (_url, init) => {
    signal = init.signal;
    return new Response(new ReadableStream({ cancel() { closed = true; } }), { headers: { "content-type": "text/event-stream" } });
  } });
  return { client, signal: () => signal, closed: () => closed };
}

test("raw response keeps fetch cancellation attached after headers", async () => {
  const parent = new AbortController(), reason = new Error("caller cancelled after headers");
  const f = fixture();
  const response = await f.client.request("GET", "v1/test", { raw: true, signal: parent.signal });
  const read = response.body.getReader().read();
  parent.abort(reason);
  await assert.rejects(read, error => error === reason);
  assert.equal(f.signal().aborted, true);
  assert.equal(f.closed(), true);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
});

test("EOF and explicit cancellation detach the parent once", async () => {
  for (const finish of ["eof", "cancel"]) {
    const parent = new AbortController();
    const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => new Response("complete") });
    const response = await client.request("GET", "v1/test", { raw: true, signal: parent.signal });
    if (finish === "eof") assert.equal(await response.text(), "complete");
    else await response.body.cancel();
    assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  }
});

test("metadata-only custom responses preserve identity and release cancellation", async () => {
  const parent = new AbortController();
  const metadata = { ok: true, status: 204, headers: new Headers(), body: null, url: "https://audit.example/v1/test" };
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => metadata });
  assert.equal(await client.request("GET", "v1/test", { raw: true, signal: parent.signal }), metadata);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
});

for (const timeout of ["streamIdleTimeoutMs", "streamTotalTimeoutMs"]) {
  test(`${timeout} bounds stalled streams without retaining listeners`, async () => {
    const parent = new AbortController();
    const f = fixture({ [timeout]: 10 });
    const response = await f.client.request("GET", "v1/test", { raw: true, signal: parent.signal });
    await assert.rejects(response.body.getReader().read(), /Swarm stream .* timeout/);
    assert.equal(f.signal().aborted, true);
    assert.equal(f.closed(), true);
    assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  });
}

test("invalid stream timeouts fail before requesting", async () => {
  const f = fixture();
  for (const value of [-1, Infinity, 1.5, 2147483648]) {
    await assert.rejects(f.client.request("GET", "v1/test", { raw: true, streamIdleTimeoutMs: value }), /integer between/);
  }
});

for (const kind of ["audit", "runtime"]) {
  test(`${kind} cancellation during a pending callback does not advance its applied cursor`, async () => {
    const parent = new AbortController();
    let started;
    let finishCallback;
    let cancelled = false;
    const entered = new Promise(resolve => { started = resolve; });
    const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(`id: next\nevent: ${kind === "audit" ? "audit_event" : "runtime_hint"}\ndata: {}\n\n`)); },
      cancel() { cancelled = true; }
    })) });
    const callback = () => { started(); return new Promise(resolve => { finishCallback = resolve; }); };
    const options = { strict: true, lastEventId: "applied", signal: parent.signal };
    const running = kind === "audit" ? client.streamAuditEvents({}, callback, options) : client.streamRuntimeHints("agent", callback, options);
    await entered;
    parent.abort(new Error("caller stopped applying"));
    await assert.rejects(running, error => error instanceof SwarmStreamError && error.code === "stream_cancelled" && error.lastEventId === "applied" && error.lastReceivedEventId === "next");
    finishCallback();
    assert.equal(cancelled, true);
    assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  });
}

test("total deadline also bounds a pending application callback", async () => {
  const client = new SwarmClient({ baseUrl: "https://audit.example", streamTotalTimeoutMs: 10,
    fetch: async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('id: next\nevent: audit_event\ndata: {}\n\n'));
    } })) });
  await assert.rejects(client.streamAuditEvents({}, () => new Promise(() => {}), { strict: true, lastEventId: "prior" }),
    error => error instanceof SwarmStreamError && error.code === "stream_cancelled" && error.lastEventId === "prior");
});
