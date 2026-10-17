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

function declarationLineCount(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").split("\n").length;
}

test("SDK declarations stay split by public surface", () => {
  assert.equal(
    readFileSync(new URL("../src/index.d.ts", import.meta.url), "utf8").trim(),
    [
      'export * from "./types.js";',
      'export * from "./client.js";',
      'export * from "./intelligence.js";',
      'export * from "./connected-core-runtime.js";',
      'export * from "./agent-runtime.js";',
      'export * from "./idempotency.js";',
      'export * from "./webhooks.js";',
      'export * from "./event-stream.js";'
    ].join("\n")
  );
  assert.ok(declarationLineCount("../src/types.d.ts") <= 2400, "shared DTO declarations should remain bounded");
  assert.ok(declarationLineCount("../src/intelligence.d.ts") <= 900, "intelligence declarations should remain focused");
  assert.ok(declarationLineCount("../src/client.d.ts") <= 550, "client declarations should not absorb runtime/helper surfaces");
  assert.ok(declarationLineCount("../src/connected-core-runtime.d.ts") <= 100, "connected Core runtime declarations should stay focused");
});

test("package subpath exports expose focused helper modules", async () => {
  const [connectedCoreRuntime, idempotency, webhooks] = await Promise.all([
    import("@blackscaletech/swarm-sdk/connected-core-runtime"),
    import("@blackscaletech/swarm-sdk/idempotency"),
    import("@blackscaletech/swarm-sdk/webhooks")
  ]);

  assert.equal(typeof connectedCoreRuntime.runConnectedCoreLoop, "function");
  assert.equal(typeof connectedCoreRuntime.executeConnectedCoreAcquisition, "function");
  assert.equal(typeof idempotency.buildBootstrapSpaceIdempotencyKey, "function");
  assert.equal(typeof idempotency.buildLaunchRunIdempotencyKey, "function");
  assert.equal(typeof webhooks.computeWebhookSignature, "function");
  assert.equal(typeof webhooks.verifyWebhookSignature, "function");
});

test("SwarmClient listSpaces parses collection headers and auth", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify([
          {
            id: "ws_1",
            entity_id: "ent_1",
            key: "core",
            name: "Core",
            created_at: "2026-03-11T00:00:00Z"
          }
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Next-Cursor": "cursor_2",
            "X-Order": "asc"
          }
        }
      );
    }
  });

  const page = await client.listSpaces({ entity_id: "ent_1", limit: 10, order: "asc" });

  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, "cursor_2");
  assert.equal(page.order, "asc");
  assert.match(requests[0].url, /\/v1\/spaces\?entity_id=ent_1&limit=10&order=asc$/);
  assert.equal(requests[0].init.headers.get("Authorization"), "Bearer agent-token");
  assert.equal(requests[0].init.redirect, "error");
});

test("SwarmClient reports unavailable Artifact content without substituting a body", async () => {
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async () => new Response(
      JSON.stringify({ error: "artifact content is unavailable" }),
      { status: 410, headers: { "Content-Type": "application/json" } }
    )
  });

  await assert.rejects(
    client.getArtifactContent("art_missing"),
    (error) => {
      assert.ok(error instanceof SwarmAPIError);
      assert.equal(error.status, 410);
      assert.deepEqual(error.body, { error: "artifact content is unavailable" });
      assert.doesNotMatch(error.message, /payload_ref|storage_key|private\/object/i);
      return true;
    }
  );
});

test("SwarmClient keeps metadata and learning-policy updates on separate routes", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "ws_1",
          entity_id: "ent_1",
          key: "research",
          name: "Research",
          description: "Focused space for research and operator review.",
          created_at: "2026-03-11T00:00:00Z"
        }),
        {
          status: requests.length === 1 ? 201 : 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const created = await client.createSpace({
    entity_id: "ent_1",
    key: "research",
    name: "Research",
    description: "Focused space for research and operator review."
  });
  const updated = await client.updateSpace("ws_1", {
    description: "Updated space description."
  });
  await client.updateSpaceLearningPolicy(
    "ws_1",
    {
      memory_policy: "auto_promote_safe",
      expected_updated_at: "2026-03-11T00:00:00Z",
      confirm_verified_auto_promotion: true
    },
    { idempotencyKey: "learning-policy-1" }
  );

  assert.equal(created.description, "Focused space for research and operator review.");
  assert.match(requests[0].url, /\/v1\/spaces$/);
  assert.equal(JSON.parse(requests[0].init.body).description, "Focused space for research and operator review.");
  assert.match(requests[1].url, /\/v1\/spaces\/ws_1$/);
  assert.equal(requests[1].init.method, "PATCH");
  assert.equal(JSON.parse(requests[1].init.body).description, "Updated space description.");
  assert.equal(updated.description, "Focused space for research and operator review.");
  assert.match(requests[2].url, /\/v1\/spaces\/ws_1\/learning-policy$/);
  assert.equal(requests[2].init.method, "PATCH");
  assert.equal(requests[2].init.headers.get("Idempotency-Key"), "learning-policy-1");
  assert.deepEqual(JSON.parse(requests[2].init.body), {
    memory_policy: "auto_promote_safe",
    expected_updated_at: "2026-03-11T00:00:00Z",
    confirm_verified_auto_promotion: true
  });
});

test("SwarmClient createEntity carries an optional custom key", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "ent_1",
          key: "blackscale-research",
          name: "Blackscale Research",
          created_at: "2026-03-12T00:00:00Z"
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const entity = await client.createEntity({ key: "blackscale-research", name: "Blackscale Research" });

  assert.equal(entity.key, "blackscale-research");
  assert.match(requests[0].url, /\/v1\/entities$/);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    key: "blackscale-research",
    name: "Blackscale Research"
  });
});

test("SwarmClient redacts sensitive error detail before surfacing it", async () => {
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async () =>
      new Response(
        JSON.stringify({
          error: "Authorization: Bearer swarm_agt_abcdefghijklmnop API_KEY=supersecretvalue"
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      )
  });

  await assert.rejects(
    async () => client.getCurrentUser(),
    (error) => {
      assert.ok(error instanceof SwarmAPIError);
      assert.equal(String(error).includes("swarm_agt_abcdefghijklmnop"), false);
      assert.equal(String(error).includes("supersecretvalue"), false);
      assert.ok(String(error).includes("[REDACTED_SECRET]"));
      return true;
    }
  );
});

test("SwarmClient human session helpers target canonical self and session endpoints", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "human-session-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            user: {
              id: "usr_1",
              primary_email: "operator@swarm.dev",
              display_name: "Operator",
              status: "active",
              created_at: "2026-03-12T00:00:00Z",
              updated_at: "2026-03-12T00:00:00Z"
            },
            session: {
              id: "ses_1",
              user_id: "usr_1",
              active_entity_id: "ent_1",
              created_at: "2026-03-12T00:00:00Z",
              last_seen_at: "2026-03-12T00:00:00Z",
              expires_at: "2026-03-12T12:00:00Z"
            },
            active_entity_role: "entity_admin"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          id: "ses_2",
          user_id: "usr_2",
          active_entity_id: "ent_1",
          created_at: "2026-03-12T00:00:00Z",
          last_seen_at: "2026-03-12T00:00:00Z",
          expires_at: "2026-03-12T12:00:00Z",
          revocation_reason: requests.length === 3 ? "logout" : undefined
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  const current = await client.getCurrentUser();
  const session = await client.getUserSession("ses_2");
  const revoked = await client.revokeUserSession("ses_2", { reason: "logout" });

  assert.equal(current.user.id, "usr_1");
  assert.match(requests[0].url, /\/v1\/me$/);
  assert.match(requests[1].url, /\/v1\/user-sessions\/ses_2$/);
  assert.equal(session.id, "ses_2");
  assert.match(requests[2].url, /\/v1\/user-sessions\/ses_2\/revoke$/);
  assert.equal(revoked.revocation_reason, "logout");
});

test("SwarmClient createProviderSession targets the public provider-session endpoint", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          user: {
            id: "usr_1",
            primary_email: "operator@swarm.dev",
            display_name: "Operator",
            status: "active",
            created_at: "2026-03-12T00:00:00Z",
            updated_at: "2026-03-12T00:00:00Z"
          },
          identity: {
            id: "uid_1",
            user_id: "usr_1",
            provider: "google",
            provider_subject: "google-subject-1",
            primary_email: "operator@swarm.dev",
            display_name: "Operator",
            created_at: "2026-03-12T00:00:00Z",
            updated_at: "2026-03-12T00:00:00Z"
          },
          session: {
            id: "ses_1",
            user_id: "usr_1",
            created_at: "2026-03-12T00:00:00Z",
            last_seen_at: "2026-03-12T00:00:00Z",
            expires_at: "2026-03-12T12:00:00Z"
          },
          token: "swarm_usr_test"
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const issued = await client.createProviderSession({
    provider: "google",
    provider_subject: "google-subject-1",
    primary_email: "operator@swarm.dev",
    display_name: "Operator",
    asserted_at: 1741737600,
    signature: "provider-signature"
  });

  assert.equal(issued.identity.provider, "google");
  assert.match(requests[0].url, /\/v1\/auth\/provider-sessions$/);
  assert.equal(requests[0].init.method, "POST");
});

test("SwarmClient createProviderSession uses stable idempotency for transport retries", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ token: "swarm_usr_test" }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const input = {
    provider: "google",
    provider_subject: "google-subject-1",
    primary_email: "operator@swarm.dev",
    display_name: "Operator",
    asserted_at: 1741737600,
    signature: "provider-signature"
  };

  await client.createProviderSession(input);
  await client.createProviderSession(input);

  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    requests[1].init.headers.get("Idempotency-Key")
  );
});

test("SwarmClient bootstrapSpace targets the entity-scoped bootstrap endpoint with stable idempotency", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          space: { id: "ws_1", entity_id: "ent_1", key: "headless", name: "Headless", created_at: "2026-03-12T00:00:00Z" },
          agent: { id: "agt_1", space_id: "ws_1", kind: "executor", name: "Primary Runtime", capabilities: ["artifact.write"], created_at: "2026-03-12T00:00:00Z" },
          credential: { credential: { id: "cred_1", agent_id: "agt_1", created_at: "2026-03-12T00:00:00Z" }, token: "swarm_agt_test" }
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const input = {
    space: { key: "headless", name: "Headless" },
    agent: { kind: "executor", name: "Primary Runtime", capabilities: ["artifact.write"] },
    launch_template: {
      name: "Research Launch",
      title: "Research task",
      description: "Produce a research draft.",
      scoring_contract: {
        rubric_key: "research.review.v1",
        version: 1,
        pass_threshold: 85,
        fail_threshold: 50,
        strict_mode: true,
        dimensions: [
          { key: "safety", weight_bps: 2000, min_required: 85 },
          { key: "factuality", weight_bps: 3500, min_required: 80 },
          { key: "completeness", weight_bps: 2500, min_required: 65 },
          { key: "actionability", weight_bps: 2000, min_required: 70 }
        ]
      }
    }
  };
  const result = await client.bootstrapSpace("ent_1", input);

  assert.equal(result.space.id, "ws_1");
  assert.match(requests[0].url, /\/v1\/entities\/ent_1\/bootstrap-space$/);
  assert.deepEqual(JSON.parse(requests[0].init.body).space, { key: "headless", name: "Headless", description: "" });
  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    buildBootstrapSpaceIdempotencyKey("ent_1", input)
  );
  assert.equal(buildBootstrapSpaceIdempotencyKey("ent_1", input), buildBootstrapSpaceIdempotencyKey("ent_1", input));
  const requestBody = JSON.parse(requests[0].init.body);
  assert.deepEqual(
    requestBody.launch_template.scoring_contract.dimensions.map((rule) => rule.key),
    ["actionability", "completeness", "factuality", "safety"]
  );
});

test("SwarmClient connectSpaceClient targets the space-scoped direct connection endpoint with stable idempotency", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          space: { id: "ws_1", entity_id: "ent_1", key: "research", name: "Research", created_at: "2026-03-12T00:00:00Z" },
          agent: { id: "agt_1", space_id: "ws_1", kind: "codex", name: "Codex Runtime", created_at: "2026-03-12T00:00:00Z" },
          credential: { credential: { id: "cred_1", agent_id: "agt_1", created_at: "2026-03-12T00:00:00Z" }, token: "swarm_agt_test" },
          connection: { mode: "direct_api", space_id: "ws_1", agent_id: "agt_1", authentication_type: "bearer", authorization_header: "Authorization" },
          agent_created: true
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const input = {
    kind: "codex",
    name: "Codex Runtime",
    capabilities: ["run.execute", "artifact.write"],
    credential: { description: "direct api", ttl_seconds: 3600 }
  };
  const result = await client.connectSpaceClient("ws_1", input);

  assert.equal(result.agent.id, "agt_1");
  assert.equal(result.connection.mode, "direct_api");
  assert.match(requests[0].url, /\/v1\/spaces\/ws_1\/connect-client$/);
  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    buildConnectSpaceClientIdempotencyKey("ws_1", input)
  );
});

test("SwarmClient connectCurrentUserClient targets the current-user convenience endpoint with stable idempotency", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "human-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          user: {
            id: "usr_1",
            primary_email: "personal@blackscale.ai",
            display_name: "Personal Operator",
            default_entity_id: "ent_1",
            default_space_id: "ws_1",
            status: "active",
            created_at: "2026-03-12T00:00:00Z",
            updated_at: "2026-03-12T00:00:00Z"
          },
          entity: { id: "ent_1", name: "Personal Operator Personal", created_at: "2026-03-12T00:00:00Z" },
          space: { id: "ws_1", entity_id: "ent_1", key: "personal", name: "Personal", created_at: "2026-03-12T00:00:00Z" },
          agent: { id: "agt_1", space_id: "ws_1", kind: "codex", capabilities: [], created_at: "2026-03-12T00:00:00Z" },
          credential: { credential: { id: "cred_1", agent_id: "agt_1", created_at: "2026-03-12T00:00:00Z" }, token: "swarm_agt_secret" },
          connection: { mode: "direct_api", space_id: "ws_1", agent_id: "agt_1", authentication_type: "bearer", authorization_header: "Authorization" },
          created_entity: true,
          created_space: true,
          agent_created: true
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const input = {
    spaceId: "ws_1",
    space_description: "Personal space for direct chat execution.",
    kind: "codex",
    name: "Codex Chat",
    credential: { description: "chat bootstrap", ttl_seconds: 3600 }
  };
  const result = await client.connectCurrentUserClient(input);

  assert.equal(result.space.key, "personal");
  assert.equal(result.user.default_space_id, "ws_1");
  assert.match(requests[0].url, /\/v1\/me\/connect-client$/);
  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    buildConnectCurrentUserClientIdempotencyKey(input)
  );
  assert.equal(JSON.parse(requests[0].init.body).space_id, "ws_1");
  assert.equal(JSON.parse(requests[0].init.body).space_description, "Personal space for direct chat execution.");
});

test("SwarmClient bootstrapCurrentUserEntity targets the current-user entity bootstrap endpoint with stable idempotency", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "human-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          user: { id: "usr_1", primary_email: "owner@acme.ai", display_name: "Owner", status: "active", created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
          session: { id: "ses_1", user_id: "usr_1", active_entity_id: "ent_1", created_at: "2026-03-12T00:00:00Z", last_seen_at: "2026-03-12T00:00:00Z", expires_at: "2026-03-12T12:00:00Z" },
          entity: { id: "ent_1", key: "acme-research", name: "Acme Research", created_at: "2026-03-12T00:00:00Z" },
          entity_role: "entity_owner",
          space: { id: "ws_1", entity_id: "ent_1", key: "home", name: "General", created_at: "2026-03-12T00:00:00Z" },
          space_role: "space_admin",
          session_activated: true
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  const input = {
    key: "acme-research",
    name: "Acme Research",
    space: { description: "Primary company space." }
  };
  const result = await client.bootstrapCurrentUserEntity(input);

  assert.equal(result.entity.id, "ent_1");
  assert.equal(result.entity.key, "acme-research");
  assert.match(requests[0].url, /\/v1\/me\/bootstrap-entity$/);
  const requestBody = JSON.parse(requests[0].init.body);
  assert.equal(requestBody.key, "acme-research");
  assert.equal(requestBody.space.description, "Primary company space.");
  assert.equal(Object.hasOwn(requestBody, "connection"), false);
  assert.equal(Object.hasOwn(requestBody, "launch_template"), false);
  assert.equal(Object.hasOwn(requestBody, "automation_profile"), false);
  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    buildBootstrapCurrentUserEntityIdempotencyKey(input)
  );
});

test("SwarmClient connectCurrentUserAndLaunch targets the one-shot current-user chat launch endpoint", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "user-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          user: { id: "usr_1", primary_email: "operator@example.com", display_name: "Operator", status: "active", created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
          entity: { id: "ent_1", name: "Operator Personal", created_at: "2026-03-12T00:00:00Z" },
          space: { id: "ws_1", entity_id: "ent_1", key: "personal", name: "Personal", created_at: "2026-03-12T00:00:00Z" },
          agent: { id: "agt_1", space_id: "ws_1", kind: "codex", name: "Codex Chat", capabilities: ["artifact.write"], created_at: "2026-03-12T00:00:00Z" },
          credential: { id: "cred_1", agent_id: "agt_1", class: "connected_launch", description: "chat bootstrap", created_at: "2026-03-12T00:00:00Z" },
          runtime_access: { credential: { id: "cred_1", agent_id: "agt_1", class: "connected_launch", description: "chat bootstrap", created_at: "2026-03-12T00:00:00Z" }, token: "swarm_agt_test" },
          connection: { mode: "direct_api", space_id: "ws_1", agent_id: "agt_1", authentication_type: "bearer", authorization_header: "Authorization" },
          runtime_presence: { agent_id: "agt_1", space_id: "ws_1", status: "online", last_heartbeat_at: "2026-03-12T00:00:00Z", protocol: "codex_chat", version: "desktop-v1", execution_mode: "sandboxed", sandbox_provider: "bwrap", sandbox_preset: "bwrap", metadata_trust: "self_reported", created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
          webhook_target: { id: "wht_1", space_id: "ws_1", name: "Chat Follow-Up", url: "https://hooks.example.com/swarm/chat", included_actions: ["run.launched"], has_signing_secret: false, max_attempts: 8, initial_backoff_seconds: 15, max_backoff_seconds: 900, dead_letter_count: 0, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
          task: { id: "task_1", space_id: "ws_1", title: "Research beautiful islands", description: "Create a ranked brief.", created_at: "2026-03-12T00:00:00Z" },
          run: { id: "run_1", space_id: "ws_1", task_id: "task_1", status: "leased", created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
          run_lease: { id: "lease_1", run_id: "run_1", agent_id: "agt_1", status: "active", issued_at: "2026-03-12T00:00:00Z", expires_at: "2026-03-12T00:01:30Z", created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
          created_entity: true,
          created_space: true,
          agent_created: true
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const input = {
    connection: {
      kind: "codex",
      name: "Codex Chat",
      space_description: "Personal space for direct chat execution."
    },
    runtime_heartbeat: {
      protocol: "codex_chat",
      version: "desktop-v1",
      executionMode: "sandboxed",
      sandboxProvider: "bwrap",
      sandboxPreset: "bwrap"
    },
    webhook_follow_up: {
      url: "https://hooks.example.com/swarm/chat"
    },
    launch: {
      title: "Research beautiful islands",
      description: "Create a ranked brief.",
      ttl_seconds: 90
    }
  };
  const launched = await client.connectCurrentUserAndLaunch(input);

  assert.equal(launched.space.id, "ws_1");
  assert.equal(launched.run_lease.agent_id, "agt_1");
  assert.equal(launched.webhook_target.url, "https://hooks.example.com/swarm/chat");
  assert.equal(launched.runtime_presence.execution_mode, "sandboxed");
  assert.equal(launched.runtime_presence.sandbox_provider, "bwrap");
  assert.match(requests[0].url, /\/v1\/me\/connect-and-launch$/);
  assert.equal(
    requests[0].init.headers.get("Idempotency-Key"),
    buildConnectCurrentUserAndLaunchIdempotencyKey(input)
  );
  const requestBody = JSON.parse(requests[0].init.body);
  assert.equal(requestBody.runtime_heartbeat.execution_mode, "sandboxed");
  assert.equal(requestBody.runtime_heartbeat.sandbox_provider, "bwrap");
  assert.equal(requestBody.runtime_heartbeat.sandbox_preset, "bwrap");
});

test("SwarmClient webhook helpers target the operator webhook endpoints", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "operator-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      const path = new URL(String(url)).pathname;
      if (path === "/v1/webhook-actions") {
        return new Response(
          JSON.stringify([{ action: "run.succeeded", label: "Run succeeded", description: "Run completed successfully" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-action-presets") {
        return new Response(
          JSON.stringify([{
            key: "chat_follow_up",
            label: "Chat Follow-Up",
            description: "Push follow-up for chat clients",
            included_actions: ["run.succeeded", "artifact.created"]
          }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-targets" && init.method === "GET") {
        return new Response(
          JSON.stringify([{ id: "wht_1", space_id: "ws_1", name: "Ops Hook", url: "https://hooks.example/swarm", included_actions: ["run.succeeded"], has_signing_secret: true, max_attempts: 5, initial_backoff_seconds: 10, max_backoff_seconds: 300, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-targets" && init.method === "POST") {
        return new Response(
          JSON.stringify({ id: "wht_1", space_id: "ws_1", name: "Ops Hook", url: "https://hooks.example/swarm", included_actions: ["run.succeeded"], has_signing_secret: true, max_attempts: 5, initial_backoff_seconds: 10, max_backoff_seconds: 300, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-targets/wht_1") {
        return new Response(
          JSON.stringify({ id: "wht_1", space_id: "ws_1", name: "Ops Hook", url: "https://hooks.example/swarm", included_actions: ["run.succeeded"], has_signing_secret: true, max_attempts: 5, initial_backoff_seconds: 10, max_backoff_seconds: 300, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-targets/wht_1/update") {
        return new Response(
          JSON.stringify({ id: "wht_1", space_id: "ws_1", name: "Ops Hook Updated", url: "https://hooks.example/swarm", included_actions: ["run.succeeded", "artifact.created"], has_signing_secret: true, max_attempts: 6, initial_backoff_seconds: 10, max_backoff_seconds: 300, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T01:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-targets/wht_1/disable") {
        return new Response(
          JSON.stringify({ id: "wht_1", space_id: "ws_1", name: "Ops Hook", url: "https://hooks.example/swarm", included_actions: ["run.succeeded"], has_signing_secret: true, max_attempts: 5, initial_backoff_seconds: 10, max_backoff_seconds: 300, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T01:00:00Z", disabled_at: "2026-03-12T02:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-targets/wht_1/reconcile") {
        return new Response(
          JSON.stringify({
            target: { id: "wht_1", space_id: "ws_1", name: "Ops Hook", url: "https://hooks.example/swarm", included_actions: ["run.succeeded"], has_signing_secret: true, max_attempts: 5, initial_backoff_seconds: 10, max_backoff_seconds: 300, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:00:00Z" },
            state: { target_id: "wht_1", last_audit_sequence: 42, dead_letter_count: 0, updated_at: "2026-03-12T00:10:00Z" },
            queued_deliveries: [],
            processed_count: 1
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-deliveries" && init.method === "GET") {
        return new Response(
          JSON.stringify([{ id: "whd_1", target_id: "wht_1", space_id: "ws_1", audit_event_id: "evt_1", target_url: "https://hooks.example/swarm", payload: "{}", signature: "abc", status: "failed", attempt_count: 3, failure_count: 3, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:10:00Z" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/v1/webhook-deliveries/whd_1") {
        return new Response(
          JSON.stringify({ id: "whd_1", target_id: "wht_1", space_id: "ws_1", audit_event_id: "evt_1", target_url: "https://hooks.example/swarm", payload: "{}", signature: "abc", status: "failed", attempt_count: 3, failure_count: 3, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:10:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ id: "whd_1", target_id: "wht_1", space_id: "ws_1", audit_event_id: "evt_1", target_url: "https://hooks.example/swarm", payload: "{}", signature: "abc", status: "pending", attempt_count: 3, failure_count: 3, created_at: "2026-03-12T00:00:00Z", updated_at: "2026-03-12T00:11:00Z" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  const actions = await client.listWebhookActions();
  const presets = await client.listWebhookActionPresets();
  const targets = await client.listWebhookTargets({ space_id: "ws_1", active_only: true });
  const created = await client.createWebhookTarget({
    space_id: "ws_1",
    name: "Ops Hook",
    url: "https://hooks.example/swarm",
    included_actions: ["run.succeeded"]
  });
  const createdFromPreset = await client.createWebhookTargetFromPreset("chat_follow_up", {
    space_id: "ws_1",
    name: "Chat Hook",
    url: "https://hooks.example/swarm/chat"
  });
  const target = await client.getWebhookTarget("wht_1");
  const updated = await client.updateWebhookTarget("wht_1", {
    name: "Ops Hook Updated",
    url: "https://hooks.example/swarm",
    included_actions: ["run.succeeded", "artifact.created"],
    max_attempts: 6
  });
  const disabled = await client.disableWebhookTarget("wht_1");
  const reconciled = await client.reconcileWebhookTarget("wht_1", { limit: 5 });
  const deliveries = await client.listWebhookDeliveries({ space_id: "ws_1", status: "failed" });
  const delivery = await client.getWebhookDelivery("whd_1");
  const redriven = await client.redriveWebhookDelivery("whd_1");

  assert.equal(actions[0].action, "run.succeeded");
  assert.match(requests[0].url, /\/v1\/webhook-actions$/);
  assert.equal(presets[0].key, "chat_follow_up");
  assert.match(requests[1].url, /\/v1\/webhook-action-presets$/);
  assert.match(requests[2].url, /\/v1\/webhook-targets\?/);
  assert.match(requests[2].url, /space_id=ws_1/);
  assert.match(requests[2].url, /active_only=true/);
  assert.equal(targets.items[0].id, "wht_1");
  assert.equal(created.id, "wht_1");
  assert.match(requests[3].url, /\/v1\/webhook-targets$/);
  assert.equal(createdFromPreset.id, "wht_1");
  assert.deepEqual(JSON.parse(requests[5].init.body).included_actions, ["run.succeeded", "artifact.created"]);
  assert.equal(target.id, "wht_1");
  assert.equal(updated.name, "Ops Hook Updated");
  assert.match(requests[7].url, /\/v1\/webhook-targets\/wht_1\/update$/);
  assert.equal(disabled.disabled_at, "2026-03-12T02:00:00Z");
  assert.equal(reconciled.processed_count, 1);
  assert.match(requests[9].url, /\/v1\/webhook-targets\/wht_1\/reconcile$/);
  assert.equal(deliveries.items[0].id, "whd_1");
  assert.equal(delivery.id, "whd_1");
  assert.equal(redriven.status, "pending");
});

test("SwarmClient search targets the authorized search endpoint", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify([
          {
            resource_type: "run",
            resource_id: "run_1",
            entity_id: "ent_1",
            space_id: "ws_1",
            visibility_scope: "authorized",
            title: "run_1",
            snippet: "Task routing failed once and recovered.",
            score: 42,
            created_at: "2026-03-11T00:00:00Z",
            updated_at: "2026-03-11T00:05:00Z"
          }
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Next-Cursor": "search_cursor_2",
            "X-Order": "desc"
          }
        }
      );
    }
  });

  const page = await client.search({ q: "routing failed", space_id: "ws_1", resource_type: "run", limit: 5 });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].resource_id, "run_1");
  assert.equal(page.nextCursor, "search_cursor_2");
  assert.equal(page.order, "desc");
  assert.match(requests[0].url, /\/v1\/search\?q=routing\+failed&space_id=ws_1&resource_type=run&limit=5$/);
});

test("SwarmClient searchPublic targets the explicit public search endpoint", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    token: "agent-token",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify([
          {
            resource_type: "space",
            resource_id: "ws_1",
            entity_id: "ent_1",
            space_id: "ws_1",
            visibility_scope: "public",
            title: "Open Research",
            snippet: "Public space for research collaboration.",
            score: 87,
            created_at: "2026-03-11T00:00:00Z",
            updated_at: "2026-03-11T00:05:00Z"
          }
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Next-Cursor": "",
            "X-Order": "desc"
          }
        }
      );
    }
  });

  const page = await client.searchPublic({ q: "open research", resource_type: "space", limit: 5 });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].visibility_scope, "public");
  assert.match(requests[0].url, /\/v1\/search\/public\?q=open\+research&resource_type=space&limit=5$/);
});

test("SwarmClient listChatClientProfiles targets the public chat client registry", async () => {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example",
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify([
          {
            key: "codex_direct",
            label: "Codex Direct",
            description: "Codex profile",
            connection_mode: "direct_api",
            primary_entry_path: "/v1/me/connect-and-launch",
            same_client_supported: true,
            delegated_supported: true,
            follow_up_preset_key: "chat_follow_up",
            recommended_prompt_hints: ["Use Swarm for this space."]
          }
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });

  const profiles = await client.listChatClientProfiles();

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].key, "codex_direct");
  assert.match(requests[0].url, /\/v1\/chat-client-profiles$/);
});
