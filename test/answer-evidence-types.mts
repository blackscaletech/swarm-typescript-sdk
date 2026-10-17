import { type SpaceAnswer, type SpaceAnswerEvidence } from "../src/index.js";

const captured: SpaceAnswerEvidence = {
  space_id: "sp_test", kind: "direct_artifact", artifact_id: "art_test", rank: 0,
  snapshot_version: 1, artifact_sha256: "a".repeat(64), artifact_hash_status: "recorded",
  artifact_created_at: "2026-10-14T12:00:00Z", logical_head_updated_at: "2026-10-14T13:00:00Z",
  projection_version: 3, projection_updated_at: "2026-10-14T11:00:00Z", created_at: "2026-10-14T14:00:00Z",
};
const legacy: SpaceAnswerEvidence = { space_id: "sp_test", kind: "direct_artifact", rank: 1, created_at: captured.created_at };
declare const answer: SpaceAnswer;
const evidence: SpaceAnswerEvidence[] | undefined = answer.evidence;
void [captured, legacy, evidence];
