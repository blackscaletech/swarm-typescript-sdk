import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

test("Run Group list query retains filters, static route and page cursors", async () => {
  const requests = [];
  const client = new SwarmClient({ baseUrl: "https://swarm.example", token: "synthetic",
    fetch: async (url, init) => {
      requests.push({ url: new URL(url), init });
      return new Response(JSON.stringify([{ id: "run_1", run_group_id: "group /?&=" }]), {
        headers: { "Content-Type": "application/json", "X-Next-Cursor": "cursor /?&=", "X-Order": "desc" }
      });
    }
  });
  const query = { space_id: "space_1", run_group_id: "group /?&=", task_id: "task_1",
    automation_profile_id: "profile_1", status: "queued", limit: 2, order: "desc" };
  const page = await client.listRuns(query);
  assert.equal(page.items[0].id, "run_1");
  assert.equal(page.nextCursor, "cursor /?&=");
  assert.equal(page.order, "desc");
  await client.listRuns({ ...query, cursor: page.nextCursor });
  for (const request of requests) {
    assert.equal(request.url.pathname, "/v1/runs");
    assert.equal(request.url.hash, "");
    assert.equal(request.init.method, "GET");
    assert.equal(request.init.body, undefined);
    for (const [key, value] of Object.entries(query)) assert.equal(request.url.searchParams.get(key), String(value));
  }
  assert.equal(requests[1].url.searchParams.get("cursor"), page.nextCursor);
  await client.listRuns({ run_group_id: "group_1", limit: 2 });
  assert.equal(requests[2].url.searchParams.get("run_group_id"), "group_1");
  assert.equal(requests[2].url.searchParams.has("space_id"), false);
  assert.equal(query.cursor, undefined);
  const types = readFileSync(new URL("../src/client.d.ts", import.meta.url), "utf8");
  assert.match(types, /listRuns\(query\?[^\n]*run_group_id\?: string/);
});
