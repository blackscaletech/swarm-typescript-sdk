import test from "node:test";
import assert from "node:assert/strict";
import { SwarmClient } from "../src/index.js";

test("learning completion preserves generation without an agent override", async () => {
  let request;
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "lq", claim_generation: request.claim_generation }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  });
  await client.completeSpaceLearningQueueItem("sp", "lq", { claim_generation: "9223372036854775807" });
  assert.deepEqual(request, { claim_generation: "9223372036854775807" });
});
