import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { SwarmClient } from "../src/index.js";
import { summarizeTasks, inspectRuns, publishTaskReview } from "../examples/code-mode/task-review.mjs";

const client = fetch => new SwarmClient({ baseUrl: "https://swarm.invalid", token: "synthetic-code-mode-only", fetch });
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const task = (index, space_id = "sp_review") => ({ id: `task_${index}`, space_id, status: "active", description: "Private source text" });

test("Task example follows empty pages and returns bounded counts and references", async () => {
  const calls = [];
  const summary = await summarizeTasks(client(async url => {
    calls.push(String(url));
    assert.equal(url.searchParams.get("space_id"), "sp_review");
    assert.equal(url.searchParams.get("limit"), "20");
    assert.equal(url.searchParams.get("order"), "asc");
    return calls.length === 1 ? json([], 200, { "X-Next-Cursor": "opaque-first" }) : json([task(1), task(2)]);
  }), "sp_review");
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("cursor=opaque-first"));
  assert.deepEqual(summary, { space_id: "sp_review", observed_tasks: 2, active: 2, canceled: 0,
    pages: 2, complete: true, next_cursor: null, sample_task_ids: ["task_1", "task_2"] });
  assert.ok(!JSON.stringify(summary).includes("Private source text"));
});

test("Task example stops at five pages, detects repeated cursors and rejects foreign scope", async () => {
  let calls = 0;
  const summary = await summarizeTasks(client(async () => json([task(++calls)], 200, { "X-Next-Cursor": `page-${calls}` })), "sp_review");
  assert.equal(calls, 5); assert.equal(summary.complete, false); assert.equal(summary.next_cursor, "page-5");
  await assert.rejects(summarizeTasks(client(async () => json([], 200, { "X-Next-Cursor": "repeated" })), "sp_review"), /repeated cursor/);
  await assert.rejects(summarizeTasks(client(async () => json([task(1, "sp_other")])), "sp_review"), /scope/);
});

test("Run example uses two concurrent reads, preserves order and omits source bodies", async () => {
  let active = 0, peak = 0;
  const result = await inspectRuns(client(async url => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return json({ id: url.pathname.split("/").at(-1), space_id: "sp_review", status: "blocked", goal_summary: "Private source text" });
  }), "sp_review", ["run_1", "run_2", "run_3", "run_4", "run_1"]);
  assert.equal(peak, 2); assert.equal(active, 0);
  assert.deepEqual(result.runs.map(run => run.run_id), ["run_1", "run_2", "run_3", "run_4"]);
  assert.ok(!JSON.stringify(result).includes("Private source text"));
  await assert.rejects(inspectRuns(client(async () => json({ id: "run_1", space_id: "sp_other", status: "queued" })), "sp_review", ["run_1"]), /scope/);
});

test("examples honor pre-cancellation and fail on throttling or denied access without retry", async () => {
  let calls = 0;
  const transport = client(async () => { calls++; return json({ message: "denied" }, 403); });
  await assert.rejects(summarizeTasks(transport, "sp_review", { signal: AbortSignal.abort() }));
  assert.equal(calls, 0);
  await assert.rejects(summarizeTasks(transport, "sp_review"), error => error.status === 403);
  assert.equal(calls, 1);
  await assert.rejects(inspectRuns(client(async () => { calls++; return json({}, 429, { "Retry-After": "30" }); }), "sp_review", ["run_1"]), error => error.status === 429);
  assert.equal(calls, 2);
  await assert.rejects(inspectRuns(transport, "sp_review", Array.from({ length: 9 }, (_, i) => `run_${i}`)));
  assert.equal(calls, 2);
});

test("Run failure cancels the other in-flight read before returning", async () => {
  let canceled = false, calls = 0;
  const transport = client(async (url, { signal }) => {
    calls++;
    if (url.pathname.endsWith("run_1")) return json({}, 403);
    await new Promise((resolve, reject) => signal.addEventListener("abort", () => { canceled = true; reject(signal.reason); }, { once: true }));
  });
  await assert.rejects(inspectRuns(transport, "sp_review", ["run_1", "run_2", "run_3"]), error => error.status === 403);
  assert.equal(canceled, true); assert.equal(calls, 2);
});

test("publication uses only reviewed counts and IDs with an explicit stable retry key", async () => {
  const requests = [], review = { space_id: "sp_review", observed_tasks: 1, active: 1, canceled: 0,
    complete: false, sample_task_ids: ["task_1"], unexpected: "Do not publish this" };
  const transport = client(async (url, request) => { requests.push(request); return json({ id: "art_review", space_id: "sp_review" }, 201); });
  for (let index = 0; index < 2; index++) assert.deepEqual(await publishTaskReview(transport, "sp_review", review, "saved-intent"), { space_id: "sp_review", artifact_id: "art_review" });
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].headers.get("Idempotency-Key"), "saved-intent");
  const body = JSON.parse(requests[0].body).body;
  assert.ok(body.includes("five-page limit")); assert.ok(body.includes("task:task_1"));
  assert.ok(!body.includes("Do not publish this"));
  await assert.rejects(publishTaskReview(transport, "sp_other", review, "saved-intent"));
  await assert.rejects(publishTaskReview(transport, "sp_review", review, ""));
  await assert.rejects(publishTaskReview(transport, "sp_review", { ...review, active: 2 }, "saved-intent"));
  assert.equal(requests.length, 2);
});

test("CLI rejects malformed or oversized publication input without logging credentials or input", () => {
  const canary = "synthetic-private-value-must-not-be-printed";
  for (const input of [canary, "x".repeat(17 * 1024)]) {
    const result = spawnSync(process.execPath, [new URL("../examples/code-mode/task-review.mjs", import.meta.url).pathname, "publish"], {
      input, encoding: "utf8", timeout: 5000,
      env: { PATH: process.env.PATH, SWARM_TOKEN: canary, SWARM_SPACE_ID: "sp_review", SWARM_IDEMPOTENCY_KEY: "review-1" }
    });
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.match(result.stderr, /Swarm review failed/); assert.ok(!result.stderr.includes(canary));
  }
});
