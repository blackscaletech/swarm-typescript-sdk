/** Historical evidence captured for this answer. Missing fields are unknown. */
export interface SpaceAnswerEvidence {
  answer_id?: string;
  space_id: string;
  kind: "projection" | "projection_source" | "direct_artifact";
  projection_id?: string;
  artifact_id?: string;
  rank: number;
  source_rank?: number;
  source_role?: string;
  title?: string;
  logical_key?: string;
  artifact_kind?: string;
  trust?: string;
  projection_family?: string;
  projection_status?: string;
  projection_validation_score?: number;
  current_logical_head?: boolean;
  snapshot_version?: 1;
  artifact_sha256?: string;
  artifact_hash_status?: "recorded" | "unknown";
  artifact_created_at?: string;
  logical_head_updated_at?: string;
  projection_version?: number;
  projection_updated_at?: string;
  created_at: string;
}
