import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

test("new queue/acquisition attempts get fresh keys while retries and durable commands remain stable", async () => {
  for (const baseUrl of ["https://audit.example", "https://audit.example/api/"]) {
    const keys = [];
    const client = new SwarmClient({ baseUrl, fetch: async (_url, init) => {
      keys.push(init.headers.get("Idempotency-Key"));
      return Response.json({});
    } });
    for (const path of ["/v1/spaces/s/runs:claim-next", "/v1/runs/r/acquire", "/v1/spaces/s/learning-queue/claim"]) {
      await client.post(path, { ttl_seconds: 300 });
      await client.post(path, { ttl_seconds: 300 });
      assert.notEqual(keys.at(-1), keys.at(-2));
      await client.post(path, {}, { idempotencyKey: "same-uncertain-attempt" });
      await client.post(path, {}, { idempotencyKey: "same-uncertain-attempt" });
      assert.equal(keys.at(-1), keys.at(-2));
    }
    await client.post("/v1/artifacts", { body: "durable note" });
    await client.post("/v1/artifacts", { body: "durable note" });
    assert.equal(keys.at(-1), keys.at(-2));
  }
});

test("durable raw mutation identity preserves evidence bytes and canonical JSON meaning", async () => {
  const keys = [];
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async (_url, init) => {
    keys.push(init.headers.get("Idempotency-Key"));
    return Response.json({});
  } });
  for (const body of ["Evidence", " Evidence", "Evidence "]) await client.createArtifact({ space_id: "sp_test", body });
  assert.equal(new Set(keys).size, 3);
  await client.createArtifact({ body: "Evidence", space_id: "sp_test", optional: undefined });
  assert.equal(keys.at(-1), keys[0]);
  await client.createArtifact({ space_id: "sp_test", body: "Evidence" }, { idempotencyKey: "old-client-uncertain-key" });
  assert.equal(keys.at(-1), "old-client-uncertain-key");
  assert.ok(keys[0].startsWith("swarm-sdk-v2-"));
});
