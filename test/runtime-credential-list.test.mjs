import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

test("runtime credential inventory stays one bounded server page with exact continuation and filters", async () => {
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", fetch: async (url, init) => {
    requests.push({ url: new URL(url), init });
    return Response.json([{ id: requests.length === 1 ? "cred_first" : "cred_last" }], {
      headers: requests.length === 1 ? { "X-Next-Cursor": "cursor /?&=", "X-Order": "asc" } : { "X-Order": "asc" }
    });
  } });
  const query = { active_only: true, limit: 2, order: "asc" };
  const first = await client.listAgentRuntimeCredentials("agt /?&=", query);
  assert.deepEqual(first.items, [{ id: "cred_first" }]);
  assert.equal(first.nextCursor, "cursor /?&=");
  assert.equal(first.order, "asc");
  assert.equal(requests.length, 1, "a list call must not silently hydrate the complete history");
  const last = await client.listAgentRuntimeCredentials("agt /?&=", { ...query, cursor: first.nextCursor });
  assert.deepEqual(last.items, [{ id: "cred_last" }]);
  assert.equal(last.nextCursor, null);
  assert.equal(requests[0].url.pathname, "/v1/agents/agt%20%2F%3F%26%3D/runtime-credentials");
  assert.equal(requests[0].url.searchParams.get("active_only"), "true");
  assert.equal(requests[1].url.searchParams.get("cursor"), first.nextCursor);
  assert.equal(query.cursor, undefined);
  for (const { init, url } of requests) { assert.equal(init.method, "GET"); assert.equal(init.body, undefined); assert.equal(url.hash, ""); }
});

test("older array responses without continuation headers remain readable", async () => {
  const client = new SwarmClient({ baseUrl: "https://swarm.example", fetch: async () => Response.json([]) });
  const page = await client.listAgentRuntimeCredentials("agt_legacy", { active_only: false });
  assert.deepEqual(page.items, []);
  assert.equal(page.nextCursor, null);
});
