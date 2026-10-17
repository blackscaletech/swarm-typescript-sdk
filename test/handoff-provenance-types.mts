import { SwarmClient, type HandoffPreview, type HandoffCitation, type ContextCoverage } from "../src/index.js";

const coverage: ContextCoverage = { version: "context_coverage_v1", scope: "declared_scope", status: "complete_for_declared_scope",
  excerpt_only_count: 0, budget_omitted_count: 0, required_omitted_count: 0, rendered_bytes: 100 };
const citation: HandoffCitation = { resource_ref: "artifact:art_source", rank: 1, source_version: "revision",
  source_binding_hash: "binding", excerpt_hash: "excerpt", required: true, full_content_required: true, excerpt_only: false, reason_key: "explicit" };
const client = new SwarmClient({ baseUrl: "https://synthetic.invalid" });
const result: Promise<HandoffPreview> = client.previewHandoff("sp_test", { source_resource_ref: citation.resource_ref });
void [coverage, citation, result];
