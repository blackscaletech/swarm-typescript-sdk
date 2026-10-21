import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

const input = { description: "unchanged synthetic input" };
const cases = [
  ["getUserSession", "GET", "/v1/user-sessions/{id}", []],
  ["revokeUserSession", "POST", "/v1/user-sessions/{id}/revoke", [input]],
  ["bootstrapSpace", "POST", "/v1/entities/{id}/bootstrap-space", [{}]],
  ["updateSpace", "PATCH", "/v1/spaces/{id}", [input]],
  ["updateSpaceLearningPolicy", "PATCH", "/v1/spaces/{id}/learning-policy", [input]],
  ["connectSpaceClient", "POST", "/v1/spaces/{id}/connect-client", [{}]],
  ["connectClient", "POST", "/v1/spaces/{id}/connect-client", [{}]],
  ["listSpaceAgentParticipants", "GET", "/v1/spaces/{id}/agent-participants", []],
  ["getAgent", "GET", "/v1/agents/{id}", []],
  ["getSpace", "GET", "/v1/spaces/{id}", []],
  ["getLaunchTemplate", "GET", "/v1/setups/{id}", []],
  ["updateLaunchTemplate", "POST", "/v1/setups/{id}/update", [input]],
  ["disableLaunchTemplate", "POST", "/v1/setups/{id}/disable", []],
  ["getAutomationProfile", "GET", "/v1/automation-profiles/{id}", []],
  ["updateAutomationProfile", "POST", "/v1/automation-profiles/{id}/update", [input]],
  ["disableAutomationProfile", "POST", "/v1/automation-profiles/{id}/disable", []],
  ["listRuntimeHints", "GET", "/v1/agents/{id}/runtime-hints", []],
  ["getAgentCapabilityManifest", "GET", "/v1/agent-capability-manifests/{id}", []],
  ["updateAgentCapabilityManifest", "POST", "/v1/agent-capability-manifests/{id}/update", [input]],
  ["heartbeatAgent", "POST", "/v1/agents/{id}/heartbeat", [input]],
  ["streamRuntimeHints", "GET", "/v1/agents/{id}/runtime-hints/stream", [() => {}]],
  ["getAgentPresence", "GET", "/v1/agents/{id}/presence", []],
  ["getBudgetAccount", "GET", "/v1/budget-accounts/{id}", []],
  ["fundBudgetAccount", "POST", "/v1/budget-accounts/{id}/fund", [input]],
  ["getBudgetLedgerEntry", "GET", "/v1/budget-ledger-entries/{id}", []],
  ["getBudgetDelegation", "GET", "/v1/budget-delegations/{id}", []],
  ["consumeBudgetDelegation", "POST", "/v1/budget-delegations/{id}/consume", [input]],
  ["revokeBudgetDelegation", "POST", "/v1/budget-delegations/{id}/revoke", [input]],
  ["getApprovalRequest", "GET", "/v1/approval-requests/{id}", []],
  ["approveApprovalRequest", "POST", "/v1/approval-requests/{id}/approve", [input]],
  ["rejectApprovalRequest", "POST", "/v1/approval-requests/{id}/reject", [input]],
  ["getWebhookTarget", "GET", "/v1/webhook-targets/{id}", []],
  ["updateWebhookTarget", "POST", "/v1/webhook-targets/{id}/update", [input]],
  ["disableWebhookTarget", "POST", "/v1/webhook-targets/{id}/disable", []],
  ["reconcileWebhookTarget", "POST", "/v1/webhook-targets/{id}/reconcile", [input]],
  ["getWebhookDelivery", "GET", "/v1/webhook-deliveries/{id}", []],
  ["redriveWebhookDelivery", "POST", "/v1/webhook-deliveries/{id}/redrive", []],
  ["getSpaceOperatorSummary", "GET", "/v1/operator/spaces/{id}/summary", []],
  ["getSpaceOperatorLiveSnapshot", "GET", "/v1/operator/spaces/{id}/live", []],
  ["listSpaceOperatorActivity", "GET", "/v1/operator/spaces/{id}/activity", []],
  ["listSpaceOperatorPresenceEntries", "GET", "/v1/operator/spaces/{id}/presence", []],
  ["listSpaceSignedStatusEntries", "GET", "/v1/operator/spaces/{id}/signed-status", []],
  ["getRun", "GET", "/v1/runs/{id}", []]
];
const identifiers = ["sp_CaseSensitive-09", "../tasks/tsk_synthetic", "a/b", "sp?injected=1", "sp#fragment",
  "sp%2f..%2fme", "sp\\..\\me", "\u00e9\u6f22 space"];

function fixture(baseUrl) {
  const calls = [];
  const client = new SwarmClient({ baseUrl, token: "synthetic-token", fetch: async (url, init) => {
    calls.push({ url: new URL(url), ...init });
    if (init.headers.get("accept") === "text/event-stream") {
      return new Response('id: applied\nevent: runtime_hint\ndata: {"ok":true}\n\n');
    }
    return Response.json([], { headers: { "x-next-cursor": "next", "x-order": "desc" } });
  } });
  return { client, calls };
}

for (const [name, method, template, args] of cases) {
  test(`PC1 ${name} keeps identifiers inside their route segment`, async () => {
    for (const baseUrl of ["https://audit.invalid/", "https://audit.invalid/prefix/"]) {
      for (const id of identifiers) {
        const { client, calls } = fixture(baseUrl);
        await client[name](id, ...args);
        assert.equal(calls.length, 1);
        const expected = new URL(template.replace("{id}", encodeURIComponent(id)).slice(1), baseUrl);
        assert.equal(calls[0].url.href, expected.href, `${name}: ${JSON.stringify(id)}`);
        assert.equal(calls[0].method, method);
        assert.equal(calls[0].headers.get("authorization"), "Bearer synthetic-token");
        assert.equal(calls[0].url.hash, "");
        assert.equal(calls[0].url.search, "");
      }
    }
  });
}

test("PC1 empty and exact dot IDs fail before any typed endpoint dispatch", async () => {
  for (const [name, , , args] of cases) {
    for (const id of ["", ".", ".."]) {
      const { client, calls } = fixture("https://audit.invalid/");
      await assert.rejects(client[name](id, ...args), /identifier|traversal/);
      assert.equal(calls.length, 0, name);
    }
  }
});

test("PC1 preserves explicit retry keys, bodies, query pagination and stream resume", async () => {
  const { client, calls } = fixture("https://audit.invalid/");
  await client.updateSpace("sp_Normal", input, { idempotencyKey: "original-retry-key" });
  assert.equal(calls[0].headers.get("idempotency-key"), "original-retry-key");
  assert.deepEqual(JSON.parse(calls[0].body), input);
  const page = await client.listRuntimeHints("a/b", { limit: 2, cursor: "old" });
  assert.equal(calls[1].url.pathname, "/v1/agents/a%2Fb/runtime-hints");
  assert.equal(calls[1].url.search, "?limit=2&cursor=old");
  assert.equal(page.nextCursor, "next");
  assert.equal(page.order, "desc");
  const seen = [];
  assert.equal(await client.streamRuntimeHints("a/b", data => seen.push(data), { lastEventId: "prior", kind: "ready", limit: 2 }), "applied");
  assert.equal(calls[2].headers.get("last-event-id"), "prior");
  assert.equal(calls[2].url.search, "?kind=ready&limit=2");
  assert.deepEqual(seen, [{ ok: true }]);
});

test("PC1 does not restrict the raw API's documented same-origin URL support", async () => {
  const { client, calls } = fixture("https://audit.invalid/prefix/");
  await client.get("https://audit.invalid/v1/me");
  assert.equal(calls[0].url.href, "https://audit.invalid/v1/me");
});
