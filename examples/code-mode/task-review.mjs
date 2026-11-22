import { SwarmClient } from "@blackscaletech/swarm-sdk";
import { pathToFileURL } from "node:url";

const id = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const options = signal => ({
  signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  maxResponseBytes: 256 * 1024, maxErrorResponseBytes: 16 * 1024
});

export async function summarizeTasks(client, spaceId, { signal } = {}) {
  requireValue(id(spaceId), "Select a Space ID.");
  const request = options(signal), cursors = new Set(), tasks = new Map();
  let cursor, pages = 0;
  do {
    request.signal.throwIfAborted();
    const page = await client.listTasks({ space_id: spaceId, limit: 20, order: "asc", cursor }, request);
    requireValue(Array.isArray(page.items) && page.items.length <= 20, "Invalid Task page.");
    for (const task of page.items) {
      requireValue(task.space_id === spaceId && id(task.id) && ["active", "canceled"].includes(task.status), "Unexpected Task scope or status.");
      tasks.set(task.id, task.status);
    }
    pages++;
    cursor = page.nextCursor || null;
    if (cursor) {
      requireValue(typeof cursor === "string" && cursor.length <= 8192 && !cursors.has(cursor), "Invalid or repeated cursor.");
      cursors.add(cursor);
    }
  } while (cursor && pages < 5);
  return {
    space_id: spaceId, observed_tasks: tasks.size,
    active: [...tasks.values()].filter(status => status === "active").length,
    canceled: [...tasks.values()].filter(status => status === "canceled").length,
    pages, complete: cursor === null, next_cursor: cursor,
    sample_task_ids: [...tasks.keys()].slice(0, 5)
  };
}

export async function inspectRuns(client, spaceId, runIds, { signal } = {}) {
  requireValue(id(spaceId) && Array.isArray(runIds) && runIds.length > 0 && runIds.length <= 8 && runIds.every(id), "Select one to eight Run IDs and a Space.");
  const ids = [...new Set(runIds)], results = new Array(ids.length), cancel = new AbortController();
  const request = options(signal ? AbortSignal.any([signal, cancel.signal]) : cancel.signal);
  let next = 0;
  const workers = Array.from({ length: Math.min(2, ids.length) }, async () => {
    while (next < ids.length) {
      request.signal.throwIfAborted();
      const index = next++, run = await client.getRun(ids[index], request);
      requireValue(run.id === ids[index] && run.space_id === spaceId &&
        ["blocked", "queued", "leased", "running", "succeeded", "failed", "canceled"].includes(run.status), "Unexpected Run scope or status.");
      results[index] = { run_id: run.id, status: run.status, task_id: run.task_id || null,
        artifact_id: run.latest_artifact_preview?.id || null };
    }
  });
  try { await Promise.all(workers); }
  catch (error) { cancel.abort(); await Promise.allSettled(workers); throw error; }
  return { space_id: spaceId, runs: results };
}

export async function publishTaskReview(client, spaceId, review, idempotencyKey, { signal } = {}) {
  requireValue(id(spaceId) && review?.space_id === spaceId && typeof idempotencyKey === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey), "Use the selected Space and a saved idempotency key.");
  requireValue([review.observed_tasks, review.active, review.canceled].every(value => Number.isInteger(value) && value >= 0 && value <= 100) &&
    review.active + review.canceled === review.observed_tasks && typeof review.complete === "boolean" &&
    Array.isArray(review.sample_task_ids) && review.sample_task_ids.length <= Math.min(5, review.observed_tasks) &&
    review.sample_task_ids.every(id), "Use a saved Task summary.");
  const body = ["# Task review", "", `Space: ${spaceId}`, `Observed Tasks: ${review.observed_tasks}`,
    `Active: ${review.active}`, `Canceled: ${review.canceled}`,
    `Coverage: ${review.complete ? "Reached the end of the collection" : "Stopped at the five-page limit"}.`,
    "", "Sample Task references:", ...review.sample_task_ids.map(value => `- task:${value}`),
    "", "This is a bounded read of Task planning status. It is not a Run completion report or a transactional snapshot.", ""].join("\n");
  const artifact = await client.createArtifact({ space_id: spaceId, kind: "report", media_type: "text/markdown", body },
    { ...options(signal), idempotencyKey });
  requireValue(artifact.space_id === spaceId && id(artifact.id), "Unexpected Artifact scope.");
  return { space_id: spaceId, artifact_id: artifact.id };
}

async function main() {
  const [command, ...args] = process.argv.slice(2), spaceId = process.env.SWARM_SPACE_ID;
  requireValue(process.env.SWARM_TOKEN && id(spaceId), "Set SWARM_TOKEN and SWARM_SPACE_ID in your private runtime.");
  requireValue(["tasks", "runs", "publish"].includes(command) && (command === "runs" || args.length === 0), "Use tasks, runs <IDs>, or publish.");
  const client = new SwarmClient({ baseUrl: "https://api.swarm.services", token: process.env.SWARM_TOKEN, timeoutMs: 10_000 });
  const signal = AbortSignal.timeout(30_000);
  let result;
  if (command === "tasks") result = await summarizeTasks(client, spaceId, { signal });
  if (command === "runs") result = await inspectRuns(client, spaceId, args, { signal });
  if (command === "publish") {
    const chunks = []; let size = 0;
    const stopInput = () => process.stdin.destroy(new Error("Review input deadline exceeded."));
    signal.addEventListener("abort", stopInput, { once: true });
    try {
      for await (const chunk of process.stdin) {
        size += chunk.length;
        requireValue(size <= 16 * 1024, "Saved summary exceeds its size limit.");
        chunks.push(chunk);
      }
    } finally { signal.removeEventListener("abort", stopInput); }
    result = await publishTaskReview(client, spaceId, JSON.parse(Buffer.concat(chunks).toString("utf8")), process.env.SWARM_IDEMPOTENCY_KEY, { signal });
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? ` (HTTP ${error.status})` : "";
    console.error(`Swarm review failed${status}. Check the command, saved summary and current Space access. Do not retry a changed write with the same key.`);
    process.exitCode = 1;
  });
}
