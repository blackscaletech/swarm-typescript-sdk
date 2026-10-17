import { SwarmClient, type Run, type RunGroup, type RunLaunch, type RunExecutionInput } from "../src/index.js";

const client = new SwarmClient({ baseUrl: "https://swarm.example" });
const input: RunExecutionInput = {
  goal_summary: "Review the rollout evidence",
  run_requirements: { execution_mode: "agent", assignment_mode: "self" },
  run_context_refs: [{ resource_type: "artifact", resource_id: "art_source" }]
};
const run: Run = await client.launchRun("sp_1", input);
const group: RunGroup = await client.createRunGroup("sp_1", { goal_summary: input.goal_summary });
const grouped: Run = await client.createGroupRun(group.id, input);
await client.pauseRunGroup(run.run_group_id);
await client.resumeRunGroup(run.run_group_id);
await client.cancelRunGroup(run.run_group_id);
const attempt: Run = await client.launchTaskRun("task_1", {
  ...input, expected_task_updated_at: "2026-10-12T12:00:00.000001Z"
});
const hosted: RunLaunch = await client.launchSpaceRun("sp_1", {
  title: "Hosted review", description: "Compare the sources", model_route_policy_id: "route_1"
}, { intentKey: "hosted-review" });
const taskID: string | undefined = run.task_id;
const depth: number = grouped.run_depth;
const context = await client.getRunContext(run.id);
const objective: string | undefined = context.run_group?.goal_summary;
const brief: string | undefined = context.task?.description;
void [attempt, hosted, taskID, depth, objective, brief];
// @ts-expect-error Coordination launch does not accept the hosted Task-creation body.
await client.launchRun("sp_1", { title: "Hosted review" });
// @ts-expect-error A Space launch cannot supply a Task version without a Task.
await client.launchRun("sp_1", { expected_task_updated_at: "2026-10-12T12:00:00.000001Z" });
