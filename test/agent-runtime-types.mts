import {
  SwarmClient, executeAgentAcquisition, runAgentOnce, runAgentLoop,
  type AgentRuntimeOptions, type AgentAdapterContext, type AgentResult,
  type AgentExecution, type AgentIteration
} from "../src/index.js";
import { runAgentOnce as runSubpathOnce } from "@blackscaletech/swarm-sdk/agent-runtime";

const client = new SwarmClient({ baseUrl: "https://swarm.example" });
const execute = async ({ client, context, signal, spaceId }: AgentAdapterContext): Promise<AgentResult> => {
  const goal: string | undefined = context.run_group?.goal_summary;
  const source: string | undefined = context.context_refs[0]?.artifact?.body;
  const child = await client.spawnSubrun(context.run.id, {
    spawn_reason_key: "explicit-review", run_requirements: { execution_mode: "agent" }
  }, { signal, idempotencyKey: "persisted-explicit-intent" });
  void [child, spaceId, goal, source];
  return { body: "Grounded answer" };
};
const input: AgentRuntimeOptions = { spaceId: "sp_1", execute, retryLimit: 1 };
const iteration: AgentIteration = await runAgentOnce(client, { ...input, cursor: "page" });
const exact: AgentExecution = await executeAgentAcquisition(client, await client.acquireRun("run_1"), input);
await runSubpathOnce(client, input);
await runAgentLoop(client, { ...input, headRevisitIntervalMs: 30_000,
  onIdle(claim) { const cursor: string | undefined = claim.next_cursor; void cursor; },
  onExecution(result) { const runId: string = result.run.id; void runId; }
});
const failure: AgentResult = { outcome: "failed" };
const canceled: AgentResult = { outcome: "canceled" };
await client.completeRun("run_1", { lease_id: "lease_1", outcome: "canceled" });
// @ts-expect-error Completion requires a documented terminal outcome.
await client.completeRun("run_1", { lease_id: "lease_1", outcome: "cancelled" });
await runAgentOnce(client, { ...input, execute: () => canceled });
void [iteration, exact, failure, canceled];
// @ts-expect-error Successful results must carry a body.
const empty: AgentResult = { outcome: "succeeded" };
// @ts-expect-error Scope is never inferred from the connection.
await runAgentOnce(client, { execute });
// @ts-expect-error Execution cannot fall back to a hosted model.
await runAgentOnce(client, { spaceId: "sp_1" });
// @ts-expect-error No hidden parallel workers.
await runAgentLoop(client, { ...input, concurrency: 4 });
void empty;
