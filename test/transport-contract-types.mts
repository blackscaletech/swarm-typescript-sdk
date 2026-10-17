import { SwarmClient, SwarmArtifactIntegrityError, runAgentOnce } from "../src/index.js";
import type { ScoringContract, RunRequirementsSpec } from "../src/index.js";

const client = new SwarmClient({ baseUrl: "https://audit.example", timeoutMs: 30000,
  responseByteLimits: [{ method: "GET", path: "/v1/artifacts/{artifactId}/content", maxResponseBytes: 64 * 1024 * 1024, maxErrorResponseBytes: 1024 }],
  streamIdleTimeoutMs: 10000, streamTotalTimeoutMs: 60000 });
const content = await client.getVerifiedArtifactContent("art_test", { expectedSha256: "0".repeat(64), maxArtifactBytes: 8 * 1024 * 1024 });
const size: number = content.size_bytes;
const error = new SwarmArtifactIntegrityError();
const code: "artifact_integrity_failed" = error.code;
const requirements: RunRequirementsSpec = { execution_mode: "agent", assignment_mode: "specific", target_identity_ids: ["idn_target"], excluded_identity_ids: ["idn_excluded"] };
const scoring: ScoringContract = { rubric_key: "review", version: 1, pass_threshold: 80, fail_threshold: 40, dimensions: [], accepted_evaluation_method_keys: ["human_review"] };
await runAgentOnce(client, { spaceId: "sp_test", retryBudgetMs: 150000, execute: () => ({ body: "Source-grounded result" }) });
void size; void code; void requirements; void scoring;
