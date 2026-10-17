# SDK Reference

## Operation Keys

Operation key policy is checked against the versioned public
`contracts/client-contract.json` fixture. A new logical
queue/acquisition/heartbeat or lease-transition invocation receives a fresh key;
retain that key for an exact retry. Durable-content operations intentionally
deduplicate the normalized convenience command or exact raw JSON body and query.
Explicit caller keys remain unchanged. No key is generated for operations whose
contract does not require one. None of these policies authorizes an effect or
permits automatically retrying an uncertain external mutation.

Unregistered or newer raw routes require `idempotencyKey`, or an explicit
`idempotencyPolicy: "fresh-attempt" | "durable-content"`. They fail before dispatch
without one. Known policies cannot be overridden by a conflicting strategy.
Run `npm run check:shared` and the tests to verify local contract parity before
packaging. Contract updates must preserve exact retry behavior.

## Transport And Packaging

Buffered JSON/text responses default to 64 MiB for success and 1 MiB for errors.
Set `maxResponseBytes` and `maxErrorResponseBytes` on the client or individual
request for endpoint-specific ceilings. Native fetch bodies are read incrementally;
custom transports without a readable body own their allocation and are checked
after `text()`. Oversized responses throw `SwarmResponseLimitError` without
including response content. The success default accommodates the encoded form
of the current 8 MiB Core output; large histories should still be paginated.

`responseByteLimits` sets endpoint budgets without reducing valid large-output
limits. Each entry supplies `method`, a canonical `path` template such as
`/v1/artifacts/{artifactId}/content`, and success/error byte limits. Per-request
limits override endpoint limits, which override client defaults. Invalid or
overlapping policies fail before transport. These bound buffered responses,
not caller-owned raw streams.

`getVerifiedArtifactContent(id, { expectedSha256 })` verifies the complete UTF8
body against its Artifact ID, byte count and SHA256 before returning it. An
optional independently recorded digest binds the read to that source revision.
It is a bounded buffered JSON read, not a streaming download. The normal raw
download negotiation remains a separate API integration requirement.

`timeoutMs` covers headers and buffered bodies. Successful `raw: true` responses
transfer lifetime ownership to the caller: consume or cancel the returned body.
Caller cancellation remains linked until EOF, cancellation or failure. Raw
responses are owned Response wrappers, not the original fetch object identity.
Optional `streamIdleTimeoutMs` bounds a pending read and `streamTotalTimeoutMs`
bounds the whole stream, including callbacks; both default to zero (disabled).
Strict SSE cancellation keeps the last successfully applied cursor. Callbacks
must cooperate with cancellation and apply events idempotently; stopping a
subscription does not undo an already committed application effect.
The agent runtime's `retryBudgetMs` defaults to 150000 and covers one operation's
requests, buffered bodies and all retry delays together. `Retry-After` cannot
extend that budget. It does not impose a deadline on the whole healthy worker
loop or on host work, which is fenced by the lease and cancellation signal.

The packaged shared helpers retain their exact shipped bytes. Their SHA256
digests are checked against the local public contract. `npm run build:shared`,
`npm test` and `prepack` reject mismatched content without reading or rewriting
any external source. `npm run test:packaged` packs and
installs offline in an isolated consumer, exercises every export and checks
NodeNext/Bundler types using the repository's pinned TypeScript toolchain.
These checks do not publish the package.

Agent queue polls, learning claims, acquisitions and lease transitions use a
fresh default idempotency key for each new attempt. For a retry after an uncertain
response, retain your own `idempotencyKey` and submit the identical request.
Durable commands keep stable default keys. A lease that expired or was reassigned
does not become valid again because an old request was replayed.

Launch/bootstrap convenience helpers normalize their documented string and set
fields. Every supported execution mode, assignment constraint, selected/excluded
identity and evaluation method is retained in the command and its default key.
Malformed or unknown authority constraints throw before transport instead of
silently widening a request. Use the raw request method only with an API version
whose contract supports the supplied fields; the server remains the authority.
Use a new `intentKey` for an intentionally distinct repeated convenience command,
and persist an explicit `idempotencyKey` for retries across client upgrades.
The corrected default key includes Entity keys and formerly omitted constraints;
it must not be used to retry an older uncertain call whose old key was not retained.
Raw durable mutations use the `swarm-sdk-v2` recipe: JSON object-key order is
canonical, array order and exact string bytes are preserved. Artifact evidence
with leading/trailing whitespace is not merged with a different body. Only
documented convenience helpers normalize string/set fields before keying.

TypeScript/JavaScript SDK for:

- agent integrations
- Codex or other coding-agent wrappers
- web application API clients
- external automation consumers

Current package shape:

- dependency-free ESM client
- contract-aligned request/response types in `src/index.d.ts`
- automatic bearer auth and idempotency headers for mutation routes
- direct `bootstrapSpace(...)` helper for one-shot headless space setup
- direct `connectCurrentUserClient(...)` helper for one-shot connected-agent bootstrap from a human session: resolve or create the caller's default personal space and issue a reusable agent credential
- direct `connectClient(...)` helper for one-time agent authorization inside an existing space
- collection helpers that preserve `X-Next-Cursor` and `X-Order`
- task and run helpers for planning and inspecting work
- external agent claim and exact-acquire through the existing connection:
  `claimNextRun(...)` and `acquireRun(...)`
- external lease lifecycle: `startRun(...)`, `renewRunLease(...)`,
  `completeRun(...)` and `releaseRunLease(...)`
- primary host execution helpers: `executeAgentAcquisition(...)`,
  `runAgentOnce(...)` and the single-worker `runAgentLoop(...)`
- `launchRun(...)`, `launchTaskRun(...)`, `spawnSubrun(...)`, `listSpaceAgentParticipants(...)`
  and `declareExecutorCapabilities(...)` for scoped coordination
- `createRunGroup(...)`, `createGroupRun(...)`, `pauseRunGroup(...)`,
  `resumeRunGroup(...)` and `cancelRunGroup(...)` for bounded work groups
- advanced Connected Core claim and exact-acquire methods:
  `claimNextCoreRun(...)` and `acquireCoreRun(...)`
- Connected Core lifecycle methods for heartbeat, start, execute, complete, renew, and release
- authorized search helper over `/v1/search`
- public search helper over `/v1/search/public`
- public `listChatClientProfiles(...)` helper so Codex-first direct flows also stay aligned with Claude-style and local-model wrappers
- Space Intelligence helpers for grounded Ask Space answers, paginated answer history, decision graphs, promotion gates, projections, and active learning queues
- connected chat memory helpers for resume, Ask Space, and session digest flows scoped to `/v1/chat/*`
- token usage telemetry helpers for provider-reported counts and rollups without storing raw prompts or outputs
- audit-event SSE consumption
- operator, budget, approval, and canonical execution helpers on the same client
- `runConnectedCoreOnce(...)` and `runConnectedCoreLoop(...)` helpers for the
  canonical Connected Core protocol:
  `heartbeat -> claim -> start -> renew -> execute`
  Successful `execute` calls atomically persist output and return the terminal
  Run. The runtime uses `complete` only to report a sanitized failure.
- `executeConnectedCoreAcquisition(...)` for an exact Run acquired through
  `POST /v1/core-runs/{runId}/acquire`
- webhook receiver helpers for signature verification and header parsing:
  `computeWebhookSignature(...)`, `verifyWebhookSignature(...)`, `parseWebhookHeaders(...)`
- operator webhook management helpers:
  `listWebhookActions(...)`, `listWebhookActionPresets(...)`, `listWebhookTargets(...)`, `createWebhookTarget(...)`, `createWebhookTargetFromPreset(...)`, `updateWebhookTarget(...)`, `disableWebhookTarget(...)`, `listWebhookDeliveries(...)`, `redriveWebhookDelivery(...)`

The SDK is dependency-free at runtime. Public compatibility fixtures live in
`contracts/client-contract.json`; exported declarations are in `src/index.d.ts`.
The API server remains the authority for permissions and supported operations.

## Auth Boundaries

Swarm now enforces authority on the backend instead of trusting how the SDK is used.

- human-auth clients can manage entities, spaces, memberships, policies, credentials, and client access packages
- reusable Universal/MCP connections can plan, queue, execute and delegate work
  within their live Space permissions, without enrolling a device runner
- Connected Core credentials are execution-oriented: heartbeat, claim or
  exact acquire, lease lifecycle, execution, and completion
- launching work is a separate Permit-backed Command; runner credentials do
  not create work or administer a Space
- chat sessions stay narrower and should use `/v1/chat/*`

Practical rule:

- use the existing agent connection for normal agent work; never give it a
  human session credential
- use a separate Connected Core client only for the advanced enrolled-runner
  protocol
- do not use Connected Core credentials for Space or credential management
- do not place runner credentials or connection package contents into prompts,
  notes, artifacts, or evaluations

## Contract-Backed Scoring

When a run includes `run.scoring_contract` and `run.scoring_contract_hash`, the executing agent should publish dimension scores instead of client-authored top-level score/outcome values.

- echo the provided `contract_hash`
- send bounded `dimensions`, optional `confidence`, and optional `signals`
- let the Swarm API derive the stored `score` and `outcome`

Manual or ad hoc runs without a scoring contract can still publish the simpler `outcome` plus `score` evaluation shape.

## Connected Chat Memory

Use these helpers after a chat has exchanged a `SWARM_CONNECT_CODE` for a scoped `swarm_chat_*` token. The active Space is resolved from that chat session, so callers do not pass a `spaceId`.

```js
import { SwarmClient } from "@blackscaletech/swarm-sdk";

const chat = new SwarmClient({
  baseUrl: "https://api.swarm.services",
  token: "swarm_chat_..."
});

const context = await chat.buildConnectedChatContextPack({
  query: "resume current work",
  objective: "Return only compact project context.",
  token_budget: 4000
});
console.log(context.token_savings.estimated_tokens_avoided);
console.log(context.bundle_id, context.source_version_hash);

const answer = await chat.askConnectedChatSpace({
  question: "What decisions did we make last session?",
  desired_output_shape: "brief_with_rationale",
  allow_learning_update: false
});

const digest = await chat.createConnectedChatSessionDigest({
  summary: "Finished the deployment stability pass.",
  durable_decisions: ["Use chat-scoped memory endpoints for resume/save/ask."],
  open_questions: ["Which memory suggestions should be approved?"],
  next_steps: ["Review memory suggestions in Swarm Services."],
  create_memory_candidates: true
});
```

Context packs include bundle/source hashes, permission-scope hashes, source revision, token-savings estimates, omissions, and subject signals so agents can resume with cited compact context instead of replaying raw history. Chat memory helpers can create reviewable memory suggestions when policy allows it. They do not promote memory, manage access, issue credentials, or bypass Space permissions.

## External Agent Example

Use `execution_mode: agent` when work must run in the connected host, not Swarm
Cloud. Create a Task with `createTask(...)`, then queue it with
`launchTaskRun(...)`. Assign it to `self`, `specific` executor addresses, `any`
authorized worker or `others` excluding the creator.

For a brief without a saved Task, `launchRun(spaceId, { goal_summary,
run_requirements })` queues one Run in a new Group through the same route as
MCP's `swarm_launch_run`. It returns a Run, not a Task/Run wrapper. Use
`run.run_group_id` with the Group controls and `listRuns({ run_group_id })` to
inspect its work. Canceling a Group stops its delegated work too; canceling a
Task only stops pending Runs linked to that Task.

`launchSpaceRun(...)` and `launchFromPrompt(...)` remain explicit hosted/device
helpers that create a Task and return `{ task, run }`. The former hosted alias
`launchRun(...)` now follows normal coordination. Integrations that intended
hosted execution must use `launchSpaceRun(...)` instead. No credential change
or device enrollment is needed for external-agent work.

Use a new `idempotencyKey` for each new launch or control intent and reuse that
key with the exact body after a lost response. The default key deduplicates
identical requests; it does not distinguish a later, intentional repeat.

`updateTask(...)` accepts `expected_updated_at`; `launchTaskRun(...)` accepts
`expected_task_updated_at`. Use the saved Task's `updated_at` to reject concurrent
changes with `409 task_changed`. Retry a lost response with the original body
and idempotency key, not a newly read timestamp.

This example accepts an execution adapter supplied by your agent host. Swarm
coordinates and publishes the result; the SDK does not launch a model, enroll a
Core, send Core heartbeats, or call a hosted/Cloud execution endpoint. The loop
only claims existing work in the explicit Space; it never creates Tasks, queues
fallback work, or spawns peers.

```js
import { SwarmClient } from "@blackscaletech/swarm-sdk";
import { runAgentLoop } from "@blackscaletech/swarm-sdk/agent-runtime";

const worker = new SwarmClient({
  baseUrl: process.env.SWARM_BASE_URL,
  token: process.env.SWARM_CONNECTION_TOKEN
});

// executeInHost is supplied by your integration, not by Swarm.
// It must stop its underlying work when signal aborts.
const stop = new AbortController();
process.once("SIGTERM", () => stop.abort());
process.once("SIGINT", () => stop.abort());

await runAgentLoop(worker, {
  spaceId: process.env.SWARM_SPACE_ID,
  ttlSeconds: 60,
  headRevisitIntervalMs: 30_000,
  signal: stop.signal,
  async execute({ context, signal, client }) {
    // context includes the server Run, Group goal, Task and resolved sources.
    // client permits explicit, policy-bounded subruns if your host chooses.
    const result = await executeInHost({ context, signal, client });
    return { body: result.body, title: result.title, media_type: "text/markdown" };
  },
  onExecution({ run }) { console.log(run.id, run.status); }
});
```

`runAgentOnce(worker, { spaceId, execute, cursor, signal })` returns
`{ claim, execution }`, with `execution: null` on idle pages. Keep
`claim.next_cursor` even when idle. For an exact acquisition, pass the result of
`acquireRun(...)` to `executeAgentAcquisition(worker, acquisition, { spaceId,
execute, signal })`; give each new acquire intent its own persisted key.

The loop follows cursors on idle and acquired pages and periodically revisits
the head (`headRevisitIntervalMs`, 1..3600000 ms), then resumes its saved tail.
Slow polls cannot replace every tail request with another head revisit.
Server `retry_after_ms` and
429/503 backoff are bounded to 30 seconds. Requests retry at most twice by
default (`retryLimit`, 0..5); each retry keeps the exact body, lease ID and
idempotency key. New polls and renewals have fresh request intents. Renewal
failure immediately aborts the adapter, including during context retrieval,
and prevents completion through stale ownership. Start/context failures also
release the lease. Release uses its own bounded, non-aborted cleanup signal.

A successful adapter result requires a non-empty `body`. Return
`{ outcome: "failed" }` or `{ outcome: "canceled" }` for an explicit terminal
failure or cancellation; either may include an optional result body.
A thrown adapter error reports
only a sanitized `failed` outcome, not its error text; signal cancellation, API errors
and ownership failures release instead. The loop rejects on abort or exhausted
request/lifecycle failure, never restarting the adapter for that claim. A lost
terminal response retries only completion; if recovery is exhausted, reconcile
server state instead of re-executing the acquisition. These helpers are not a
durable cross-process execution journal. The raw `client` is available for
explicit bounded subruns; the host must honor the signal for its own calls and
must not independently publish after cancellation.

A schedule queues work but does not keep a closed chat running. See the
[agent guide](https://swarm.services/guide/connect/agent.md) for setup and loops.

## Advanced Runner Example

```js
import { SwarmClient } from "@blackscaletech/swarm-sdk";
import { runConnectedCoreLoop } from "@blackscaletech/swarm-sdk/connected-core-runtime";

const core = new SwarmClient({
  baseUrl: process.env.SWARM_BASE_URL,
  token: process.env.SWARM_CORE_RUNNER_TOKEN
});

const stop = new AbortController();
process.once("SIGTERM", () => stop.abort());
process.once("SIGINT", () => stop.abort());

await runConnectedCoreLoop(core, {
  ttlSeconds: 60,
  signal: stop.signal,
  onExecution(result) {
    console.log(result.run.id, result.artifact.id);
  }
});
```

## Event Streams

Audit and runtime-hint streams use bounded, incremental
[SSE framing](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream).
They preserve field whitespace, inherited/empty event IDs and split UTF-8/line
endings. An unfinished frame at EOF is not delivered. Oversized frames are
discarded through their delimiter, never reparsed from a retained tail.

The default mode remains permissive: malformed/oversized frames are reported
through `onStreamError`, skipped, and the returned cursor is the last received
complete-frame ID. Do not use that cursor as proof that application state was
updated.

Pass `{strict: true, lastEventId: savedCursor}` to stop on malformed, oversized,
incomplete or unapplied events. A `SwarmStreamError` carries `code`,
`lastEventId` (last successfully completed application callback) and
`lastReceivedEventId`. Readers are canceled/released on failure. Error reports
also distinguish `last_event_id` from `last_received_event_id`.

Commit your application update and cursor together in the callback; only return
after that commit succeeds. Reconnect explicitly with the applied cursor and
make repeated delivery idempotent. Strict parsing does not make the audit feed
a complete, commit-ordered replication log. Runtime hints are wakeups, not
authority: reconcile current Run, approval and Space state using canonical APIs.

## Learning Claim Completion

The fenced learning-queue API requires the exact `claim_generation` returned by
acquisition. Keep it as a decimal string, not a JavaScript number:

```js
const item = await client.claimSpaceLearningQueueItem(spaceId);
await client.completeSpaceLearningQueueItem(spaceId, item.id, {
  claim_generation: item.claim_generation
});
```

To publish a result instead, pass that same field to
`submitSpaceLearningQueueResult` alongside the artifact. Do not call both
completion methods for one attempt. Exact retries recover the committed result;
changed content or an expired/reassigned attempt is refused. Never fetch the
current generation to authorize old work.

This API change requires the coordinated server/worker cutover documented in
the private milestone; these local SDK changes have not been published.

## Connected Core Outcomes

`onExecution` is an observer, not an executor or approval decision. A callback
failure after a confirmed succeeded Run never submits failed completion or
releases that execution. Observer failures are not retried by the helper loop.

Lost start/execute responses, server unavailability, and a runner-required
reply raise `SwarmCoreExecutionUncertainError` with the original Run and lease
IDs and stage. It is not retryable. The helper does not guess a failed outcome,
release an issued execution, or issue another model call. Use the canonical
owner's generation-aware reconciliation; an ordinary Run status read alone is
not proof of the original attempt's outcome. Signed-envelope execution belongs
to the Core runner flow, not this synchronous-completion helper.

## Verified Artifact Downloads

`downloadArtifact(artifactId, { expectedSha256 })` opts into the authenticated raw
content route. It returns `{ artifact_id, sha256, size_bytes, media_type, bytes }`
only after matching the complete Artifact identity, exact byte length and SHA256.
It does not expose storage URLs or partially verified chunks. `getArtifactContent`
and `getVerifiedArtifactContent` retain the existing JSON/text response contract.

The JavaScript helper stages a bounded `Uint8Array`, not a constant-memory file
stream. The maximum is 64 MiB, reduced by endpoint, response and Artifact limits;
`downloadTimeoutMs` defaults to 120000 and can only be lowered. Caller cancellation
and stream idle deadlines remain active. Compression, range and conditional reads
are rejected instead of confusing transfer bytes with complete Artifact bytes.
Use an authorized same-origin endpoint or server-side SDK. Cross-origin browser
usage requires the server's CORS policy to expose the identity headers.

## Test

```bash
npm ci --ignore-scripts
npm test
```
