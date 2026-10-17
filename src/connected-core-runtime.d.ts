import type { SwarmClient } from "./client.js";
import type {
  CoreRunnerExecutionResult,
  Run,
  RunAcquisition,
  RunLease
} from "./types.js";

export interface ConnectedCoreExecution {
  acquisition: RunAcquisition;
  execution: CoreRunnerExecutionResult;
  run: Run;
  runLease: RunLease;
}

export class SwarmCoreExecutionUncertainError extends Error {
  readonly code: "core_execution_reconciliation_required";
  readonly retryable: false;
  readonly stage: "start" | "renew" | "execute" | "runner_required";
  readonly runId: string;
  readonly leaseId: string;
  constructor(stage: "start" | "renew" | "execute" | "runner_required", runId: string, leaseId: string);
}

export function computeConnectedCoreLoopDelayMs(
  failureCount: number,
  baseMs: number,
  randomValue?: number
): number;

export function executeConnectedCoreAcquisition(
  client: SwarmClient,
  acquisition: RunAcquisition,
  input?: {
    ttlSeconds?: number;
    signal?: AbortSignal;
    onExecution?: (result: CoreRunnerExecutionResult) => Promise<void> | void;
  }
): Promise<ConnectedCoreExecution>;

export function runConnectedCoreOnce(
  client: SwarmClient,
  input?: {
    ttlSeconds?: number;
    signal?: AbortSignal;
    onExecution?: (result: CoreRunnerExecutionResult) => Promise<void> | void;
  }
): Promise<ConnectedCoreExecution | null>;

export function runConnectedCoreLoop(
  client: SwarmClient,
  input?: {
    ttlSeconds?: number;
    pollIntervalMs?: number;
    signal?: AbortSignal;
    onExecution?: (result: CoreRunnerExecutionResult) => Promise<void> | void;
    onIdle?: () => Promise<void> | void;
  }
): Promise<void>;
