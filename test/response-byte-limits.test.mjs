import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient, SwarmResponseLimitError } from "../src/index.js";

function streamed(parts, status = 200, headers = {}) {
  let index = 0;
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) {
      if (index === parts.length) controller.close();
      else controller.enqueue(new TextEncoder().encode(parts[index++]));
    },
    cancel() { cancelled = true; }
  }), { status, headers: { "content-type": "text/plain", ...headers } });
  return { response, cancelled: () => cancelled };
}

for (const status of [200, 503]) {
  test(`response byte limit cancels oversized ${status} bodies without exposing content`, async () => {
    const f = streamed(["API_KEY=synthetic_secret_123456789", "x".repeat(80), "never_needed"], status);
    const client = new SwarmClient({ baseUrl: "https://audit.example", maxResponseBytes: 64, maxErrorResponseBytes: 64, fetch: async () => f.response });
    await assert.rejects(client.get("v1/test"), error => error instanceof SwarmResponseLimitError && error.status === status && error.maxBytes === 64 && !error.message.includes("synthetic_secret"));
    assert.equal(f.cancelled(), true);
    assert.equal(f.response.body.locked, false);
  });
}

test("limits encoded bytes rather than character count", async () => {
  const client = new SwarmClient({ baseUrl: "https://audit.example", maxResponseBytes: 5, fetch: async () => new Response("\u00e9\u00e9\u00e9") });
  await assert.rejects(client.get("v1/test"), SwarmResponseLimitError);
});

test("default limits preserve multi-megabyte outputs and endpoint overrides", async () => {
  const body = "x".repeat(2 * 1024 * 1024);
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => new Response(body) });
  assert.equal((await client.get("v1/artifacts/a/content")).length, body.length);
  await assert.rejects(client.get("v1/test", { maxResponseBytes: 64 }), SwarmResponseLimitError);
  assert.equal((await client.get("v1/test", { maxResponseBytes: body.length })).length, body.length);
});

test("default ceiling preserves the encoded form of an 8 MiB Core output", async () => {
  const body = "\u0001".repeat(8 * 1024 * 1024);
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => Response.json({ body }) });
  assert.equal((await client.get("v1/artifacts/output/content")).body.length, body.length);
});

test("oversized declared length cancels before buffering", async () => {
  const f = streamed(["tiny"], 200, { "content-length": "1000" });
  const client = new SwarmClient({ baseUrl: "https://audit.example", maxResponseBytes: 64, fetch: async () => f.response });
  await assert.rejects(client.get("v1/test"), SwarmResponseLimitError);
  assert.equal(f.cancelled(), true);
});

test("invalid limits fail before invoking the transport", async () => {
  let calls = 0;
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => { calls++; return Response.json({}); } });
  for (const maxResponseBytes of [0, -1, NaN, Infinity, 1.5]) {
    await assert.rejects(client.get("v1/test", { maxResponseBytes }), /positive safe integer/);
    assert.throws(() => new SwarmClient({ baseUrl: "https://audit.example", maxErrorResponseBytes: maxResponseBytes }), /positive safe integer/);
  }
  assert.equal(calls, 0);
});

test("malformed JSON diagnostics never repeat response secrets", async () => {
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => new Response('{"API_KEY":"synthetic_secret_123456789"', { headers: { "content-type": "application/json" } }) });
  await assert.rejects(client.get("v1/test"), error => error.message === "Swarm response contains invalid JSON" && !error.cause);
});
