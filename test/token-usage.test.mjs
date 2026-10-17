import test from "node:test";
import assert from "node:assert/strict";

import { SwarmClient } from "../src/index.js";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

test("SwarmClient records and reads token usage telemetry", async () => {
  const requests = [];
  const responses = [
    jsonResponse({ id: "tok_1", total_tokens: 170 }, { status: 201 }),
    jsonResponse([], { headers: { "X-Next-Cursor": "", "X-Order": "desc" } }),
    jsonResponse([{ total_tokens: 170 }]),
    jsonResponse({ traces: [{ id: "aat_1", action_descriptor_key: "trace.action.tool_call" }], last_sequence: 0, last_event_hash: "a".repeat(64), replay_count: 0 }, { status: 201 }),
    jsonResponse([], { headers: { "X-Next-Cursor": "", "X-Order": "desc" } }),
    jsonResponse({ trace: { id: "aat_1", action_descriptor_key: "trace.action.tool_call" }, links: [] }),
    jsonResponse({
      space_id: "ws_1",
      trace_sample_count: 1,
      token_usage: {
        input_tokens: 120,
        output_tokens: 45,
        cached_input_tokens: 0,
        reasoning_tokens: 5,
        total_tokens: 170,
        event_count: 1,
        saturated: false,
        breakdowns: [{
          key: "runtime_attested",
          label: "Runtime attested",
          evidence_class: "runtime_attested",
          input_tokens: 120,
          output_tokens: 45,
          cached_input_tokens: 0,
          reasoning_tokens: 5,
          total_tokens: 170,
          event_count: 1,
          saturated: false
        }]
      }
    })
  ];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "runtime-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return responses.shift();
    }
  });

  const created = await client.createTokenUsageEvent({
    space_id: "ws_1",
    run_id: "run_1",
    source_resource_type: "run",
    source_resource_id: "run_1",
    operation: "connector.run",
    count_source: "provider_reported",
    input_tokens: 120,
    output_tokens: 45,
    reasoning_tokens: 5
  });
  const events = await client.listTokenUsageEvents({ space_id: "ws_1", limit: 10 });
  const rollups = await client.listTokenUsageRollups({ space_id: "ws_1", bucket: "day" });
  const traceBatch = await client.appendAgentActionTraceBatch("ws_1", {
    trace_root_id: "trace_root_1",
    events: [{
      sequence: 0,
      action_descriptor_key: "trace.action.tool_call",
      operation_key: "filesystem.read",
      status: "succeeded",
      tool_descriptor_key: "trace.tool.filesystem.read",
      tool_descriptor_hash: "b".repeat(64),
      started_at: "2026-08-25T00:00:00Z"
    }]
  });
  const traces = await client.listAgentActionTraces({ space_id: "ws_1", action_descriptor_key: "trace.action.tool_call" });
  const loadedTrace = await client.getAgentActionTrace("aat_1");
  const actionIntelligence = await client.getSpaceActionIntelligence("ws_1", { trace_limit: 50 });

  assert.equal(created.id, "tok_1");
  assert.equal(events.items.length, 0);
  assert.equal(rollups[0].total_tokens, 170);
  assert.equal(traceBatch.traces[0].id, "aat_1");
  assert.equal(traces.items.length, 0);
  assert.equal(loadedTrace.trace.action_descriptor_key, "trace.action.tool_call");
  assert.equal(actionIntelligence.token_usage.total_tokens, 170);
  assert.equal(actionIntelligence.token_usage.saturated, false);
  assert.equal(actionIntelligence.token_usage.breakdowns[0].evidence_class, "runtime_attested");
  assert.equal(actionIntelligence.token_usage.breakdowns[0].saturated, false);
  assert.match(requests[0].url, /\/v1\/token-usage-events$/);
  assert.equal(JSON.parse(requests[0].init.body).source_resource_type, "run");
  assert.match(requests[1].url, /\/v1\/token-usage-events\?space_id=ws_1&limit=10$/);
  assert.match(requests[2].url, /\/v1\/token-usage-rollups\?space_id=ws_1&bucket=day$/);
  assert.match(requests[3].url, /\/v1\/spaces\/ws_1\/agent-action-traces\/batches$/);
  assert.equal(JSON.parse(requests[3].init.body).events[0].operation_key, "filesystem.read");
  assert.match(requests[4].url, /\/v1\/agent-action-traces\?space_id=ws_1&action_descriptor_key=trace.action.tool_call$/);
  assert.match(requests[5].url, /\/v1\/agent-action-traces\/aat_1$/);
  assert.match(requests[6].url, /\/v1\/spaces\/ws_1\/action-intelligence\?trace_limit=50$/);
});

test("SwarmClient publishes one replay-safe client checkpoint", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "runtime-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        artifact: { id: "art_checkpoint", kind: "checkpoint.decision" },
        trace: { id: "aat_checkpoint", action_descriptor_key: "trace.action.checkpoint" },
        links: [],
        replayed: false
      }, { status: 201 });
    }
  });

  const result = await client.publishAgentCheckpoint("ws_1", {
    checkpoint_kind_key: "checkpoint.kind.decision",
    title: "Durable decision",
    body_text: "Use the canonical execution path.",
    sources: [{ resource_type_key: "artifact", resource_id: "art_source" }]
  }, { idempotencyKey: "checkpoint-sdk-1" });

  assert.equal(result.artifact.id, "art_checkpoint");
  assert.match(requests[0].url, /\/v1\/spaces\/ws_1\/checkpoints$/);
  assert.equal(requests[0].init.headers.get("Idempotency-Key"), "checkpoint-sdk-1");
  assert.equal(JSON.parse(requests[0].init.body).sources[0].resource_id, "art_source");
});
