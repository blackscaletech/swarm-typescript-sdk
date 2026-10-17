import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

async function withinDeadline(operation) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("deadline was not enforced")), 500); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test("credentialed requests reject other origins before invoking transport", async () => {
  let calls = 0;
  const client = new SwarmClient({ baseUrl: "https://swarm.example/api/", token: "test-token", fetch: async () => {
    calls += 1;
    return Response.json({ ok: true });
  } });
  for (const path of ["https://other.example/v1/spaces", "http://swarm.example/v1/spaces", "https://swarm.example:444/v1/spaces", "https://user:password@swarm.example/v1/spaces"]) {
    await assert.rejects(client.get(path), /origin|credentials/);
  }
  assert.equal(calls, 0);
});

test("relative and same-origin absolute requests retain auth and query behavior", async () => {
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example/api/", token: "test-token", fetch: async (url, init) => {
    requests.push({ url: String(url), auth: init.headers.get("authorization") });
    return Response.json({ ok: true });
  } });
  await client.get("/v1/spaces", { query: { limit: 1 } });
  await client.get("https://SWARM.example:443/v1/spaces");
  assert.deepEqual(requests, [
    { url: "https://swarm.example/api/v1/spaces?limit=1", auth: "Bearer test-token" },
    { url: "https://swarm.example/v1/spaces", auth: "Bearer test-token" }
  ]);
});

test("insecure override never permits non-HTTP or credential-bearing servers", () => {
  for (const baseUrl of ["file:///tmp/swarm", "ftp://swarm.example", "https://user:password@swarm.example"]) {
    assert.throws(() => new SwarmClient({ baseUrl, allowInsecureTransport: true }), /HTTP|credentials/);
  }
});

for (const raw of [false, true]) {
  test(`deadline covers stalled ${raw ? "error" : "successful"} response bodies`, async () => {
    let cancelled = false;
    let signal;
    const client = new SwarmClient({ baseUrl: "https://swarm.example", timeoutMs: 20, fetch: async (_url, init) => {
      signal = init.signal;
      return {
        status: raw ? 403 : 200, ok: !raw, headers: new Headers({ "content-type": "application/json" }),
        text: () => new Promise(() => {}),
        body: { cancel: () => { cancelled = true; return new Promise(() => {}); } }
      };
    } });
    await assert.rejects(withinDeadline(client.request("GET", "v1/spaces", { raw })), /Swarm request timed out/);
    assert.equal(signal.aborted, true);
    assert.equal(cancelled, true);
  });
}

test("parent cancellation remains attached while decoding response body", async () => {
  const parent = new AbortController();
  const reason = new Error("caller stopped waiting");
  let bodyStarted;
  const started = new Promise(resolve => { bodyStarted = resolve; });
  const client = new SwarmClient({ baseUrl: "https://swarm.example", timeoutMs: 1000, fetch: async () => ({
    status: 200, ok: true, headers: new Headers(), body: { cancel: async () => {} },
    text: () => { bodyStarted(); return new Promise(() => {}); }
  }) });
  const request = client.get("v1/spaces", { signal: parent.signal });
  await started;
  parent.abort(reason);
  await assert.rejects(withinDeadline(request), error => error === reason);
});

test("pre-aborted requests never invoke transport", async () => {
  const parent = new AbortController();
  parent.abort(new Error("cancelled before request"));
  let calls = 0;
  const client = new SwarmClient({ baseUrl: "https://swarm.example", fetch: async () => {
    calls += 1;
    return Response.json({});
  } });
  await assert.rejects(client.get("v1/spaces", { signal: parent.signal }), /cancelled before request/);
  assert.equal(calls, 0);
});

test("raw successful responses keep caller-owned streaming lifetime", async () => {
  const response = new Response("event: ready\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
  const client = new SwarmClient({ baseUrl: "https://swarm.example", timeoutMs: 20, fetch: async () => response });
  const owned = await client.request("GET", "v1/events", { raw: true });
  assert.equal(owned.status, response.status);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(owned.bodyUsed, false);
  assert.equal(await owned.text(), "event: ready\ndata: {}\n\n");
});

test("uncooperative fetch still times out and a late response is cancelled", async () => {
  let deliver;
  let cancelled = false;
  const client = new SwarmClient({ baseUrl: "https://swarm.example", timeoutMs: 20, fetch: () => new Promise(resolve => { deliver = resolve; }) });
  await assert.rejects(withinDeadline(client.get("v1/spaces")), /Swarm request timed out/);
  deliver({ body: { cancel: async () => { cancelled = true; } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, true);
});

test("late body rejection after timeout is handled", async () => {
  let rejectBody;
  const client = new SwarmClient({ baseUrl: "https://swarm.example", timeoutMs: 20, fetch: async () => ({
    status: 200, ok: true, headers: new Headers(), body: { cancel: async () => {} },
    text: () => new Promise((_resolve, reject) => { rejectBody = reject; })
  }) });
  await assert.rejects(withinDeadline(client.get("v1/spaces")), /Swarm request timed out/);
  rejectBody(new Error("late transport failure"));
  await new Promise(resolve => setImmediate(resolve));
});
