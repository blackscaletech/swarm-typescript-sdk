import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import {
  SwarmClient, SwarmAPIError, executeAgentAcquisition, runAgentOnce, runAgentLoop
} from "../src/index.js";
import * as runtime from "@blackscaletech/swarm-sdk/agent-runtime";

function acquisition(index = 1, durationMs = 60_000) {
  return {
    run: {
      id: `run_${index}`, space_id: "sp_1", run_group_id: "rg_1", status: "leased",
      run_lease_id: `lease_${index}`, run_requirements: { execution_mode: "agent" }
    },
    run_lease: {
      id: `lease_${index}`, run_id: `run_${index}`, core_id: "", status: "active",
      expires_at: new Date(Date.now() + durationMs).toISOString()
    }
  };
}

function runContext(index = 1) {
  return {
    run: { ...acquisition(index).run, status: "running" },
    run_group: { id: "rg_1", space_id: "sp_1", goal_summary: "Compare the source evidence" },
    context_refs: [{
      ref: { resource_type: "artifact", resource_id: "art_source" },
      artifact: { artifact: { id: "art_source" }, body: "Primary source evidence", body_truncated: false }
    }],
    extra_server_context: { preserved: true }
  };
}

function harness(handle, { durationMs = 60_000 } = {}) {
  const requests = [];
  const client = new SwarmClient({
    baseUrl: "https://swarm.example", token: "synthetic", timeoutMs: 1000,
    fetch: async (url, init) => {
      const req = {
        path: new URL(url).pathname,
        body: init.body ? JSON.parse(init.body) : undefined,
        key: init.headers.get("Idempotency-Key"), signal: init.signal
      };
      requests.push(req);
      const response = await handle?.(req, requests);
      if (response !== undefined) return response;
      const index = Number(req.path.match(/(?:run|lease)_(\d+)/)?.[1] ?? 1);
      if (req.path.endsWith("runs:claim-next")) return Response.json({ ...acquisition(index, durationMs), idle: false });
      if (req.path.endsWith("/start")) return Response.json({ ...acquisition(index).run, status: "running" });
      if (req.path.endsWith("/context")) return Response.json(runContext(index));
      if (req.path.endsWith("/renew")) return Response.json(acquisition(index, durationMs).run_lease);
      if (req.path.endsWith("/complete")) return Response.json({ ...acquisition(index).run, status: req.body.outcome });
      if (req.path.endsWith("/release")) return Response.json({ ...acquisition(index).run_lease, status: "released" });
      assert.fail(`Unexpected route: ${req.path}`);
    }
  });
  return { client, requests };
}

const options = (extra = {}) => ({ spaceId: "sp_1", execute: () => ({ body: "Source-grounded result" }), ...extra });
const calls = (requests, suffix) => requests.filter(req => req.path.endsWith(suffix));
const problem = (status, error = "revoked") => Response.json({ error }, { status });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

test("primary and subpath exports share the host runtime", () => {
  assert.equal(runtime.executeAgentAcquisition, executeAgentAcquisition);
  assert.equal(runtime.runAgentOnce, runAgentOnce);
  assert.equal(runtime.runAgentLoop, runAgentLoop);
});

test("host execution receives the entire source-bearing context and exact connection", async () => {
  const { client, requests } = harness();
  const once = await runAgentOnce(client, options({ execute: ctx => {
    assert.equal(ctx.client, client);
    assert.equal(ctx.spaceId, "sp_1");
    assert.equal(ctx.run, ctx.context.run);
    assert.equal(ctx.context.run_group.goal_summary, "Compare the source evidence");
    assert.equal(ctx.context.context_refs[0].artifact.body, "Primary source evidence");
    assert.deepEqual(ctx.context.extra_server_context, { preserved: true });
    assert.equal(ctx.runLease.id, "lease_1");
    return { body: "Actual answer", title: "Source review", media_type: "text/markdown" };
  } }));
  assert.equal(once.execution.run.status, "succeeded");
  assert.equal(once.execution.result.body, "Actual answer");
  assert.deepEqual(requests.map(req => req.path), [
    "/v1/spaces/sp_1/runs:claim-next", "/v1/runs/run_1/start",
    "/v1/run-leases/lease_1/renew", "/v1/runs/run_1/context", "/v1/runs/run_1/complete"
  ]);
  assert.deepEqual(calls(requests, "/start")[0].body, { lease_id: "lease_1" });
  assert.deepEqual(calls(requests, "/complete")[0].body, {
    lease_id: "lease_1", outcome: "succeeded", body: "Actual answer", title: "Source review", media_type: "text/markdown"
  });
  assert.ok(requests.filter(req => req.body).every(req => req.key));
});

test("serial loop executes repeat intents with the same source in distinct Runs and follows all pages", async () => {
  const stop = new AbortController();
  const reason = new Error("finished");
  let claims = 0;
  let active = 0;
  let executions = 0;
  const { client, requests } = harness(req => {
    if (!req.path.endsWith("runs:claim-next")) return;
    claims += 1;
    if (claims === 1) return Response.json({ idle: true, next_cursor: "page_2", retry_after_ms: 0 });
    return Response.json({ ...acquisition(claims - 1), idle: false, next_cursor: `page_${claims + 1}` });
  });
  await assert.rejects(runAgentLoop(client, options({ signal: stop.signal,
    async execute(ctx) {
      assert.equal(++active, 1);
      assert.equal(ctx.context.context_refs[0].artifact.body, "Primary source evidence");
      executions += 1;
      await flush();
      active -= 1;
      return { body: `Result ${executions}` };
    },
    onExecution() { if (executions === 2) stop.abort(reason); }
  })), error => error === reason);
  assert.equal(executions, 2);
  assert.deepEqual(calls(requests, "runs:claim-next").map(req => req.body.cursor), [undefined, "page_2", "page_3"]);
  assert.equal(new Set(calls(requests, "runs:claim-next").map(req => req.key)).size, 3);
  assert.deepEqual(calls(requests, "/complete").map(req => req.body.lease_id), ["lease_1", "lease_2"]);
  assert.notEqual(calls(requests, "/complete")[0].key, calls(requests, "/complete")[1].key);
  assert.equal(calls(requests, "/release").length, 0);
  assert.equal(getEventListeners(stop.signal, "abort").length, 0);
});

test("slow polls preserve the tail between timed head revisits", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const stop = new AbortController();
  const { client, requests } = harness(() => Response.json({ idle: true, next_cursor: "tail", retry_after_ms: 0 }));
  let pages = 0;
  await assert.rejects(runAgentLoop(client, options({ signal: stop.signal, headRevisitIntervalMs: 30_000,
    onIdle() {
      t.mock.timers.tick(31_000);
      if (++pages === 5) stop.abort(new Error("finished"));
    }
  })), /finished/);
  assert.deepEqual(calls(requests, "runs:claim-next").map(req => req.body.cursor), [undefined, undefined, "tail", undefined, "tail"]);
});

test("once preserves idle cursor and retry hint without executing", async () => {
  const { client, requests } = harness(() => Response.json({ idle: true, next_cursor: "more", retry_after_ms: 12 }));
  const result = await runAgentOnce(client, options({ cursor: "previous", execute: () => assert.fail("idle adapter") }));
  assert.deepEqual(result, { claim: { idle: true, next_cursor: "more", retry_after_ms: 12 }, execution: null });
  assert.deepEqual(requests[0].body, { ttl_seconds: 60, cursor: "previous" });
});

test("known claim capacity conflicts wait, preserve the page and resume with a fresh intent", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const stop = new AbortController();
  let claims = 0;
  const { client, requests } = harness(req => {
    if (!req.path.endsWith("runs:claim-next")) return;
    if (++claims === 1) return Response.json({ idle: true, next_cursor: "tail", retry_after_ms: 0 });
    if (claims === 2) return Response.json({ code: "lease_capacity_reached", retryable: true,
      retry_after_ms: 2500 }, { status: 409 });
  });
  const running = runAgentLoop(client, options({ signal: stop.signal,
    onExecution: () => stop.abort(new Error("finished")) }));
  const rejected = assert.rejects(running, /finished/);
  await flush();
  assert.equal(claims, 2);
  assert.equal(calls(requests, "/start").length, 0);
  t.mock.timers.tick(2499);
  await flush();
  assert.equal(claims, 2);
  t.mock.timers.tick(1);
  await rejected;
  const polls = calls(requests, "runs:claim-next");
  assert.deepEqual(polls.map(req => req.body.cursor), [undefined, "tail", "tail"]);
  assert.equal(new Set(polls.map(req => req.key)).size, 3);
  assert.equal(calls(requests, "/complete").length, 1);
});

test("capacity compatibility is claim-only and all other 409 conflicts remain terminal", async () => {
  for (const code of ["lease_expired", "lease_conflict", "idempotency_conflict", undefined]) {
    const { client, requests } = harness(() => Response.json({ code, retryable: true }, { status: 409 }));
    await assert.rejects(runAgentLoop(client, options()), error => error.status === 409);
    assert.equal(requests.length, 1);
  }
  const { client, requests } = harness(req => req.path.endsWith("/renew")
    ? Response.json({ code: "lease_capacity_reached" }, { status: 409 }) : undefined);
  await assert.rejects(runAgentLoop(client, options()), error => error.status === 409);
  assert.equal(calls(requests, "runs:claim-next").length, 1);
  assert.equal(calls(requests, "/complete").length, 0);
});

test("capacity waits are bounded and cancelable without another claim", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const stop = new AbortController();
  const { client, requests } = harness(() => Response.json({ code: "lease_capacity_reached",
    retry_after_ms: 1_000_000 }, { status: 409 }));
  const running = runAgentLoop(client, options({ signal: stop.signal }));
  const rejected = assert.rejects(running, /stop/);
  await flush();
  t.mock.timers.tick(29_999);
  await flush();
  assert.equal(requests.length, 1);
  stop.abort(new Error("stop"));
  await rejected;
  assert.equal(requests.length, 1);
});

test("loop honors bounded idle hints and configurable head revisit", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const stop = new AbortController();
  let claims = 0;
  const { client, requests } = harness(() => {
    claims += 1;
    return Response.json({ idle: true, next_cursor: `page_${claims}`, retry_after_ms: 1_000_000 });
  });
  const running = runAgentLoop(client, options({ signal: stop.signal, headRevisitIntervalMs: 10_000 }));
  const rejected = assert.rejects(running, /stop/);
  await flush();
  assert.equal(claims, 1);
  t.mock.timers.tick(29_999);
  await flush();
  assert.equal(claims, 1);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(claims, 2);
  assert.deepEqual(requests.map(req => req.body.cursor), [undefined, undefined]);
  stop.abort(new Error("stop"));
  await rejected;
});

test("queue tail without a cursor resets to the head", async () => {
  const stop = new AbortController();
  let count = 0;
  const { client, requests } = harness(() => Response.json({ idle: true, retry_after_ms: 0 }));
  await assert.rejects(runAgentLoop(client, options({ signal: stop.signal,
    onIdle() { if (++count === 2) stop.abort(new Error("stop")); }
  })), /stop/);
  assert.deepEqual(requests.map(req => req.body.cursor), [undefined, undefined]);
  assert.notEqual(requests[0].key, requests[1].key);
});

test("429/503 claim retries keep the exact request intent and bounded Retry-After", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let count = 0;
  const { client, requests } = harness(() => {
    count += 1;
    if (count <= 2) return Response.json({ retry_after_ms: 1_000_000 }, {
      status: count === 1 ? 429 : 503, headers: { "Retry-After": "1000000" }
    });
    return Response.json({ idle: true });
  });
  const running = runAgentOnce(client, options({ cursor: "scan" }));
  await flush();
  t.mock.timers.tick(29_999);
  await flush();
  assert.equal(count, 1);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(count, 2);
  t.mock.timers.tick(30_000);
  await flush();
  assert.equal((await running).execution, null);
  assert.equal(count, 3);
  assert.equal(new Set(requests.map(req => req.key)).size, 1);
  assert.ok(requests.every(req => JSON.stringify(req.body) === JSON.stringify(requests[0].body)));
});

test("acquired Space mismatch fails closed before any adapter/start/context", async () => {
  const { client, requests } = harness();
  const acquired = acquisition();
  acquired.run.space_id = "different_space";
  await assert.rejects(executeAgentAcquisition(client, acquired, options({ execute: () => assert.fail("adapter") })), /explicit Space/);
  assert.deepEqual(requests.map(req => req.path), ["/v1/run-leases/lease_1/release"]);
});

for (const stage of ["start", "context", "renew"]) {
  for (const status of [401, 403, 409]) {
    test(`${stage} ${status} fails closed and releases, including initialization failures`, async () => {
      const { client, requests } = harness(req => {
        if (req.path.endsWith(`/${stage}`)) return problem(status, "lease_revoked");
        if (req.path.endsWith("/release")) return problem(503, "release unavailable");
      });
      await assert.rejects(runAgentLoop(client, options({ execute: () => assert.fail("adapter") })),
        error => error instanceof SwarmAPIError && error.status === status);
      assert.equal(calls(requests, "runs:claim-next").length, 1);
      assert.equal(calls(requests, `/${stage}`).length, 1);
      assert.equal(calls(requests, "/complete").length, 0);
      assert.equal(calls(requests, "/release").length, 1);
      assert.equal(calls(requests, "/release")[0].path, "/v1/run-leases/lease_1/release");
    });
  }
}

test("context Run/lease/Space mismatch never reaches adapter or completion", async () => {
  for (const mutation of [
    run => { run.space_id = "sp_2"; },
    run => { run.run_lease_id = "stale_lease"; },
    run => { delete run.run_lease_id; },
    run => { run.id = "another_run"; },
    run => { run.stop_requested_at = new Date().toISOString(); }
  ]) {
    const { client, requests } = harness(req => {
      if (req.path.endsWith("/context")) {
        const context = runContext();
        mutation(context.run);
        return Response.json(context);
      }
    });
    await assert.rejects(runAgentOnce(client, options({ execute: () => assert.fail("adapter") })), /Space|stopped/);
    assert.equal(calls(requests, "/complete").length, 0);
    assert.equal(calls(requests, "/release").length, 1);
  }
});

test("initial renewal transport failure aborts without retry or execution", async () => {
  const { client, requests } = harness(req => req.path.endsWith("/renew") ? problem(503) : undefined);
  await assert.rejects(runAgentOnce(client, options({ execute: () => assert.fail("adapter") })),
    error => error instanceof SwarmAPIError && error.status === 503);
  assert.equal(calls(requests, "/renew").length, 1);
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
});

test("renewal revocation aborts the adapter and late success cannot publish", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const lateResult = deferred();
  let renewals = 0;
  let adapterSignal;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/renew") && ++renewals === 2) return problem(403, "credential_revoked");
  }, { durationMs: 90 });
  const running = runAgentOnce(client, options({ execute: ctx => {
    adapterSignal = ctx.signal;
    return lateResult.promise;
  } }));
  const rejected = assert.rejects(running, error => error instanceof SwarmAPIError && error.status === 403);
  await flush();
  assert.equal(adapterSignal.aborted, false);
  t.mock.timers.tick(30);
  await flush();
  await rejected;
  assert.equal(adapterSignal.aborted, true);
  lateResult.resolve({ body: "Late success" });
  await flush();
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
  assert.equal(getEventListeners(adapterSignal, "abort").length, 0);
});

test("adapter returning during in-flight renewal must await its fence, not publish stale completion", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const result = deferred();
  const renewResponse = deferred();
  let renewals = 0;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/renew") && ++renewals === 2) return renewResponse.promise;
  }, { durationMs: 90 });
  const running = runAgentOnce(client, options({ execute: () => result.promise }));
  const rejected = assert.rejects(running, error => error instanceof SwarmAPIError && error.status === 409);
  await flush();
  t.mock.timers.tick(30);
  await flush();
  result.resolve({ body: "Would-be success" });
  await flush();
  assert.equal(calls(requests, "/complete").length, 0);
  renewResponse.resolve(problem(409, "lease_conflict"));
  await rejected;
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
});

test("renewal failure also cancels a pending context fetch", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let renewals = 0;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/renew") && ++renewals === 2) return problem(403);
    if (req.path.endsWith("/context")) return new Promise(() => {});
  }, { durationMs: 90 });
  const running = runAgentOnce(client, options({ execute: () => assert.fail("adapter") }));
  const rejected = assert.rejects(running, error => error instanceof SwarmAPIError && error.status === 403);
  await flush();
  t.mock.timers.tick(30);
  await rejected;
  assert.equal(calls(requests, "/context")[0].signal.aborted, true);
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
});

test("lease expiry cancels stalled renewal and execution without publishing", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let renewals = 0;
  let adapterSignal;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/renew") && ++renewals === 2) return new Promise(() => {});
  }, { durationMs: 90 });
  const running = runAgentOnce(client, options({ execute: ctx => {
    adapterSignal = ctx.signal;
    return new Promise(() => {});
  } }));
  const rejected = assert.rejects(running, /lease expired/);
  await flush();
  t.mock.timers.tick(30);
  await flush();
  t.mock.timers.tick(60);
  await rejected;
  assert.equal(adapterSignal.aborted, true);
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
});

test("cancellation releases using a fresh signal and preserves the original reason", async () => {
  const stop = new AbortController();
  const reason = new Error("host canceled");
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/release")) {
      assert.equal(req.signal.aborted, false);
      return problem(503, "cleanup unavailable");
    }
  });
  await assert.rejects(runAgentOnce(client, options({ signal: stop.signal, execute: () => {
    stop.abort(reason);
    return { body: "Not a real success" };
  } })), error => error === reason);
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
  assert.equal(getEventListeners(stop.signal, "abort").length, 0);
});

test("already-aborted once does not claim; already-aborted exact acquisition still releases", async () => {
  const stop = new AbortController();
  stop.abort(new Error("already stopped"));
  const { client, requests } = harness();
  await assert.rejects(runAgentOnce(client, options({ signal: stop.signal })), /already stopped/);
  assert.equal(requests.length, 0);
  await assert.rejects(executeAgentAcquisition(client, acquisition(), options({ signal: stop.signal })), /already stopped/);
  assert.deepEqual(requests.map(req => req.path), ["/v1/run-leases/lease_1/release"]);
});

test("release has an independent bounded deadline even for a transport ignoring cancellation", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const reason = new Error("primary start error");
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/start")) throw reason;
    if (req.path.endsWith("/release")) return new Promise(() => {});
  });
  const running = executeAgentAcquisition(client, acquisition(), options({ cleanupTimeoutMs: 20 }));
  const rejected = assert.rejects(running, error => error === reason);
  await flush();
  t.mock.timers.tick(20);
  await rejected;
  assert.equal(calls(requests, "/release")[0].signal.aborted, true);
});

test("generic callback failure reports sanitized failure, not retryable polling", async () => {
  for (const message of ["adapter failed", "fetch network timed out inside adapter"]) {
    const error = new Error(message);
    const { client, requests } = harness();
    await assert.rejects(runAgentLoop(client, options({ execute: () => { throw error; } })), actual => actual === error);
    assert.equal(calls(requests, "runs:claim-next").length, 1);
    assert.deepEqual(calls(requests, "/complete").map(req => req.body), [{ lease_id: "lease_1", outcome: "failed" }]);
    assert.equal(calls(requests, "/release").length, 0);
  }
});

test("callback API status is not a retryable loop error and does not publish", async () => {
  const error = new SwarmAPIError("network unavailable", { status: 503 });
  const { client, requests } = harness();
  await assert.rejects(runAgentLoop(client, options({ execute: () => { throw error; } })), actual => actual === error);
  assert.equal(calls(requests, "runs:claim-next").length, 1);
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
});

test("failure reporting and release errors never replace the callback error", async () => {
  const error = new Error("adapter error must stay primary");
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/complete") || req.path.endsWith("/release")) return problem(503);
  });
  await assert.rejects(runAgentOnce(client, options({ retryLimit: 0, execute: () => { throw error; } })), actual => actual === error);
  assert.equal(calls(requests, "/complete").length, 1);
  assert.equal(calls(requests, "/release").length, 1);
});

test("empty/invalid adapter results cannot counterfeit a succeeded Run", async () => {
  for (const result of [undefined, {}, { body: " \n" }, { body: 42 }, { outcome: "unknown" }]) {
    const { client, requests } = harness();
    await assert.rejects(runAgentOnce(client, options({ execute: () => result })), /result|outcome/);
    assert.deepEqual(calls(requests, "/complete").map(req => req.body), [{ lease_id: "lease_1", outcome: "failed" }]);
  }
  const { client, requests } = harness();
  assert.equal((await runAgentOnce(client, options({ execute: () => ({ outcome: "failed" }) }))).execution.run.status, "failed");
  assert.equal(calls(requests, "/complete")[0].body.body, undefined);
});

test("explicit adapter cancellation completes canceled with an optional actual body", async () => {
  for (const result of [{ outcome: "canceled" }, { outcome: "canceled", body: "Host declined this work", title: "Canceled" }]) {
    const { client, requests } = harness();
    const once = await runAgentOnce(client, options({ execute: () => result }));
    assert.equal(once.execution.run.status, "canceled");
    assert.deepEqual(calls(requests, "/complete").map(req => req.body), [{ lease_id: "lease_1", ...result }]);
    assert.equal(calls(requests, "/release").length, 0);
  }
});

test("an aborted adapter cannot publish even an explicit canceled outcome", async () => {
  const stop = new AbortController();
  const reason = new Error("work aborted");
  const { client, requests } = harness();
  await assert.rejects(runAgentOnce(client, options({ signal: stop.signal, execute: () => {
    stop.abort(reason);
    return { outcome: "canceled" };
  } })), error => error === reason);
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release").length, 1);
});

test("lost terminal response retries only the same completion, never the adapter", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let completions = 0;
  let executions = 0;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/complete") && ++completions === 1) throw new TypeError("fetch network response lost after commit");
  });
  const running = runAgentOnce(client, options({ execute: () => { executions += 1; return { body: "Committed result" }; } }));
  await flush();
  assert.equal(completions, 1);
  t.mock.timers.tick(250);
  await flush();
  assert.equal((await running).execution.run.status, "succeeded");
  assert.equal(executions, 1);
  assert.equal(calls(requests, "runs:claim-next").length, 1);
  assert.equal(calls(requests, "/complete").length, 2);
  assert.equal(calls(requests, "/complete")[0].key, calls(requests, "/complete")[1].key);
  assert.deepEqual(calls(requests, "/complete")[0].body, calls(requests, "/complete")[1].body);
});

test("exhausted lost completion terminates loop with uncertain outcome, never reclaims", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const error = new TypeError("fetch terminal response lost");
  let executions = 0;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/complete")) throw error;
    if (req.path.endsWith("/release")) return problem(409, "already terminal");
  });
  const running = runAgentLoop(client, options({ retryLimit: 1, execute: () => { executions += 1; return { body: "Committed result" }; } }));
  const rejected = assert.rejects(running, actual => actual === error);
  await flush();
  t.mock.timers.tick(250);
  await rejected;
  assert.equal(executions, 1);
  assert.equal(calls(requests, "runs:claim-next").length, 1);
  assert.equal(calls(requests, "/complete").length, 2);
  assert.equal(new Set(calls(requests, "/complete").map(req => req.key)).size, 1);
  assert.equal(calls(requests, "/release").length, 1);
});

test("start retry retains the exact lease and own intent", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let starts = 0;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/start") && ++starts === 1) return problem(503);
  });
  const running = runAgentOnce(client, options());
  await flush();
  t.mock.timers.tick(250);
  await running;
  const attempts = calls(requests, "/start");
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].key, attempts[1].key);
  assert.deepEqual(attempts[0].body, attempts[1].body);
  assert.equal(attempts[0].body.lease_id, "lease_1");
});

test("success and failure clear all helper/request timers and abort listeners", async t => {
  const active = new Set();
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, ms, ...args) => {
    const timer = originalSet(() => { active.delete(timer); callback(...args); }, ms);
    active.add(timer);
    return timer;
  });
  t.mock.method(globalThis, "clearTimeout", timer => { active.delete(timer); originalClear(timer); });
  const stop = new AbortController();
  const { client } = harness();
  await runAgentOnce(client, options({ signal: stop.signal }));
  assert.equal(active.size, 0);
  assert.equal(getEventListeners(stop.signal, "abort").length, 0);
  await assert.rejects(runAgentOnce(client, options({ signal: stop.signal, execute: () => { throw new Error("failure"); } })), /failure/);
  assert.equal(active.size, 0);
  assert.equal(getEventListeners(stop.signal, "abort").length, 0);
});

test("options reject missing scope/callback and unbounded settings before claiming", async () => {
  const { client, requests } = harness();
  for (const input of [{ execute() {} }, { spaceId: "sp_1" }, options({ ttlSeconds: 3601 }), options({ retryLimit: 6 })]) {
    await assert.rejects(runAgentOnce(client, input));
  }
  for (const input of [options({ headRevisitIntervalMs: 0 }), options({ headRevisitIntervalMs: 3_600_001 }), options({ pollIntervalMs: 30_001 })]) {
    await assert.rejects(runAgentLoop(client, input));
  }
  assert.equal(requests.length, 0);
});

for (const stage of ["start", "context"]) {
  test(`exhausted ${stage} transport failure never becomes an outer-loop polling retry`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
    const { client, requests } = harness(req => req.path.endsWith(`/${stage}`) ? problem(503) : undefined);
    const running = runAgentLoop(client, options({ retryLimit: 1, execute: () => assert.fail("adapter") }));
    const rejected = assert.rejects(running, error => error instanceof SwarmAPIError && error.status === 503);
    await flush();
    t.mock.timers.tick(250);
    await rejected;
    assert.equal(calls(requests, `/${stage}`).length, 2);
    assert.equal(calls(requests, "runs:claim-next").length, 1);
    assert.equal(calls(requests, "/complete").length, 0);
    assert.equal(calls(requests, "/release").length, 1);
  });
}

test("fresh successful renewal requests have distinct intents while retaining the exact lease", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const result = deferred();
  const { client, requests } = harness(undefined, { durationMs: 90 });
  const running = runAgentOnce(client, options({ execute: () => result.promise }));
  await flush();
  t.mock.timers.tick(30);
  await flush();
  t.mock.timers.tick(30);
  await flush();
  result.resolve({ body: "Longer host result" });
  await running;
  const renewals = calls(requests, "/renew");
  assert.equal(renewals.length, 3);
  assert.equal(new Set(renewals.map(req => req.key)).size, 3);
  assert.ok(renewals.every(req => req.path === "/v1/run-leases/lease_1/renew" && req.body.ttl_seconds === 60));
});

test("renewal response ownership mismatch aborts instead of accepting success", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let renewals = 0;
  const { client, requests } = harness(req => {
    if (req.path.endsWith("/renew") && ++renewals === 2) {
      return Response.json({ ...acquisition(1, 90).run_lease, id: "replacement_lease" });
    }
  }, { durationMs: 90 });
  const running = runAgentOnce(client, options({ execute: () => new Promise(() => {}) }));
  const rejected = assert.rejects(running, /ownership/);
  await flush();
  t.mock.timers.tick(30);
  await rejected;
  assert.equal(calls(requests, "/complete").length, 0);
  assert.equal(calls(requests, "/release")[0].path, "/v1/run-leases/lease_1/release");
});

test("loop callbacks are abortable and their failures are never retried", async () => {
  const stop = new AbortController();
  const entered = deferred();
  const { client, requests } = harness(req => req.path.endsWith("runs:claim-next") ? Response.json({ idle: true }) : undefined);
  const running = runAgentLoop(client, options({ signal: stop.signal, onIdle() {
    entered.resolve();
    return new Promise(() => {});
  } }));
  const rejected = assert.rejects(running, /idle canceled/);
  await entered.promise;
  stop.abort(new Error("idle canceled"));
  await rejected;
  assert.equal(requests.length, 1);
  assert.equal(getEventListeners(stop.signal, "abort").length, 0);

  const executionHarness = harness();
  const error = new SwarmAPIError("callback fetch unavailable", { status: 503 });
  await assert.rejects(runAgentLoop(executionHarness.client, options({ onExecution() { throw error; } })), actual => actual === error);
  assert.equal(calls(executionHarness.requests, "runs:claim-next").length, 1);
  assert.equal(calls(executionHarness.requests, "/complete").length, 1);
});

test("loop holds its explicit Space fixed even if the caller mutates its options", async () => {
  const stop = new AbortController();
  const { client, requests } = harness(req => req.path.endsWith("runs:claim-next") ? Response.json({ idle: true, retry_after_ms: 0 }) : undefined);
  let count = 0;
  const input = options({ signal: stop.signal, onIdle() {
    input.spaceId = "sp_2";
    if (++count === 2) stop.abort(new Error("stop"));
  } });
  await assert.rejects(runAgentLoop(client, input), /stop/);
  assert.ok(requests.every(req => req.path === "/v1/spaces/sp_1/runs:claim-next"));
});

test("malformed acquired queue page releases its known lease before rejecting", async () => {
  const { client, requests } = harness(req => req.path.endsWith("runs:claim-next") ? Response.json(acquisition()) : undefined);
  await assert.rejects(runAgentOnce(client, options({ execute: () => assert.fail("adapter") })), /invalid queue page/);
  assert.equal(calls(requests, "/release").length, 1);
  assert.equal(calls(requests, "/start").length, 0);
});
