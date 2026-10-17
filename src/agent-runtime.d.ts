import type { SwarmClient } from "./client.js";
import type { Run, RunAcquisition, RunContext, RunLease } from "./types.js";

export type AgentClaim = Awaited<ReturnType<SwarmClient["claimNextRun"]>>;

export type AgentResult = {
  outcome?: "succeeded";
  body: string;
  title?: string;
  media_type?: string;
} | {
  outcome: "failed" | "canceled";
  body?: string;
  title?: string;
  media_type?: string;
};

export interface AgentAdapterContext {
  /** The existing connection; subruns are explicit host decisions, not automatic. */
  client: SwarmClient;
  spaceId: string;
  /** The full server context, including Group goal, Task and resolved sources. */
  context: RunContext;
  run: Run;
  acquisition: RunAcquisition;
  /** Snapshot at adapter invocation. Use signal, not this snapshot, as the fence. */
  runLease: RunLease;
  /** The adapter must cancel its underlying host work when this aborts. */
  signal: AbortSignal;
}

export interface AgentRuntimeOptions {
  spaceId: string;
  execute: (context: AgentAdapterContext) => AgentResult | Promise<AgentResult>;
  /** Integer 1..3600, default 60. */
  ttlSeconds?: number;
  signal?: AbortSignal;
  /** Additional per-request retries, 0..5, default 2. Renewal fails immediately. */
  retryLimit?: number;
  /** Retry base 250..30000 ms, default 250. All server delays cap at 30000 ms. */
  retryBaseMs?: number;
  /** Entire request plus all retries/backoff, 1..2147483647 ms, default 150000. */
  retryBudgetMs?: number;
  /** Independent best-effort release deadline, 1..30000 ms, default 5000. */
  cleanupTimeoutMs?: number;
}

export interface AgentExecution {
  acquisition: RunAcquisition;
  context: RunContext;
  result: AgentResult;
  run: Run;
  runLease: RunLease;
}

export interface AgentIteration {
  /** Preserve next_cursor/retry_after_ms even when execution is null. */
  claim: AgentClaim;
  execution: AgentExecution | null;
}

export interface AgentOnceOptions extends AgentRuntimeOptions {
  cursor?: string;
}

export interface AgentLoopOptions extends AgentRuntimeOptions {
  /** Idle delay 1..30000 ms, default 3000, unless the server supplies a hint. */
  pollIntervalMs?: number;
  /** Revisit the queue head every 1..3600000 ms, default 30000. */
  headRevisitIntervalMs?: number;
  onExecution?: (execution: AgentExecution) => void | Promise<void>;
  onIdle?: (claim: AgentClaim) => void | Promise<void>;
}

export function executeAgentAcquisition(
  client: SwarmClient, acquisition: RunAcquisition, input: AgentRuntimeOptions
): Promise<AgentExecution>;

export function runAgentOnce(client: SwarmClient, input: AgentOnceOptions): Promise<AgentIteration>;

/** Serial worker. Cancellation and any exhausted lifecycle failure reject. */
export function runAgentLoop(client: SwarmClient, input: AgentLoopOptions): Promise<void>;
