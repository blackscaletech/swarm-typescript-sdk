import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

test("agent execution uses canonical scoped routes and preserves lease, cursor and retry identity", async () => {
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", token: "synthetic",
    fetch: async (url, init) => {
      requests.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ id: "run_synthetic" }), { headers: { "Content-Type": "application/json" } });
    }
  });
  const options = { idempotencyKey: "explicit-retry-key" };
  const version = "2026-10-12T12:00:00.000001Z";
  const cases = [
    [() => client.launchRun("sp/1", { goal_summary: "Compare the sources", run_requirements: { execution_mode: "agent", assignment_mode: "others" }, run_context_refs: [{ resource_type: "artifact", resource_id: "art_1" }] }, options), "/v1/foundation/spaces/sp%2F1/runs:launch", { goal_summary: "Compare the sources", run_requirements: { execution_mode: "agent", assignment_mode: "others" }, run_context_refs: [{ resource_type: "artifact", resource_id: "art_1" }] }],
    [() => client.createRunGroup("sp/1", { primary_task_id: "task_1", goal_summary: "Review" }, options), "/v1/foundation/spaces/sp%2F1/run-groups", { primary_task_id: "task_1", goal_summary: "Review" }],
    [() => client.createGroupRun("rg/1", { goal_summary: "Verify the evidence", run_requirements: { execution_mode: "agent" } }, options), "/v1/foundation/run-groups/rg%2F1/runs", { goal_summary: "Verify the evidence", run_requirements: { execution_mode: "agent" } }],
    [() => client.pauseRunGroup("rg/1", options), "/v1/foundation/run-groups/rg%2F1:pause", {}],
    [() => client.resumeRunGroup("rg/1", options), "/v1/foundation/run-groups/rg%2F1:resume", {}],
    [() => client.cancelRunGroup("rg/1", options), "/v1/foundation/run-groups/rg%2F1:cancel", {}],
    [() => client.updateTask("task/1", { title: "Edited brief", description: "Exact evidence", expected_updated_at: version }, options), "/v1/tasks/task%2F1", { title: "Edited brief", description: "Exact evidence", expected_updated_at: version }],
    [() => client.cancelTask("task/1", { reason: "Replaced" }, options), "/v1/tasks/task%2F1/cancel", { reason: "Replaced" }],
    [() => client.launchTaskRun("task/1", { expected_task_updated_at: version }, options), "/v1/foundation/tasks/task%2F1/runs:launch", { expected_task_updated_at: version }],
    [() => client.acquireRun("run/1", { ttl_seconds: 120 }, options), "/v1/runs/run%2F1/acquire", { ttl_seconds: 120 }],
    [() => client.claimNextRun("sp/1", { cursor: "bounded-scan", ttl_seconds: 120 }, options), "/v1/spaces/sp%2F1/runs:claim-next", { cursor: "bounded-scan", ttl_seconds: 120 }],
    [() => client.declareExecutorCapabilities("sp/1", { tools: ["evidence.read"] }, options), "/v1/spaces/sp%2F1/executor-capabilities", { tools: ["evidence.read"] }],
    [() => client.startRun("run/1", { lease_id: "lease_1" }, options), "/v1/runs/run%2F1/start", { lease_id: "lease_1" }],
    [() => client.requestRunStop("run/1", { reason: "Replaced" }, options), "/v1/runs/run%2F1/stop", { reason: "Replaced" }],
    [() => client.completeRun("run/1", { lease_id: "lease_1", outcome: "failed", body: "Source unavailable" }, options), "/v1/runs/run%2F1/complete", { lease_id: "lease_1", outcome: "failed", body: "Source unavailable" }],
    [() => client.renewRunLease("lease/1", { ttl_seconds: 120 }, options), "/v1/run-leases/lease%2F1/renew", { ttl_seconds: 120 }],
    [() => client.releaseRunLease("lease/1", options), "/v1/run-leases/lease%2F1/release", {}],
    [() => client.launchTaskRun("task/1", { run_requirements: { assignment_mode: "self" } }, options), "/v1/foundation/tasks/task%2F1/runs:launch", { run_requirements: { assignment_mode: "self" } }],
    [() => client.spawnSubrun("run/1", { spawn_reason_key: "review", run_requirements: { execution_mode: "agent" } }, options), "/v1/foundation/runs/run%2F1/subruns", { spawn_reason_key: "review", run_requirements: { execution_mode: "agent" } }]
  ];
  for (const [invoke, path, body] of cases) {
    await invoke();
    const request = requests.at(-1);
    assert.equal(request.url, `https://swarm.example${path}`);
    assert.deepEqual(request.body, body);
    assert.equal(request.headers.get("Idempotency-Key"), options.idempotencyKey);
  }
});

test("freeform Run retry identity covers the goal and exact execution boundary", async () => {
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", fetch: async (url, init) => {
    requests.push({ url: String(url), key: init.headers.get("Idempotency-Key") });
    return Response.json({ id: "run_synthetic" });
  } });
  const input = { goal_summary: "Review the rollout", run_requirements: { execution_mode: "agent", assignment_mode: "self" } };
  await client.launchRun("sp_1", input);
  await client.launchRun("sp_1", input);
  await client.launchRun("sp_1", { ...input, goal_summary: "Review the pilot" });
  await client.launchRun("sp_1", { ...input, run_requirements: { ...input.run_requirements, assignment_mode: "any" } });
  assert.equal(requests[0].key, requests[1].key);
  assert.notEqual(requests[0].key, requests[2].key);
  assert.notEqual(requests[0].key, requests[3].key);
  assert.ok(requests.every(request => request.url.endsWith("/foundation/spaces/sp_1/runs:launch")));
});

test("Run reads and hosted launch keep identifiers inside their path segment", async () => {
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", fetch: async (url) => {
    requests.push(String(url));
    return Response.json({});
  } });
  await client.getRun("run/1?other=#fragment");
  await client.getRunContext("run/1?other=#fragment");
  await client.getRunLease("lease/1?other=#fragment");
  await client.launchSpaceRun("sp/1?other=#fragment", { title: "Review", description: "Verify the sources" });
  assert.deepEqual(requests, [
    "https://swarm.example/v1/runs/run%2F1%3Fother%3D%23fragment",
    "https://swarm.example/v1/runs/run%2F1%3Fother%3D%23fragment/context",
    "https://swarm.example/v1/run-leases/lease%2F1%3Fother%3D%23fragment",
    "https://swarm.example/v1/spaces/sp%2F1%3Fother%3D%23fragment/launch-run"
  ]);
});

test("execution identifiers cannot be normalized into a different URL route", async () => {
  const client = new SwarmClient({ baseUrl: "https://swarm.example", fetch: () => {
    assert.fail("invalid identifier reached the transport");
  } });
  for (const id of ["", ".", ".."]) {
    await assert.rejects(client.getRun(id), /identifier/);
    await assert.rejects(client.launchRun(id), /identifier/);
    await assert.rejects(client.createGroupRun(id), /identifier/);
  }
});
