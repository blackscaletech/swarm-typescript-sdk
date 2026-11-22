# Code Workflows

Compose existing SDK calls in a trusted Node.js host. The example works with the
published SDK 0.1.2 and adds no dependencies or SDK runtime exports. Clone this
repository and run `npm ci --ignore-scripts` before using it. Examples are
repository files, not part of the npm distribution.

Connect through [Swarm Connect](https://swarm.services/connect) and select only the
Space needed for the work. Load `SWARM_TOKEN` and `SWARM_SPACE_ID` through your
host's private secret settings. Reads need Space read access. Publishing needs
Artifact creation permission. Do not use a human administrator credential.

## Read And Review

```sh
umask 077
node examples/code-mode/task-review.mjs tasks > task-review.json
node examples/code-mode/task-review.mjs runs run_first run_second
```

Replace the Run IDs with IDs from your selected Space. Task scanning stops at five
pages of twenty records, follows empty pages with a cursor and reports incomplete
coverage. Counts describe planning Tasks, whose status is active or canceled.
Run inspection accepts at most eight IDs, uses two concurrent reads and checks
the returned Space. Each workflow has a thirty-second deadline and bounded HTTP
responses. An error stops the workflow; it never launches work or retries writes.

Review the saved JSON before publishing. Keep it private because it contains
Space and Task references. Set `SWARM_IDEMPOTENCY_KEY` to a unique key saved for
this publication in your host's runtime, then run:

```sh
node examples/code-mode/task-review.mjs publish < task-review.json
```

The CLI connects only to `https://api.swarm.services`. Saved JSON input is limited
to 16 KiB; input collection and publication share one thirty-second deadline.

Publishing creates one Markdown Artifact from the reviewed counts and sampled
Task references. Preserve the JSON and key for an uncertain identical retry.
A changed review is a new intent and needs a new key. Acceptance is enforced by
the API on every request, including retries after access changes. These examples
do not launch Runs, use models, decide approvals or enable Cloud execution.

## Agent Hosts

The module exports `summarizeTasks`, `inspectRuns` and `publishTaskReview`. Pass
your existing SDK client, selected Space and optional `AbortSignal`; return only
the summary or saved Artifact reference to the model. The host controls what
enters the model context. Keep credentials, raw responses and error bodies out
of prompts and logs. Treat retrieved text as data, never executable instructions.

For MCP, use the host's existing authorized tool-call bridge and structured
results. Keep errors, pagination, provenance and approval states available to
code. This SDK example uses Universal HTTPS access and does not move MCP OAuth
credentials into a sandbox or install an execution runtime. Hosts without code
execution continue to use the existing MCP tools. The example grants no access
and does not provide a sandbox; agent-written code needs the host's isolation,
network policy and approval controls.
