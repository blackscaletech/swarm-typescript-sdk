import { SwarmAPIError, SwarmClientBase } from "./client-core.js";
import { computeLoopDelayMs, linkedAbortController, sleep } from "./runtime-utils.js";

const observerFailures = new WeakSet();

export class SwarmCoreExecutionUncertainError extends Error {
  constructor(stage, runId, leaseId) {
    super("Swarm connected Core outcome requires reconciliation; do not complete, release or reexecute this work automatically");
    this.name = "SwarmCoreExecutionUncertainError";
    this.code = "core_execution_reconciliation_required";
    this.retryable = false;
    this.stage = stage;
    this.runId = runId;
    this.leaseId = leaseId;
  }
}

function requireClient(client) {
  if (!(client instanceof SwarmClientBase)) {
    throw new Error("Connected Core execution requires a SwarmClient instance");
  }
}

function retryable(error) {
  if (error && typeof error === "object" && observerFailures.has(error)) return false;
  if (error instanceof SwarmAPIError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return /abort|econn|fetch|network|socket|timed out|timeout/i.test(
    `${error?.name || ""} ${error?.message || ""}`
  );
}

function startLeaseRenewal(client, runId, leaseId, ttlSeconds, workController, signal) {
  const renewal = linkedAbortController(signal);
  const renewalController = renewal.controller;
  const intervalMs = Math.max(1000, Math.floor(Math.max(1, ttlSeconds) * 500));
  let error = null;
  let latestLease = null;
  const loop = (async () => {
    while (!renewalController.signal.aborted) {
      try {
        await sleep(intervalMs, renewalController.signal);
      } catch {
        return;
      }
      if (renewalController.signal.aborted) {
        return;
      }
      try {
        latestLease = await client.renewCoreRunLease(
          runId,
          leaseId,
          { ttl_seconds: ttlSeconds },
          { signal: renewalController.signal }
        );
      } catch (renewalError) {
        error = renewalError;
        workController.abort(renewalError);
        return;
      }
    }
  })();
  return {
    get error() {
      return error;
    },
    get latestLease() {
      return latestLease;
    },
    async stop() {
      renewalController.abort();
      await loop;
      renewal.cleanup();
    }
  };
}

export function computeConnectedCoreLoopDelayMs(
  failureCount,
  baseMs,
  randomValue = Math.random()
) {
  return computeLoopDelayMs(failureCount, baseMs, randomValue);
}

export async function executeConnectedCoreAcquisition(
  client,
  acquisition,
  { ttlSeconds = 60, signal, onExecution } = {}
) {
  requireClient(client);
  const runId = acquisition?.run?.id;
  const leaseId = acquisition?.run_lease?.id;
  if (!runId || !leaseId) {
    throw new Error("Connected Core acquisition requires run and run_lease identifiers");
  }

  let completed = false;
  let runLease = acquisition.run_lease;
  const linked = linkedAbortController(signal);
  let renewal = null;
  let stage = "start";
  try {
    await client.startCoreRun(runId, leaseId, { signal: linked.controller.signal });
    stage = "renew";
    runLease = await client.renewCoreRunLease(
      runId,
      leaseId,
      { ttl_seconds: ttlSeconds },
      { signal: linked.controller.signal }
    );
    renewal = startLeaseRenewal(
      client,
      runId,
      leaseId,
      ttlSeconds,
      linked.controller,
      linked.controller.signal
    );
    stage = "execute";
    const execution = await client.executeCoreRun(runId, leaseId, {
      signal: linked.controller.signal
    });
    if (execution?.requires_runner) throw new SwarmCoreExecutionUncertainError("runner_required", runId, leaseId);
    const run = execution?.run && { ...execution.run };
    if (!run || run.id !== runId || run.status !== "succeeded") {
      throw new SwarmCoreExecutionUncertainError(stage, runId, leaseId);
    }
    // The server's completed outcome is authoritative before any local observer.
    completed = true;
    await renewal.stop();
    runLease = renewal.latestLease || runLease;
    if (typeof onExecution === "function") {
      try { await onExecution(execution); }
      catch (error) {
        const observerError = error && typeof error === "object" ? error : new Error("Connected Core observer failed");
        observerFailures.add(observerError);
        throw observerError;
      }
    }
    return { acquisition, execution, run, runLease };
  } catch (error) {
    if (completed) throw error;
    await renewal?.stop();
    runLease = renewal?.latestLease || runLease;
    const primaryError = renewal?.error || error;
    if (primaryError instanceof SwarmAPIError && primaryError.status >= 400 && primaryError.status < 500 &&
        primaryError.status !== 408 && primaryError.status !== 429) throw primaryError;
    throw primaryError instanceof SwarmCoreExecutionUncertainError ? primaryError : new SwarmCoreExecutionUncertainError(stage, runId, leaseId);
  } finally {
    await renewal?.stop();
    linked.cleanup();
    // Release can terminalize an issued execution. Only the canonical owner may reconcile it.
  }
}

export async function runConnectedCoreOnce(
  client,
  { ttlSeconds = 60, signal, onExecution } = {}
) {
  requireClient(client);
  await client.recordCoreRunnerHeartbeat({ signal });
  const acquisition = await client.claimNextCoreRun(
    { ttl_seconds: ttlSeconds },
    { signal }
  );
  if (!acquisition) {
    return null;
  }
  return executeConnectedCoreAcquisition(client, acquisition, {
    ttlSeconds,
    signal,
    onExecution
  });
}

export async function runConnectedCoreLoop(
  client,
  {
    ttlSeconds = 60,
    pollIntervalMs = 3000,
    signal,
    onExecution,
    onIdle
  } = {}
) {
  requireClient(client);
  let failures = 0;
  while (!signal?.aborted) {
    try {
      const result = await runConnectedCoreOnce(client, {
        ttlSeconds,
        signal,
        onExecution
      });
      failures = 0;
      if (result !== null) {
        continue;
      }
      await onIdle?.();
    } catch (error) {
      if (error instanceof SwarmCoreExecutionUncertainError) throw error;
      if (signal?.aborted) {
        throw signal.reason || error;
      }
      if (!retryable(error)) {
        throw error;
      }
      failures += 1;
    }
    await sleep(
      computeConnectedCoreLoopDelayMs(failures, pollIntervalMs),
      signal
    );
  }
}
