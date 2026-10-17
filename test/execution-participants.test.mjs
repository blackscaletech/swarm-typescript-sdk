import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

test("participant discovery preserves executor address, false authority and empty-page continuation", async () => {
  const participant = { id: "executor_peer", executor_identity_id: "executor_peer", name: "Viewer", kind: "client",
    is_self: false, can_execute: false, created_at: "2026-10-12T12:00:00Z" };
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", token: "synthetic",
    fetch: async (url, init) => {
      requests.push({ url: new URL(url), init });
      return new Response(JSON.stringify(requests.length === 1 ? [] : [participant]), {
        headers: { "Content-Type": "application/json", "X-Order": "desc", ...(requests.length === 1 ? { "X-Next-Cursor": "candidate /?&=" } : {}) }
      });
    }
  });
  const first = await client.listSpaceAgentParticipants("space /?&=", { limit: 1, order: "desc" });
  assert.deepEqual(first.items, []);
  assert.equal(first.nextCursor, "candidate /?&=");
  const second = await client.listSpaceAgentParticipants("space /?&=", { limit: 1, order: "desc", cursor: first.nextCursor });
  assert.deepEqual(second.items, [participant]);
  assert.equal(second.nextCursor, null);
  for (const request of requests) {
    assert.equal(request.url.pathname, "/v1/spaces/space%20%2F%3F%26%3D/agent-participants");
    assert.equal(request.url.searchParams.get("limit"), "1");
    assert.equal(request.url.searchParams.get("order"), "desc");
    assert.equal(request.init.method, "GET");
    assert.equal(request.init.body, undefined);
  }
  assert.equal(requests[1].url.searchParams.get("cursor"), first.nextCursor);
  const declarations = readFileSync(new URL("../src/client.d.ts", import.meta.url), "utf8");
  assert.match(declarations, /listSpaceAgentParticipants\([^\n]*CollectionPage<ExecutionParticipant>/);
  assert.match(declarations, /listAgents\([^\n]*CollectionPage<Agent>/);
});
