import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import { SwarmClient, executeConnectedCoreAcquisition, runConnectedCoreLoop, SwarmCoreExecutionUncertainError } from "../src/index.js";

const acquisition = { run: { id: "run_synthetic" }, run_lease: { id: "lease_synthetic" } };
function fixture({ failStart = false } = {}) {
  const actions = [];
  return { actions, client: new SwarmClient({ baseUrl: "https://synthetic.invalid", fetch: async (url) => {
    const action = new URL(url).pathname.split("/").at(-1); actions.push(action);
    if (action === "start" && failStart) return Response.json({ error: "denied" }, { status: 403 });
    if (action === "execute") return Response.json({ run: { id: "run_synthetic", status: "succeeded" } });
    if (action === "claim-next") return Response.json(acquisition);
    return Response.json({ id: "lease_synthetic", status: action === "start" ? "running" : "active" });
  } }) };
}

test("observer failure after confirmed success makes no failed completion or release", async () => {
  const { client, actions } = fixture(), failure = new Error("synthetic observer network timeout");
  await assert.rejects(executeConnectedCoreAcquisition(client, acquisition, { onExecution() { throw failure; } }), error => error === failure);
  assert.deepEqual(actions, ["start", "renew", "execute"]);
});

test("loop does not classify an observer timeout as a retryable execution failure", async () => {
  const { client, actions } = fixture(), failure = new Error("synthetic observer network timeout");
  await assert.rejects(runConnectedCoreLoop(client, { onExecution() { throw failure; } }), error => error === failure);
  assert.deepEqual(actions, ["heartbeat", "claim-next", "start", "renew", "execute"]);
});

test("failed initial start no longer leaves the caller abort listener owned", async () => {
  const { client } = fixture({ failStart: true }), controller = new AbortController();
  const before = getEventListeners(controller.signal, "abort").length;
  await assert.rejects(executeConnectedCoreAcquisition(client, acquisition, { signal: controller.signal }), error => error.status === 403);
  assert.equal(getEventListeners(controller.signal, "abort").length, before);
});

test("lost start or execute and runner-required replies never synthesize failure, release or another execute", async (t) => {
  for (const target of ["start", "execute", "runner_required"]) {
    await t.test(target, async () => {
      const actions = [];
      const client = new SwarmClient({ baseUrl: "https://synthetic.invalid", fetch: async (url) => {
        const action = new URL(url).pathname.split("/").at(-1); actions.push(action);
        if (action === target) throw new Error("synthetic lost response");
        if (action === "execute" && target === "runner_required") return Response.json({ requires_runner: true, run: { id: "run_synthetic", status: "running" } });
        return Response.json({ id: "lease_synthetic", status: "active" });
      } });
      await assert.rejects(executeConnectedCoreAcquisition(client, acquisition), error => {
        assert.ok(error instanceof SwarmCoreExecutionUncertainError);
        assert.equal(error.stage, target); assert.equal(error.runId, "run_synthetic");
        assert.equal(error.leaseId, "lease_synthetic"); assert.equal(error.retryable, false);
        assert.equal(error.cause, undefined);
        return true;
      });
      assert.equal(actions.includes("complete"), false);
      assert.equal(actions.includes("release"), false);
      assert.ok(actions.filter(action => action === "execute").length <= 1);
    });
  }
});
