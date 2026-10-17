import test from "node:test";
import assert from "node:assert/strict";

import { SwarmClient } from "../src/index.js";

function response(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("value-loop SDK reads use canonical bounded POST routes without mutation authority", async () => {
  const requests = [];
  const responses = [
    response({
      meta: { view_key: "handoff.preview", contract_version: "2026-06-22", generated_at: "2026-08-25T00:00:00Z", sensitivity_tags: [] },
      state_key: "ready", source_resource_ref: "artifact:art_1", source_revision: 4,
      markdown: "# Swarm handoff", citations: [{ resource_ref: "artifact:art_1", rank: 1 }]
    }),
    response({
      meta: { view_key: "context.plan", contract_version: "2026-06-22", generated_at: "2026-08-25T00:00:00Z", sensitivity_tags: [] },
      state_key: "ready", plan_revision: 4,
      included_refs: [{ resource_ref: "artifact:art_1", reason_key: "context.reason.explicit", estimated_tokens: 8 }],
      exclusion_aggregates: [], policy_summary: { token_budget: 4000, max_refs: 32, graph_depth: 1, model_call: false }
    })
  ];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "client-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return responses.shift();
    }
  });

  const handoff = await client.previewHandoff("sp_1", { source_resource_ref: "artifact:art_1" });
  const plan = await client.getContextPlan("sp_1", {
    composer_text: "Continue the work.", explicit_resource_refs: ["artifact:art_1"]
  });

  assert.equal(handoff.source_resource_ref, "artifact:art_1");
  assert.equal(plan.policy_summary.model_call, false);
  assert.match(requests[0].url, /\/v1\/spaces\/sp_1\/handoff-preview\/view$/);
  assert.match(requests[1].url, /\/v1\/spaces\/sp_1\/context-plan\/view$/);
  assert.equal(requests[0].init.headers.get("Idempotency-Key"), null);
  assert.equal(requests[1].init.headers.get("Idempotency-Key"), null);
});

test("request effects fail closed when verb or idempotency authority conflicts", async () => {
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async () => response({})
  });

  await assert.rejects(
    client.request("GET", "/v1/spaces", { effect: "mutation" }),
    /GET requests cannot declare mutation effect/
  );
  await assert.rejects(
    client.request("POST", "/v1/spaces/sp_1/context-plan/view", {
      body: {},
      effect: "read",
      idempotencyKey: "must-not-be-present"
    }),
    /Read requests cannot declare an idempotency key/
  );
});

test("learning correction SDK methods preserve caller idempotency and canonical routes", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "client-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return response({ candidate: { id: "lcand_next" } });
    }
  });

  await client.correctSpaceLearningCandidate(
    "sp_1",
    "lcand_1",
    { summary: "Corrected knowledge.", reason: "Reviewed against current evidence." },
    { idempotencyKey: "correct-learning-1" }
  );
  await client.supersedeSpaceLearningCandidate(
    "sp_1",
    "lcand_1",
    { reason_key: "learning.supersession.stale", reason: "The cited source is no longer current." },
    { idempotencyKey: "stale-learning-1" }
  );

  assert.match(requests[0].url, /\/v1\/spaces\/sp_1\/learning-candidates\/lcand_1\/corrections$/);
  assert.match(requests[1].url, /\/v1\/spaces\/sp_1\/learning-candidates\/lcand_1\/supersede$/);
  assert.equal(requests[0].init.headers.get("Idempotency-Key"), "correct-learning-1");
  assert.equal(requests[1].init.headers.get("Idempotency-Key"), "stale-learning-1");
});
