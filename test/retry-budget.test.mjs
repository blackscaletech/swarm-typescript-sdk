import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import { SwarmClient, runAgentOnce } from "../src/index.js";

test("Retry-After cannot extend one operation's total retry budget", async () => {
  const parent = new AbortController();
  let calls = 0;
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => {
    calls++;
    return Response.json({ error: "Temporarily unavailable" }, { status: 503, headers: { "Retry-After": "3600" } });
  } });
  await assert.rejects(runAgentOnce(client, { spaceId: "sp_test", execute: () => assert.fail("unclaimed work executed"),
    retryBudgetMs: 10, signal: parent.signal }), /retry budget exceeded/);
  assert.equal(calls, 1);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
});

test("a header/body stall is bounded by the same retry budget", async () => {
  const parent = new AbortController();
  let cancelled = 0;
  const client = new SwarmClient({ baseUrl: "https://audit.example", timeoutMs: 30000, fetch: async () => new Response(new ReadableStream({
    cancel() { cancelled++; }
  }), { headers: { "content-type": "application/json" } }) });
  await assert.rejects(runAgentOnce(client, { spaceId: "sp_test", execute: () => assert.fail("unclaimed work executed"),
    retryBudgetMs: 10, signal: parent.signal }), /retry budget exceeded/);
  assert.equal(cancelled, 1);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
});

test("caller cancellation during backoff wins and is not retried", async () => {
  const parent = new AbortController(), reason = new Error("owner cancelled");
  let calls = 0;
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => {
    calls++;
    queueMicrotask(() => parent.abort(reason));
    return Response.json({ error: "Unavailable" }, { status: 503 });
  } });
  await assert.rejects(runAgentOnce(client, { spaceId: "sp_test", execute: () => assert.fail("unclaimed work executed"), signal: parent.signal }), error => error === reason);
  assert.equal(calls, 1);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
});
