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

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("launch preserves an explicit model route and binds it to retry identity", async () => {
  const bodies = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", token: "synthetic",
    fetch: async (_url, init) => { bodies.push(JSON.parse(init.body)); return jsonResponse({ run: { id: "run_1" } }); }
  });
  const input = { title: "Review", description: "Preserve the original objective.", model_route_policy_id: " route_a " };
  await client.launchSpaceRun("sp_1", input);
  assert.equal(bodies[0].model_route_policy_id, input.model_route_policy_id);
  assert.equal(buildLaunchRunIdempotencyKey("sp_1", input), buildLaunchRunIdempotencyKey("sp_1", { ...input, model_route_policy_id: "route_a" }));
  assert.notEqual(buildLaunchRunIdempotencyKey("sp_1", input), buildLaunchRunIdempotencyKey("sp_1", { ...input, model_route_policy_id: "route_b" }));
  const { model_route_policy_id, ...legacy } = input;
  assert.equal(buildLaunchRunIdempotencyKey("sp_1", legacy), buildLaunchRunIdempotencyKey("sp_1", { ...legacy, model_route_policy_id: " " }));
});

test("SwarmClient createArtifact uses stable idempotency while heartbeat remains operation-scoped", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "runtime-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: "ok" }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  await client.createArtifact({
    space_id: "ws_1",
    run_id: "run_1",
    kind: "executor_stdout",
    media_type: "text/plain",
    body: "stdout"
  });
  await client.createArtifact({
    space_id: "ws_1",
    run_id: "run_1",
    kind: "executor_stdout",
    media_type: "text/plain",
    body: "stdout"
  });
  await client.heartbeatAgent("agt_1", { status: "idle" });
  await client.heartbeatAgent("agt_1", { status: "idle" });

  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    requests[1].init.headers.get("Idempotency-Key")
  );
  assert.notEqual(
    requests[2].init.headers.get("Idempotency-Key"),
    requests[3].init.headers.get("Idempotency-Key")
  );
});

test("SwarmClient getRunContext targets the resolved run context route", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        run: { id: "run_1", space_id: "ws_1", task_id: "task_1", status: "queued", attempt: 1, execution_policy: { max_runtime_seconds: 300, max_tool_calls: 32, max_external_requests: 0, allow_network: false, allow_shell: false }, run_requirements: {}, created_at: "2026-03-10T12:00:00Z", updated_at: "2026-03-10T12:00:00Z" },
        context_refs: []
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const context = await client.getRunContext("run_1");

  assert.equal(context.run.id, "run_1");
  assert.match(requests[0].url, /\/v1\/runs\/run_1\/context$/);
});

test("SwarmClient task management helpers target canonical task routes", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        id: "task_1",
        space_id: "ws_1",
        title: "Updated task",
        description: "Updated before execution.",
        status: requests.length === 2 ? "canceled" : "active",
        created_at: "2026-03-10T12:00:00Z",
        updated_at: "2026-03-10T12:01:00Z",
        cancel_reason: requests.length === 2 ? "wrong task" : ""
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const task = await client.updateTask("task_1", {
    title: "Updated task",
    description: "Updated before execution."
  });
  const canceled = await client.cancelTask("task_1", { reason: "wrong task" });

  assert.equal(task.title, "Updated task");
  assert.equal(canceled.status, "canceled");
  assert.equal(requests[0].init.method, "PATCH");
  assert.equal(requests[1].init.method, "POST");
  assert.match(requests[0].url, /\/v1\/tasks\/task_1$/);
  assert.match(requests[1].url, /\/v1\/tasks\/task_1\/cancel$/);
  assert.match(requests[0].init.headers.get("Idempotency-Key"), /^swarm-sdk-v2-[a-f0-9]{32}$/);
  assert.match(requests[1].init.headers.get("Idempotency-Key"), /^swarm-sdk-v2-[a-f0-9]{32}$/);
});

test("SwarmClient getTask escapes task ids as a path segment", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        id: "task/with/slash",
        space_id: "ws_1",
        title: "Escaped task",
        description: "Path segment check.",
        status: "active",
        created_at: "2026-03-10T12:00:00Z",
        updated_at: "2026-03-10T12:01:00Z"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const task = await client.getTask("task/with/slash");

  assert.equal(task.id, "task/with/slash");
  assert.equal(requests[0].init.method, "GET");
  assert.match(requests[0].url, /\/v1\/tasks\/task%2Fwith%2Fslash$/);
});

test("SwarmClient automation profile helpers target the expected routes", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "auto_1",
          space_id: "ws_1",
          key: "research-alpha",
          name: "Research Alpha",
          compiler_key: "research.review_remediate_finalize.v1",
          compiler_version: "1",
          launch_template_id: "lt_1",
          review_threshold: 85,
          prompt_capture_mode: "compiled_only",
          created_at: "2026-03-12T00:00:00Z",
          updated_at: "2026-03-12T00:00:00Z"
        }),
        {
          status: requests.length === 1 ? 201 : 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  await client.createAutomationProfile({
    space_id: "ws_1",
    key: "research-alpha",
    name: "Research Alpha",
    compiler_key: "research.review_remediate_finalize.v1",
    review_threshold: 85,
    prompt_capture_mode: "compiled_only",
    launch_template: {
      name: "Research Launch",
      title: "Research topic",
      description: "Produce a research draft."
    },
    review_task: {
      title: "Review draft",
      description: "Review the generated draft."
    },
    remediation_task: {
      title: "Remediate draft",
      description: "Improve the generated draft."
    },
    finalize_task: {
      title: "Finalize draft",
      description: "Finalize the generated draft."
    }
  });
  await client.getAutomationProfile("auto_1");
  await client.updateAutomationProfile("auto_1", {
    key: "research-alpha",
    name: "Research Alpha",
    compiler_key: "research.review_remediate_finalize.v1",
    review_threshold: 90,
    prompt_capture_mode: "raw_and_compiled",
    launch_template: {
      name: "Research Launch",
      title: "Research topic",
      description: "Produce a research draft."
    },
    review_task: {
      title: "Review draft",
      description: "Review the generated draft."
    },
    remediation_task: {
      title: "Remediate draft",
      description: "Improve the generated draft."
    },
    finalize_task: {
      title: "Finalize draft",
      description: "Finalize the generated draft."
    }
  });
  await client.disableAutomationProfile("auto_1");

  assert.match(requests[0].url, /\/v1\/automation-profiles$/);
  assert.match(requests[1].url, /\/v1\/automation-profiles\/auto_1$/);
  assert.match(requests[2].url, /\/v1\/automation-profiles\/auto_1\/update$/);
  assert.match(requests[3].url, /\/v1\/automation-profiles\/auto_1\/disable$/);
});

 test("streamAuditEvents parses SSE audit events", async () => {
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                "retry: 1000\n\nid: 2026-03-11T00:00:00Z|1\nevent: audit_event\ndata: {\"id\":\"evt_1\",\"actor_id\":\"agt_1\",\"resource_type\":\"run\",\"resource_id\":\"run_1\",\"action\":\"run.started\",\"occurred_at\":\"2026-03-11T00:00:00Z\"}\n\n"
              )
            );
            controller.close();
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8"
          }
        }
      )
  });

  const seen = [];
  const lastEventId = await client.streamAuditEvents(
    { space_id: "ws_1", limit: 10 },
    (event, meta) => {
      seen.push({ event, meta });
    }
  );

  assert.equal(lastEventId, "2026-03-11T00:00:00Z|1");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].event.id, "evt_1");
  assert.equal(seen[0].meta.event, "audit_event");
});

test("listRuntimeHints targets the agent-scoped runtime hint collection", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify([
          {
            id: "hint_1",
            sequence: 7,
            space_id: "ws_1",
            agent_scope_mode: "target_agents",
            target_agent_ids: ["agt_1"],
            hint_key: "run.available:run_1:1:run:run_1",
            kind: "run.available",
            run_id: "run_1",
            task_id: "task_1",
            source_resource_type: "run",
            source_resource_id: "run_1",
            current_status: "queued",
            created_at: "2026-03-13T12:00:00Z",
            expires_at: "2026-03-16T12:00:00Z"
          }
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Next-Cursor": "7",
            "X-Order": "desc"
          }
        }
      );
    }
  });

  const page = await client.listRuntimeHints("agt_1", { kind: "run.available", limit: 5 });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].kind, "run.available");
  assert.equal(page.nextCursor, "7");
  assert.match(requests[0].url, /\/v1\/agents\/agt_1\/runtime-hints\?kind=run.available&limit=5$/);
});

test("streamRuntimeHints parses SSE runtime hint events", async () => {
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                "retry: 1000\n\nid: 7\nevent: runtime_hint\ndata: {\"id\":\"hint_1\",\"sequence\":7,\"space_id\":\"ws_1\",\"agent_scope_mode\":\"space_any\",\"hint_key\":\"run.available:run_1:1:run:run_1\",\"kind\":\"run.available\",\"run_id\":\"run_1\",\"task_id\":\"task_1\",\"source_resource_type\":\"run\",\"source_resource_id\":\"run_1\",\"current_status\":\"queued\",\"created_at\":\"2026-03-13T12:00:00Z\",\"expires_at\":\"2026-03-16T12:00:00Z\"}\n\n"
              )
            );
            controller.close();
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8"
          }
        }
      )
  });

  const seen = [];
  const lastEventId = await client.streamRuntimeHints(
    "agt_1",
    (event, meta) => {
      seen.push({ event, meta });
    },
    { kind: "run.available", limit: 10 }
  );

  assert.equal(lastEventId, "7");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].event.id, "hint_1");
  assert.equal(seen[0].meta.event, "runtime_hint");
});

test("streamRuntimeHints preserves the latest event id when skipping an oversized frame", async () => {
  const errors = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `id: 7\nevent: runtime_hint\ndata: {"oversized":"${"x".repeat(256)}"}\n\n`
              )
            );
            controller.close();
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8"
          }
        }
      )
  });

  const seen = [];
  const lastEventId = await client.streamRuntimeHints(
    "agt_1",
    (event, meta) => {
      seen.push({ event, meta });
    },
    {
      sseMaxEventBytes: 64,
      onStreamError: (details) => {
        errors.push(details);
      }
    }
  );

  assert.equal(lastEventId, "7");
  assert.equal(seen.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "event_too_large");
  assert.equal(errors[0].id, "7");
});

test("streamRuntimeHints reports malformed JSON and continues to later events", async () => {
  const errors = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                "id: 7\nevent: runtime_hint\ndata: {bad json}\n\nid: 8\nevent: runtime_hint\ndata: {\"id\":\"hint_2\",\"sequence\":8,\"space_id\":\"ws_1\",\"agent_scope_mode\":\"space_any\",\"hint_key\":\"run.available:run_2:1:run:run_2\",\"kind\":\"run.available\",\"run_id\":\"run_2\",\"task_id\":\"task_2\",\"source_resource_type\":\"run\",\"source_resource_id\":\"run_2\",\"current_status\":\"queued\",\"created_at\":\"2026-03-13T12:00:00Z\",\"expires_at\":\"2026-03-16T12:00:00Z\"}\n\n"
              )
            );
            controller.close();
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8"
          }
        }
      )
  });

  const seen = [];
  const lastEventId = await client.streamRuntimeHints(
    "agt_1",
    (event, meta) => {
      seen.push({ event, meta });
    },
    {
      onStreamError: (details) => {
        errors.push(details);
      }
    }
  );

  assert.equal(lastEventId, "8");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].event.id, "hint_2");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "invalid_json");
  assert.equal(errors[0].id, "7");
});

test("SwarmClient fails closed on redirects for credentialed traffic", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  });

  await client.listAgents();
  await client.streamAuditEvents({}, () => {});

  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.redirect, "error");
  assert.equal(requests[1].init.redirect, "error");
});

test("SwarmClient throws SwarmAPIError on failed responses", async () => {
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async () =>
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json"
        }
      })
  });

  await assert.rejects(() => client.getSpace("ws_1"), (error) => {
    assert.ok(error instanceof SwarmAPIError);
    assert.equal(error.status, 403);
    assert.deepEqual(error.body, { error: "forbidden" });
    return true;
  });
});

test("SwarmClient operator and governance helpers target the expected routes", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), method: init.method });
      return jsonResponse([]);
    }
  });

  await client.listAgents({ space_id: "ws_1", limit: 25, order: "asc" });
  await client.listAgentCapabilityManifests({ agent_id: "agt_1", order: "desc" });
  await client.listAgentPresence({ space_id: "ws_1", status: "busy", limit: 10 });
  await client.listSpaceOperatorActivity("ws_1", { resource_type: "run", limit: 5 });
  await client.listSpaceOperatorPresenceEntries("ws_1", { status: "online", order: "desc" });
  await client.listSpaceSignedStatusEntries("ws_1", {
    agent_id: "agt_1",
    action: "artifact.created",
    limit: 7
  });

  assert.match(requests[0].url, /\/v1\/agents\?space_id=ws_1&limit=25&order=asc$/);
  assert.match(requests[1].url, /\/v1\/agent-capability-manifests\?agent_id=agt_1&order=desc$/);
  assert.match(requests[2].url, /\/v1\/agent-presence\?space_id=ws_1&status=busy&limit=10$/);
  assert.match(requests[3].url, /\/v1\/operator\/spaces\/ws_1\/activity\?resource_type=run&limit=5$/);
  assert.match(requests[4].url, /\/v1\/operator\/spaces\/ws_1\/presence\?status=online&order=desc$/);
  assert.match(
    requests[5].url,
    /\/v1\/operator\/spaces\/ws_1\/signed-status\?agent_id=agt_1&action=artifact.created&limit=7$/
  );
  for (const request of requests) {
    assert.equal(request.method, "GET");
  }
});

test("SwarmClient accepts space_id scoped query and body inputs", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : null
      });
      if (init.method === "POST") {
        return jsonResponse({ id: "agt_1", space_id: "ws_1", kind: "codex", name: "Codex" }, 201);
      }
      return jsonResponse([]);
    }
  });

  await client.listAgents({ space_id: "ws_1", limit: 3 });
  await client.createAgent({ space_id: "ws_1", kind: "codex", name: "Codex" });

  assert.match(requests[0].url, /\/v1\/agents\?space_id=ws_1&limit=3$/);
  assert.deepEqual(requests[1].body, { space_id: "ws_1", kind: "codex", name: "Codex" });
});

test("SwarmClient operator live snapshot and observability target the expected routes", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), method: init.method });
      if (requests.length === 1) {
        return jsonResponse({
          summary: {
            space_id: "ws_1",
            entity_id: "ent_1",
            key: "ops",
            name: "Ops",
            directory_visible: false,
            agent_count: 1,
            manifest_backed_agent_count: 1,
            active_run_lease_count: 1,
            webhook_target_count: 0,
            pending_webhook_deliveries: 0,
            dead_letter_webhook_deliveries: 0,
            runtime_receipt_count: 0,
            active_runtime_credential_count: 1,
            budget_account_count: 0,
            active_budget_delegation_count: 0,
            pending_approval_request_count: 0,
            run_counts: {},
            presence_counts: {}
          },
          activity: [],
          presence: [],
          signed_status: [],
          sessions: [],
          governance: {
            space_id: "ws_1",
            active_credential_count: 1,
            budget_account_count: 0,
            active_budget_delegations: 0,
            pending_approval_requests: 0,
            active_credentials: [],
            budget_accounts: [],
            active_delegations: [],
            pending_approval_queue: []
          },
          runs: []
        });
      }
      return jsonResponse({
        run_acquisition: {
          count: 1,
          error_count: 0,
          total_duration_ms: 12,
          last_duration_ms: 12,
          max_duration_ms: 12,
          last_candidate_count: 1,
          max_candidate_count: 1
        },
        run_context_resolution: {
          count: 1,
          error_count: 0,
          total_duration_ms: 4,
          last_duration_ms: 4,
          max_duration_ms: 4,
          last_payload_bytes: 128,
          max_payload_bytes: 128
        },
        artifact_search_indexing: {
          count: 2,
          error_count: 0,
          total_duration_ms: 3,
          last_duration_ms: 1,
          max_duration_ms: 2,
          last_payload_bytes: 64,
          max_payload_bytes: 128
        }
      });
    }
  });

  const live = await client.getSpaceOperatorLiveSnapshot("ws_1", { activity_limit: 2, run_limit: 1 });
  const observability = await client.getControlPlaneObservability();

  assert.equal(live.summary.space_id, "ws_1");
  assert.equal(observability.run_acquisition.count, 1);
  assert.match(requests[0].url, /\/v1\/operator\/spaces\/ws_1\/live\?activity_limit=2&run_limit=1$/);
  assert.match(requests[1].url, /\/v1\/operator\/control-plane-observability$/);
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[1].method, "GET");
});
