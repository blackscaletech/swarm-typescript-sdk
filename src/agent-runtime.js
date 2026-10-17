import { SwarmAPIError, SwarmClientBase } from "./client-core.js";
import { createTimedAbortSignal } from "./event-stream.js";
import { computeLoopDelayMs, linkedAbortController, sleep } from "./runtime-utils.js";

const MAX_DELAY_MS = 30_000;

function boundedNumber(value, fallback, min, max, name) {
  const number = value ?? fallback;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function optionsFor(client, input = {}) {
  if (!(client instanceof SwarmClientBase)) {
    throw new Error("Agent execution requires a SwarmClient instance");
  }
  if (typeof input.spaceId !== "string" || !input.spaceId.trim()) {
    throw new Error("Agent execution requires an explicit spaceId");
  }
  if (typeof input.execute !== "function") {
    throw new Error("Agent execution requires a host execute callback");
  }
  return {
    ...input,
    ttlSeconds: boundedNumber(input.ttlSeconds, 60, 1, 3600, "ttlSeconds"),
    retryLimit: boundedNumber(input.retryLimit, 2, 0, 5, "retryLimit"),
    retryBaseMs: boundedNumber(input.retryBaseMs, 250, 250, MAX_DELAY_MS, "retryBaseMs"),
    retryBudgetMs: boundedNumber(input.retryBudgetMs, 150_000, 1, 2147483647, "retryBudgetMs"),
    cleanupTimeoutMs: boundedNumber(input.cleanupTimeoutMs, 5000, 1, MAX_DELAY_MS, "cleanupTimeoutMs")
  };
}

function throwIfAborted(signal) {
  signal?.throwIfAborted();
}

// Late adapter results cannot escape the ownership fence, even if the adapter
// ignores cancellation. The host must honor the signal to stop its own work.
function withAbort(operation, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => {
      throwIfAborted(signal);
      return operation();
    }).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

function retryable(error) {
  if (error instanceof SwarmAPIError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  if (error?.name === "AbortError") return false;
  return /econn|fetch|network|socket|timed out|timeout/i.test(
    `${error?.name || ""} ${error?.message || ""}`
  );
}

function retryHintMs(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_DELAY_MS, Math.max(0, value))
    : null;
}

function errorDelayMs(error, attempt, baseMs) {
  const hint = retryHintMs(error?.body?.retry_after_ms);
  const header = error?.headers?.["retry-after"];
  const seconds = header === undefined || header === "" ? NaN : Number(header);
  const date = typeof header === "string" ? Date.parse(header) : NaN;
  const headerMs = Number.isFinite(seconds) ? seconds * 1000 : date - Date.now();
  return Math.min(MAX_DELAY_MS, Math.max(
    computeLoopDelayMs(attempt, baseMs), hint ?? 0,
    Number.isFinite(headerMs) ? Math.max(0, headerMs) : 0
  ));
}

async function request(operation, options, signal, idempotencyKey) {
  const budget = createTimedAbortSignal(signal, options.retryBudgetMs, "Swarm operation retry budget exceeded");
  try {
    for (let attempt = 0; ; attempt += 1) {
      throwIfAborted(budget.signal);
      try {
        return await withAbort(() => operation({ signal: budget.signal, ...(idempotencyKey ? { idempotencyKey } : {}) }), budget.signal);
      } catch (error) {
        throwIfAborted(budget.signal);
        if (!retryable(error) || attempt >= options.retryLimit) throw error;
        await sleep(errorDelayMs(error, attempt, options.retryBaseMs), budget.signal);
      }
    }
  } finally {
    budget.cleanup();
  }
}

function newIntent() {
  return `swarm-agent-${globalThis.crypto.randomUUID()}`;
}

function assertRun(run, runId, spaceId, leaseId) {
  if (run?.id !== runId || run.space_id !== spaceId || (leaseId && run.run_lease_id !== leaseId)) {
    throw new Error("Agent Run does not match the acquired Run and explicit Space");
  }
}

function assertLease(lease, runId, leaseId) {
  if (lease?.id !== leaseId || lease.run_id !== runId || lease.status !== "active" || lease.core_id) {
    throw new Error("Agent lease ownership is no longer active or does not match the acquisition");
  }
  const remainingMs = Date.parse(lease.expires_at) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    throw new Error("Agent lease has expired or has no valid expiry");
  }
  return remainingMs;
}

function completionInput(result, leaseId) {
  const outcome = result?.outcome ?? "succeeded";
  if (!result || (outcome !== "succeeded" && outcome !== "failed" && outcome !== "canceled")) {
    throw new Error("Agent execute callback must return a result with a valid outcome");
  }
  if (outcome === "succeeded" && (typeof result.body !== "string" || !result.body.trim())) {
    throw new Error("Successful agent execution requires a non-empty result body");
  }
  for (const field of ["title", "body", "media_type"]) {
    if (result[field] !== undefined && typeof result[field] !== "string") {
      throw new Error(`Agent result ${field} must be a string`);
    }
  }
  return {
    lease_id: leaseId, outcome,
    ...(result.title !== undefined ? { title: result.title } : {}),
    ...(result.body !== undefined ? { body: result.body } : {}),
    ...(result.media_type !== undefined ? { media_type: result.media_type } : {})
  };
}

async function releaseLease(client, leaseId, timeoutMs) {
  const cleanup = createTimedAbortSignal(undefined, timeoutMs, "Agent lease release timed out");
  try {
    await withAbort(() => client.releaseRunLease(leaseId, {
      signal: cleanup.signal, idempotencyKey: `swarm-agent-${leaseId}-release`
    }), cleanup.signal);
  } catch {
    // Cleanup has its own deadline and must not replace the primary error.
  } finally {
    cleanup.cleanup();
  }
}

export async function executeAgentAcquisition(client, acquisition, input = {}) {
  const runId = acquisition?.run?.id;
  const leaseId = acquisition?.run_lease?.id;
  const linked = linkedAbortController(input.signal);
  const signal = linked.controller.signal;
  const renewalStop = new AbortController();
  let options;
  let runLease = acquisition?.run_lease;
  let expiryTimer;
  let renewal;
  let completed = false;
  let renewalError;

  function watchLease(lease) {
    const remainingMs = assertLease(lease, runId, leaseId);
    runLease = lease;
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => {
      linked.controller.abort(new Error("Agent lease expired during execution"));
    }, remainingMs);
    return remainingMs;
  }

  async function renew() {
    throwIfAborted(signal);
    try {
      // A renewal failure fences execution immediately, rather than continuing
      // the adapter while ownership is uncertain.
      const lease = await withAbort(() => client.renewRunLease(
        leaseId, { ttl_seconds: options.ttlSeconds }, { signal, idempotencyKey: newIntent() }
      ), signal);
      watchLease(lease);
    } catch (error) {
      renewalError = error;
      linked.controller.abort(error);
      throw error;
    }
  }

  async function stopRenewal() {
    renewalStop.abort();
    await renewal;
    if (renewalError) throw renewalError;
    throwIfAborted(signal);
  }

  async function complete(body) {
    assertLease(runLease, runId, leaseId);
    const run = await request(
      opts => client.completeRun(runId, body, opts), options, signal,
      `swarm-agent-${leaseId}-complete`
    );
    assertRun(run, runId, options.spaceId);
    if (run.status !== body.outcome) {
      throw new Error("Agent completion did not return the requested terminal outcome");
    }
    completed = true;
    return run;
  }

  try {
    options = optionsFor(client, input);
    if (!runId || !leaseId) throw new Error("Agent acquisition requires run and run_lease identifiers");
    assertRun(acquisition.run, runId, options.spaceId, leaseId);
    watchLease(runLease);
    if (acquisition.idle === true || (acquisition.run.run_requirements?.execution_mode && acquisition.run.run_requirements.execution_mode !== "agent")) {
      throw new Error("Agent acquisition is idle or belongs to a different execution protocol");
    }
    const started = await request(
      opts => client.startRun(runId, { lease_id: leaseId }, opts), options, signal,
      `swarm-agent-${leaseId}-start`
    );
    assertRun(started, runId, options.spaceId, leaseId);
    if (started.status !== "running" || started.stop_requested_at) {
      throw new Error("Agent Run is not running or has been stopped");
    }
    await renew();
    renewal = (async () => {
      while (!renewalStop.signal.aborted) {
        const remaining = assertLease(runLease, runId, leaseId);
        const delay = Math.max(1, Math.floor(Math.min(options.ttlSeconds * 500, remaining / 3)));
        try { await sleep(delay, renewalStop.signal); } catch { return; }
        if (renewalStop.signal.aborted || signal.aborted) return;
        try { await renew(); } catch { return; }
      }
    })().catch(error => {
      renewalError = error;
      linked.controller.abort(error);
    });
    const context = await request(opts => client.getRunContext(runId, opts), options, signal);
    assertRun(context?.run, runId, options.spaceId, leaseId);
    if (context.run.status !== "running" || context.run.stop_requested_at) {
      throw new Error("Agent Run context is not running or has been stopped");
    }
    let result;
    let body;
    try {
      result = await withAbort(() => options.execute({
        client, spaceId: options.spaceId, run: context.run,
        context, acquisition, runLease, signal
      }), signal);
      body = completionInput(result, leaseId);
    } catch (error) {
      await stopRenewal();
      // Never publish adapter error messages, credentials or a made-up result.
      if (!(error instanceof SwarmAPIError)) {
        try { await complete({ lease_id: leaseId, outcome: "failed" }); } catch { /* Preserve adapter failure. */ }
      }
      throw error;
    }
    await stopRenewal();
    const run = await complete(body);
    return { acquisition, context, result, run, runLease };
  } finally {
    renewalStop.abort();
    linked.controller.abort();
    await renewal;
    clearTimeout(expiryTimer);
    linked.cleanup();
    if (!completed && leaseId && client instanceof SwarmClientBase) {
      await releaseLease(client, leaseId, options?.cleanupTimeoutMs ?? 5000);
    }
  }
}

export async function runAgentOnce(client, input = {}) {
  const options = optionsFor(client, input);
  const linked = linkedAbortController(options.signal);
  try {
    let claim;
    try {
      claim = await request(opts => client.claimNextRun(options.spaceId, {
        ttl_seconds: options.ttlSeconds, ...(options.cursor ? { cursor: options.cursor } : {})
      }, opts), options, linked.controller.signal, newIntent());
    } catch (error) {
      throwIfAborted(linked.controller.signal);
      // Older APIs report queue saturation as a known, no-effect conflict.
      // Only polling may recover; ownership conflicts remain terminal.
      if (!(error instanceof SwarmAPIError) || error.status !== 409 || error.body?.code !== "lease_capacity_reached") throw error;
      claim = { idle: true, retry_after_ms: errorDelayMs(error, 0, 2000),
        ...(options.cursor ? { next_cursor: options.cursor } : {}) };
    }
    if (!claim || typeof claim.idle !== "boolean") {
      if (claim?.run_lease?.id) await releaseLease(client, claim.run_lease.id, options.cleanupTimeoutMs);
      throw new Error("Agent claim returned an invalid queue page");
    }
    if (claim.idle && !claim.run && !claim.run_lease) return { claim, execution: null };
    const execution = await executeAgentAcquisition(client, claim, options);
    return { claim, execution };
  } finally {
    linked.cleanup();
  }
}

export async function runAgentLoop(client, input = {}) {
  const options = optionsFor(client, input);
  const pollMs = boundedNumber(input.pollIntervalMs, 3000, 1, MAX_DELAY_MS, "pollIntervalMs");
  const revisitMs = boundedNumber(input.headRevisitIntervalMs, 30_000, 1, 3_600_000, "headRevisitIntervalMs");
  const linked = linkedAbortController(options.signal);
  options.signal = linked.controller.signal;
  let cursor;
  let headVisitedAt = Date.now();
  let mustScanTail = false;
  try {
    for (;;) {
      throwIfAborted(options.signal);
      let resumeCursor;
      if (cursor && !mustScanTail && Date.now() - headVisitedAt >= revisitMs) {
        resumeCursor = cursor;
        cursor = undefined;
      }
      if (!cursor) headVisitedAt = Date.now();
      const { claim, execution } = await runAgentOnce(client, { ...options, cursor });
      cursor = resumeCursor || claim.next_cursor || undefined;
      mustScanTail = Boolean(resumeCursor);
      await withAbort(() => execution ? options.onExecution?.(execution) : options.onIdle?.(claim), options.signal);
      throwIfAborted(options.signal);
      const hint = retryHintMs(claim.retry_after_ms);
      const delay = hint ?? (execution || cursor ? 0 : pollMs);
      await sleep(delay, options.signal);
    }
  } finally {
    linked.cleanup();
  }
}
