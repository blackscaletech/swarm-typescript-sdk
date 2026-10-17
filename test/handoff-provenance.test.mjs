import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient } from "../src/index.js";

test("handoff preserves the server's per-source provenance and declared coverage", async () => {
  const view = { meta: {}, state_key: "projection.ready", source_resource_ref: "artifact:art_source", source_revision: 1,
    coverage: { version: "context_coverage_v1", scope: "declared_scope", status: "complete_for_declared_scope",
      excerpt_only_count: 0, budget_omitted_count: 0, required_omitted_count: 0, rendered_bytes: 100 },
    citations: [{ resource_ref: "artifact:art_source", rank: 1, source_version: "source-revision", source_binding_hash: "binding-revision",
      excerpt_hash: "excerpt-revision", required: true, full_content_required: true, reason_key: "explicit" }] };
  const client = new SwarmClient({ baseUrl: "https://synthetic.invalid", fetch: async () => Response.json(view) });
  assert.deepEqual(await client.previewHandoff("sp_test", { source_resource_ref: view.source_resource_ref }), view);
});

test("missing N-1 coverage and revisions remain absent, never synthesized as complete", async () => {
  const view = { meta: {}, state_key: "projection.ready", source_resource_ref: "artifact:art_source", source_revision: 1,
    citations: [{ resource_ref: "artifact:art_source", rank: 1 }] };
  const client = new SwarmClient({ baseUrl: "https://synthetic.invalid", fetch: async () => Response.json(view) });
  const result = await client.previewHandoff("sp_test", { source_resource_ref: view.source_resource_ref });
  assert.deepEqual(result, view);
  assert.equal(result.coverage, undefined);
  assert.equal(result.citations[0].source_version, undefined);
});
