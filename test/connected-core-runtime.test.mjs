import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildBootstrapCurrentUserEntityIdempotencyKey,
  computeWebhookSignature,
  buildConnectSpaceClientIdempotencyKey,
  buildConnectCurrentUserAndLaunchIdempotencyKey,
  buildConnectCurrentUserClientIdempotencyKey,
  buildBootstrapSpaceIdempotencyKey,
  buildLaunchRunIdempotencyKey,
  parseWebhookHeaders,
  SwarmClient,
  SwarmAPIError,
  computeConnectedCoreLoopDelayMs,
  executeConnectedCoreAcquisition,
  runConnectedCoreLoop,
  runConnectedCoreOnce,
  verifyWebhookSignature
} from "../src/index.js";

test("runConnectedCoreOnce executes the canonical credential-bound lifecycle", async () => {
  const requests = [];
  let executionCalls = 0;
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      requests.push({
        path,
        method: init.method,
        headers: Object.fromEntries(init.headers.entries()),
        body: init.body ? JSON.parse(init.body) : null
      });
      if (path === "/v1/core-runner/heartbeat") {
        return jsonResponse({
          core: { id: "core_1", entity_id: "ent_1", space_id: "ws_1" },
          dispatchable: true,
          status: "ready",
          reason: ""
        });
      }
      if (path === "/v1/core-runner/runs/claim-next") {
        return jsonResponse({
          run: {
            id: "run_1",
            entity_id: "ent_1",
            space_id: "ws_1",
            run_group_id: "rg_1",
            status: "leased"
          },
          run_lease: {
            id: "lease_1",
            run_id: "run_1",
            core_id: "core_1",
            leased_by_identity_id: "idn_1",
            status: "active",
            issued_at: "2026-03-11T00:00:00Z",
            renewed_at: "2026-03-11T00:00:00Z",
            expires_at: "2026-03-11T00:01:00Z"
          }
        }, 201);
      }
      if (path === "/v1/core-runs/run_1/leases/lease_1/start") {
        return jsonResponse({ id: "run_1", status: "running" });
      }
      if (path === "/v1/core-runs/run_1/leases/lease_1/renew") {
        return jsonResponse({
          id: "lease_1",
          run_id: "run_1",
          core_id: "core_1",
          leased_by_identity_id: "idn_1",
          status: "active",
          issued_at: "2026-03-11T00:00:00Z",
          renewed_at: "2026-03-11T00:00:01Z",
          expires_at: "2026-03-11T00:01:01Z"
        });
      }
      if (path === "/v1/core-runs/run_1/leases/lease_1/execute") {
        return jsonResponse({
          run: { id: "run_1", status: "succeeded" },
          model_call: { id: "mcall_1", status: "succeeded" },
          artifact: { id: "art_1", sha256: "abc" },
          publication: { entry: { id: "entry_1", entry_descriptor_key: "thread_card.run.result" } },
          usage: []
        });
      }
      throw new Error(`unexpected request ${init.method} ${path}`);
    }
  });

  const result = await runConnectedCoreOnce(client, {
    ttlSeconds: 60,
    onExecution: (execution) => {
      executionCalls += 1;
      assert.equal(execution.artifact.id, "art_1");
    }
  });

  assert.equal(result.run.status, "succeeded");
  assert.equal(result.execution.model_call.status, "succeeded");
  assert.equal(result.runLease.renewed_at, "2026-03-11T00:00:01Z");
  assert.equal(executionCalls, 1);
  assert.deepEqual(
    requests.map((request) => request.path),
    [
      "/v1/core-runner/heartbeat",
      "/v1/core-runner/runs/claim-next",
      "/v1/core-runs/run_1/leases/lease_1/start",
      "/v1/core-runs/run_1/leases/lease_1/renew",
      "/v1/core-runs/run_1/leases/lease_1/execute"
    ]
  );
  assert.equal(requests[1].body.ttl_seconds, 60);
  assert.equal(requests[3].body.ttl_seconds, 60);
  for (const request of requests) {
    assert.ok(request.headers["idempotency-key"]);
  }
});

test("runConnectedCoreLoop waits when no assigned run is available", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      requests.push({ path, method: init.method });
      if (path === "/v1/core-runner/heartbeat") {
        return jsonResponse({
          core: { id: "core_1", entity_id: "ent_1", space_id: "ws_1" },
          dispatchable: true,
          status: "ready",
          reason: ""
        });
      }
      if (path === "/v1/core-runner/runs/claim-next") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${init.method} ${path}`);
    }
  });

  let idleCalls = 0;
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("stop")), 15);

  await assert.rejects(
    () =>
      runConnectedCoreLoop(client, {
        ttlSeconds: 30,
        pollIntervalMs: 250,
        signal: controller.signal,
        onIdle: () => {
          idleCalls += 1;
        }
      }),
    /stop/
  );

  assert.equal(idleCalls, 1);
  assert.deepEqual(
    requests.map((request) => request.path),
    ["/v1/core-runner/heartbeat", "/v1/core-runner/runs/claim-next"]
  );
});

test("executeConnectedCoreAcquisition preserves ambiguous issued work for canonical reconciliation", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      requests.push(path);
      if (path.endsWith("/start")) {
        return jsonResponse({ id: "run_1", status: "running" });
      }
      if (path.endsWith("/renew")) {
        return jsonResponse({
          id: "lease_1",
          run_id: "run_1",
          core_id: "core_1",
          leased_by_identity_id: "idn_1",
          status: "active"
        });
      }
      if (path.endsWith("/execute")) {
        return jsonResponse({ error: "unavailable" }, 503);
      }
      if (path.endsWith("/complete")) {
        return jsonResponse({ error: "unavailable" }, 503);
      }
      if (path.endsWith("/release")) {
        return jsonResponse({ id: "lease_1", status: "released" });
      }
      throw new Error(`unexpected request ${init.method} ${path}`);
    }
  });

  await assert.rejects(
    () =>
      executeConnectedCoreAcquisition(
        client,
        {
          run: { id: "run_1", space_id: "ws_1" },
          run_lease: { id: "lease_1", run_id: "run_1", core_id: "core_1" }
        },
        { ttlSeconds: 60 }
      ),
    (error) => {
      assert.equal(error.code, "core_execution_reconciliation_required");
      assert.equal(error.stage, "execute");
      assert.equal(error.retryable, false);
      return true;
    }
  );
  assert.deepEqual(requests, [
    "/v1/core-runs/run_1/leases/lease_1/start",
    "/v1/core-runs/run_1/leases/lease_1/renew",
    "/v1/core-runs/run_1/leases/lease_1/execute"
  ]);
});

test("computeConnectedCoreLoopDelayMs adds bounded retry jitter", () => {
  assert.equal(computeConnectedCoreLoopDelayMs(0, 1000, 0), 750);
  assert.equal(computeConnectedCoreLoopDelayMs(0, 1000, 1), 1000);
  assert.equal(computeConnectedCoreLoopDelayMs(2, 1000, 0.5), 3500);
  assert.equal(computeConnectedCoreLoopDelayMs(0, 100, 0.5), 218);
});

test("connected Core runtime stays separate from the primary host agent runtime", async () => {
  const runtime = await import("@blackscaletech/swarm-sdk/connected-core-runtime");
  const packageManifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );
  assert.equal("runAgentOnce" in runtime, false);
  assert.equal("runAgentLoop" in runtime, false);
  assert.equal("computeRuntimeLoopSteadyDelayMs" in runtime, false);
  assert.equal(packageManifest.exports["./agent-runtime"].import, "./src/agent-runtime.js");
  assert.equal(packageManifest.exports["./agent-runtime"].types, "./src/agent-runtime.d.ts");
  assert.equal(
    readFileSync(new URL("../src/index.js", import.meta.url), "utf8").includes(
      "acquire-next-run"
    ),
    false
  );
});

test("connected Core lifecycle methods require canonical mutation idempotency", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (url, init) => {
      requests.push({
        path: new URL(url).pathname,
        key: init.headers.get("idempotency-key")
      });
      if (new URL(url).pathname === "/v1/core-runner/runs/claim-next") {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({});
    }
  });

  await client.recordCoreRunnerHeartbeat();
  await client.claimNextCoreRun();
  await client.acquireCoreRun("run_1");
  await client.startCoreRun("run_1", "lease_1");
  await client.executeCoreRun("run_1", "lease_1");
  await client.completeCoreRun("run_1", "lease_1", { outcome: "succeeded" });
  await client.renewCoreRunLease("run_1", "lease_1", { ttl_seconds: 60 });
  await client.renewCoreRunLease("run_1", "lease_1", { ttl_seconds: 60 });
  await client.releaseCoreRunLease("run_1", "lease_1");

  assert.equal(requests.length, 9);
  for (const request of requests) {
    assert.ok(request.key, `${request.path} should carry an idempotency key`);
  }
  const renewalKeys = requests
    .filter((request) => request.path.endsWith("/renew"))
    .map((request) => request.key);
  assert.equal(renewalKeys.length, 2);
  assert.notEqual(renewalKeys[0], renewalKeys[1]);
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
