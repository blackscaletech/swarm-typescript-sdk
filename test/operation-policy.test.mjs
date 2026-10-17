import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";
import { CLIENT_OPERATION_POLICIES } from "../src/operation-policies.js";

test("every registered mutation preserves its declared key strategy across exact templates", async () => {
  const calls = [];
  const client = new SwarmClient({ baseUrl: "https://local.invalid/prefix/", fetch: async (url, init) => {
    calls.push({ url: String(url), key: init.headers.get("Idempotency-Key") }); return Response.json({});
  } });
  for (const [method, template, required, strategy] of CLIENT_OPERATION_POLICIES) {
    if (method === "GET") continue;
    const path = template.replace(/\{[^}]+\}/g, "CaseSensitive_ID");
    await client.request(method, path, { body: { evidence: " exact " } });
    await client.request(method, path, { body: { evidence: " exact " } });
    const [one, two] = calls.slice(-2);
    if (!required) assert.equal(one.key, null);
    else if (strategy === "fresh-attempt") assert.notEqual(one.key, two.key);
    else assert.equal(one.key, two.key);
    assert.equal(one.url, two.url);
  }
});
test("unknown operations fail before dispatch unless caller supplies explicit intent policy or retry key", async () => {
  const calls = [];
  const client = new SwarmClient({ baseUrl: "https://local.invalid", fetch: async (_, init) => {
    calls.push(init.headers.get("Idempotency-Key")); return Response.json({});
  } });
  for (const path of ["/v2/runs/id/acquire", "/v1/runs/id/acquire/extra", "/v1/runs/id/not-a-command"]) {
    await assert.rejects(client.post(path, {}), /explicit idempotency/);
  }
  assert.equal(calls.length, 0);
  await client.post("/v2/command", {}, { idempotencyPolicy: "fresh-attempt" });
  await client.post("/v2/command", {}, { idempotencyPolicy: "fresh-attempt" });
  assert.notEqual(calls[0], calls[1]);
  await client.post("/v2/command", {}, { idempotencyKey: "old-exact-retry" });
  await client.post("/v2/command", {}, { idempotencyKey: "old-exact-retry" });
  assert.equal(calls.at(-1), "old-exact-retry");
  await assert.rejects(client.post("/v1/runs/id/acquire", {}, { idempotencyPolicy: "durable-content" }), /conflicts/);
  await assert.rejects(client.post("/v2/command", {}, { idempotencyPolicy: "unknown" }), /Invalid/);
  await assert.rejects(client.post("/v1/runs/id/acquire", {}, { idempotencyKey: "caller-retry", idempotencyPolicy: "durable-content" }), /conflicts/);
});
test("wire query is part of durable command identity and literal action suffixes are not wildcards", async () => {
  const keys = [];
  const client = new SwarmClient({ baseUrl: "https://local.invalid", fetch: async (_, init) => {
    keys.push(init.headers.get("Idempotency-Key")); return Response.json({});
  } });
  await client.post("/v1/artifacts", {}, { query: { synthetic: "one" } });
  await client.post("/v1/artifacts", {}, { query: { synthetic: "two" } });
  assert.notEqual(keys[0], keys[1]);
  await assert.rejects(client.post("/v1/foundation/spaces/id/runs:invented", {}), /explicit/);
});
