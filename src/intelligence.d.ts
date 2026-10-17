import type { Artifact, Evaluation, EvaluationOutcome, SpaceScopedInput } from "./types.js";
import type { SpaceAnswerEvidence } from "./answer-evidence.js";
export type { SpaceAnswerEvidence } from "./answer-evidence.js";

export interface AskSpaceInput {
  question: string;
  objective?: string;
  constraints?: string[];
  desired_output_shape?: string;
  allow_learning_update?: boolean;
}

export interface BuildSpaceContextPackInput {
  query?: string;
  objective?: string;
  token_budget?: number;
  mode?: "auto" | "extractive";
}

export interface HandoffPreviewInput {
  source_resource_ref: string;
  selected_resource_refs?: string[];
  objective?: string;
  observed_source_revision?: number;
  output_format_key?: string;
  token_budget?: number;
}

export interface HandoffCitation extends ContextSourceMetadata {
  resource_ref: string;
  rank: number;
  title?: string;
  reason_key?: string;
}

export interface HandoffPreview {
  coverage?: ContextCoverage;
  meta: Record<string, unknown>;
  state_key: string;
  source_resource_ref: string;
  source_revision: number;
  descriptor_snapshot_hash?: string;
  compiled_content_hash?: string;
  encoded_bytes?: number;
  approximate_tokens?: number;
  selected_ref_count?: number;
  omitted_ref_count?: number;
  markdown?: string;
  citations: HandoffCitation[];
  available_actions?: Record<string, unknown>[];
  no_action_reason?: string;
}

export interface ContextPlanInput {
  composer_text: string;
  objective?: string;
  explicit_resource_refs?: string[];
  observed_source_revision?: number;
  token_budget?: number;
}

/** Attribution returned by Swarm. Missing fields do not establish full coverage. */
export interface ContextSourceMetadata {
  source_version?: string;
  source_binding_hash?: string;
  excerpt_hash?: string;
  excerpt_only?: boolean;
  required?: boolean;
  full_content_required?: boolean;
}

export interface ContextPlanRef extends ContextSourceMetadata {
  resource_ref: string;
  reason_key: string;
  estimated_tokens: number;
}

export interface ContextPlan {
  coverage?: ContextCoverage;
  meta: Record<string, unknown>;
  state_key: string;
  plan_revision: number;
  plan_hash?: string;
  included_refs: ContextPlanRef[];
  exclusion_aggregates: Array<{ reason_key: string; count: number }>;
  policy_summary: {
    token_budget: number;
    max_refs: number;
    graph_depth: number;
    model_call: false;
  };
  available_actions?: Record<string, unknown>[];
  no_action_reason?: string;
}

export interface CreateChatSessionDigestInput {
  run_id?: string;
  summary: string;
  durable_decisions?: string[];
  constraints?: string[];
  open_questions?: string[];
  next_steps?: string[];
  source_artifact_ids?: string[];
  candidate_families?: string[];
  create_memory_candidates?: boolean;
}

export interface ChatSessionDigestResult {
  artifact: Artifact;
  evaluation: Evaluation;
  candidates: SpaceLearningCandidate[];
}

export interface SpaceContextPackItem extends ContextSourceMetadata {
  source_type: "space_projection" | "artifact" | string;
  source_id: string;
  source_rank: number;
  title: string;
  excerpt: string;
  subject_keys?: string[];
  subject_labels?: string[];
  estimated_tokens: number;
  score?: number;
  updated_at?: string;
}

export interface SpaceContextTokenSavings {
  baseline_candidate_estimated_tokens: number;
  context_pack_estimated_tokens: number;
  estimated_tokens_avoided: number;
  reduction_ratio: number;
  estimate_method: string;
}

export interface SpaceContextOmissions {
  count: number;
  budget_count: number;
  duplicate_count: number;
  primary_reason?: string;
}

export interface SpaceContextSubjectSignal {
  key: string;
  label: string;
  priority: number;
  estimated_tokens: number;
  compression_useful: boolean;
  primary_reason: string;
}

export interface SpaceContextIntelligence {
  version: string;
  compression_useful: boolean;
  priority: number;
  estimated_tokens_avoided: number;
  source_coverage_ratio: number;
  duplicate_ratio: number;
  primary_reason: string;
  subjects?: SpaceContextSubjectSignal[];
}

export interface SpaceContextSubject {
  key: string;
  label: string;
  candidate_count: number;
  selected_count: number;
  estimated_tokens: number;
}

export interface SpaceContextPack {
  coverage?: ContextCoverage;
  /** Exact capture identity, also present when no durable bundle was stored. */
  context_identity?: string;
  /** Empty when persistence was unavailable; context_identity is not a bundle ID. */
  bundle_id: string;
  space_id: string;
  permission_scope_hash: string;
  source_version_hash: string;
  source_revision: number;
  query: string;
  objective?: string;
  token_budget: number;
  mode: "auto" | "extractive";
  estimated_tokens: number;
  estimator_version: string;
  token_savings: SpaceContextTokenSavings;
  context_intelligence: SpaceContextIntelligence;
  trust_boundary: string;
  strategy?: string;
  compression_method?: string;
  subject_extractor_version?: string;
  cache_eligible: boolean;
  source_count?: number;
  context_text: string;
  items: SpaceContextPackItem[];
  subjects?: SpaceContextSubject[];
  omitted_item_count: number;
  omitted_sources: SpaceContextOmissions;
  duplicate_omitted_count?: number;
  created_at: string;
}

/** Missing coverage on older responses is unknown, not complete evidence. */
export interface ContextCoverage {
  version: "context_coverage_v1";
  scope: string;
  status: "complete_for_declared_scope" | "partial" | "unknown";
  excerpt_only_count: number;
  budget_omitted_count: number;
  required_omitted_count: number;
  rendered_bytes: number;
}

export interface SpaceAnswer {
  answer_id: string;
  space_id: string;
  question: string;
  objective?: string;
  constraints?: string[];
  desired_output_shape?: string;
  answer: string;
  confidence: "low" | "moderate" | "high";
  trust_boundary: string;
  supporting_artifacts: string[];
  used_projections: string[];
  used_strategies: string[];
  gaps: string[];
  follow_up_learning_candidates: string[];
  evidence?: SpaceAnswerEvidence[];
  created_at: string;
}

export interface SpaceAnswerContract {
  space_id: string;
  schema: string;
  version: number;
  trust_boundary: string;
  default_constraints: string[];
  supported_output_shapes: string[];
  required_response_fields: string[];
  supported_learning_queue_kinds: SpaceLearningQueueKind[];
  promotion_statuses: SpaceIntelligenceStatus[];
  connector_candidate_artifact_kind_suffixes: string[];
  connector_diagnostic_artifact_kind_suffixes: string[];
  max_question_bytes: number;
  max_objective_bytes: number;
  max_constraint_bytes: number;
  max_constraints: number;
  allows_learning_update: boolean;
  requires_visible_evidence: boolean;
  generated_at: string;
}

export interface SwarmStackLayer {
  key: string;
  display_name: string;
  summary: string;
  optional: boolean;
}

export interface SpaceBasicCollaborationContract {
  requires_operation: boolean;
  primitives: string[];
  summary: string;
}

export interface SpaceCapabilityDefinition {
  capability_key: string;
  version: string;
  display_name: string;
  description: string;
  operation_kinds: string[];
  supported_targets: string[];
  required_inputs: string[];
  produced_artifact_kinds: string[];
  requires_promotion_gate: boolean;
  risk_level: string;
  default_constraints?: string[];
}

export interface SpaceOperationBudgetContract {
  max_runs: number;
  max_tokens: number;
  max_runtime_minutes: number;
}

export interface SpaceOperationOutputContract {
  required_artifact_kinds: string[];
  promotion_targets: string[];
  requires_evaluation: boolean;
  requires_promotion_gate: boolean;
  trust_boundary: string;
}

export interface SpaceOperationContract {
  operation_kind: string;
  display_name: string;
  description: string;
  supported_capabilities: string[];
  supported_targets: string[];
  required_inputs: string[];
  default_constraints: string[];
  default_budget: SpaceOperationBudgetContract;
  output_contract: SpaceOperationOutputContract;
}

export type SpaceIntelligenceOperationStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type SpaceOperationRefDirection = "target" | "input" | "output";

export interface SpaceOperationRef {
  id: string;
  operation_id: string;
  space_id: string;
  direction: SpaceOperationRefDirection;
  resource_type: string;
  resource_id?: string;
  external_ref?: string;
  artifact_kind?: string;
  metadata?: Record<string, string>;
  created_at: string;
}

export interface CreateSpaceOperationRefInput {
  resource_type: string;
  resource_id?: string;
  external_ref?: string;
  artifact_kind?: string;
  metadata?: Record<string, string>;
}

export interface CreateSpaceIntelligenceOperationInput {
  operation_kind: string;
  capability_key?: string;
  objective: string;
  constraints?: string[];
  budget?: Partial<SpaceOperationBudgetContract>;
  output_contract?: Partial<SpaceOperationOutputContract>;
  target_refs: CreateSpaceOperationRefInput[];
  input_refs?: CreateSpaceOperationRefInput[];
}

export interface UpdateQueuedSpaceIntelligenceOperationInput {
  objective?: string;
  constraints?: string[];
  budget?: Partial<SpaceOperationBudgetContract>;
  output_contract?: Partial<SpaceOperationOutputContract>;
  target_refs?: CreateSpaceOperationRefInput[];
  input_refs?: CreateSpaceOperationRefInput[];
  expected_updated_at?: string;
}

export interface CancelQueuedSpaceIntelligenceOperationInput {
  expected_updated_at?: string;
}

export interface TransitionSpaceIntelligenceOperationInput {
  output_refs?: CreateSpaceOperationRefInput[];
  expected_updated_at?: string;
}

export interface SpaceIntelligenceOperation {
  id: string;
  space_id: string;
  operation_kind: string;
  capability_key: string;
  objective: string;
  status: SpaceIntelligenceOperationStatus;
  constraints: string[];
  budget: SpaceOperationBudgetContract;
  output_contract: SpaceOperationOutputContract;
  target_refs?: SpaceOperationRef[];
  input_refs?: SpaceOperationRef[];
  output_refs?: SpaceOperationRef[];
  created_by_user_id?: string;
  created_by_agent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SpaceOperationContractSummary {
  operation_kind: string;
  display_name: string;
  supported_capabilities: string[];
  supported_targets: string[];
  requires_promotion_gate: boolean;
}

export interface SpaceWorkContract {
  space_id: string;
  schema: string;
  version: number;
  stack: SwarmStackLayer[];
  basic_collaboration: SpaceBasicCollaborationContract;
  capabilities: SpaceCapabilityDefinition[];
  operation_contracts: SpaceOperationContractSummary[];
  agent_instructions: string[];
  trust_boundary: string;
  generated_at: string;
}

export interface SpaceMemoryNode {
  id: string;
  space_id: string;
  source_resource_type: string;
  source_resource_id: string;
  family: string;
  title: string;
  summary: string;
  status: "candidate" | "validated" | "promoted" | "superseded" | "rejected";
  created_at: string;
}

export interface SpaceMemoryEdge {
  id: string;
  space_id: string;
  source_id: string;
  target_id: string;
  kind: string;
  created_at: string;
}

export interface SpaceProjection {
  projection_id: string;
  space_id: string;
  family: string;
  summary: string;
  source_artifacts: string[];
  status: "candidate" | "validated" | "promoted" | "superseded" | "rejected";
  version: number;
  validation_score: number;
  trust_boundary: string;
  updated_at: string;
}

export type SpaceIntelligenceStatus = "candidate" | "validated" | "promoted" | "superseded" | "rejected";
export type SpaceLearningQueueKind =
  | "outside_question"
  | "adversarial_probe"
  | "transfer_probe"
  | "benchmark_probe"
  | "failure_mining"
  | "real_user_question"
  | "context_compression";
export type SpaceLearningQueueStatus = "queued" | "claimed" | "completed" | "canceled";
export type SpacePromotionGateDecision = "promoted" | "blocked" | "rejected";

export interface CreateSpaceLearningCandidateInput {
  family: string;
  summary: string;
  source_artifact_ids?: string[];
  evaluation_ids?: string[];
}

export interface CreateSpaceLearningCandidateFromArtifactInput {
  artifact_id: string;
  family?: string;
  summary?: string;
  evaluation_ids?: string[];
}

export interface RejectSpaceLearningCandidateInput {
  reason?: string;
}

export interface CorrectSpaceLearningCandidateInput {
  summary: string;
  reason: string;
}

export interface CorrectSpaceLearningCandidateResult {
  source_candidate: SpaceLearningCandidate;
  candidate: SpaceLearningCandidate;
  evaluation: Evaluation;
  evidence_artifact: Artifact;
}

export interface SupersedeSpaceLearningCandidateInput {
  reason_key: string;
  reason: string;
  replacement_candidate_id?: string;
}

export interface SupersedeSpaceLearningCandidateResult {
  candidate: SpaceLearningCandidate;
  evaluation: Evaluation;
  evidence_artifact: Artifact;
  projection?: SpaceProjection;
}

export interface SpaceLearningCandidate {
  id: string;
  space_id: string;
  family: string;
  summary: string;
  status: SpaceIntelligenceStatus;
  source_artifact_ids: string[];
  evaluation_ids: string[];
  source_candidate_id?: string;
  superseded_by_candidate_id?: string;
  supersession_reason_key?: string;
  supersession_evaluation_id?: string;
  created_by_agent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SpacePromotionGate {
  id: string;
  space_id: string;
  candidate_id: string;
  projection_id?: string;
  decision: SpacePromotionGateDecision;
  criteria: Record<string, boolean>;
  reasons: string[];
  created_by_agent_id?: string;
  created_at: string;
}

export interface CreateSpaceLearningQueueItemInput {
  kind: SpaceLearningQueueKind;
  family?: string;
  prompt: string;
  metadata?: Record<string, string>;
  priority?: number;
  source_answer_id?: string;
  source_projection_id?: string;
  due_at?: string;
}

export interface ClaimSpaceLearningQueueItemInput {
  agent_id?: string;
  kind?: SpaceLearningQueueKind;
  family?: string;
  claim_ttl_seconds?: number;
}

export interface CompleteSpaceLearningQueueItemInput {
  claim_generation: string;
  agent_id?: string;
}

export interface SubmitSpaceLearningQueueResultInput {
  claim_generation: string;
  agent_id?: string;
  artifact: {
    kind: string;
    title?: string;
    media_type: string;
    body: string;
  };
  candidate?: {
    family?: string;
    summary?: string;
  };
  evaluation?: {
    outcome: EvaluationOutcome;
    score: number;
    rubric_key?: string;
    summary: string;
  };
}

export interface SpaceLearningQueueResult {
  item: SpaceLearningQueueItem;
  artifact?: Artifact;
  candidate?: SpaceLearningCandidate;
  evaluation?: Evaluation;
}

export interface SpaceLearningQueueItem {
  claim_generation: string;
  id: string;
  space_id: string;
  kind: SpaceLearningQueueKind;
  family?: string;
  prompt: string;
  metadata?: Record<string, string>;
  priority: number;
  status: SpaceLearningQueueStatus;
  source_answer_id?: string;
  source_projection_id?: string;
  created_by_agent_id?: string;
  claimed_by_agent_id?: string;
  due_at?: string;
  claimed_until?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SpaceLearningFrontier {
  space_id: string;
  generated_at: string;
  queue_counts: Record<string, number>;
  candidate_counts: Record<string, number>;
  projection_counts: Record<string, number>;
  promotion_gate_counts: Record<string, number>;
  promoted_projection_count: number;
  average_validation_score: number;
  queued_learning_work_count: number;
  active_learning_work_count: number;
  failed_promotion_candidate_count: number;
}

export interface SpaceDecisionGraph {
  space_id: string;
  generated_at: string;
  memory_nodes: SpaceMemoryNode[];
  memory_edges: SpaceMemoryEdge[];
  projections: SpaceProjection[];
  trust_boundary: string;
}

export type TokenCountSource = "estimated" | "provider_reported";
export type TokenUsageEvidenceClass = "estimated" | "provider_receipted" | "runtime_attested" | "unverified";
export type AgentActionStatus = "started" | "succeeded" | "failed" | "canceled" | "blocked" | "skipped";

export interface TokenUsageEvent {
  id: string;
  entity_id: string;
  space_id: string;
  run_id?: string;
  agent_id?: string;
  source_resource_type: "space" | "agent" | "run" | "artifact" | "evaluation" | "space_answer";
  source_resource_id: string;
  operation: string;
  count_source: TokenCountSource;
  evidence_class: TokenUsageEvidenceClass;
  estimator_version?: string;
  model_provider?: string;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  data?: Record<string, string>;
  occurred_at: string;
  created_at: string;
}

export interface TokenUsageRollup {
  entity_id: string;
  space_id?: string;
  operation?: string;
  count_source?: TokenCountSource;
  evidence_class?: TokenUsageEvidenceClass;
  bucket: "total" | "hour" | "day";
  window_start: string;
  window_end: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  event_count: number;
  saturated: boolean;
}

export type CreateTokenUsageEventInput = SpaceScopedInput & {
  run_id?: string;
  agent_id?: string;
  source_resource_type: TokenUsageEvent["source_resource_type"];
  source_resource_id: string;
  operation: string;
  count_source?: TokenCountSource;
  estimator_version?: string;
  model_provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cached_input_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  data?: Record<string, string>;
  occurred_at?: string;
};

export interface AgentActionTrace {
  id: string;
  trace_schema_version: "v081.agent-action-trace.v1";
  entity_id: string;
  space_id: string;
  run_group_id?: string;
  run_id?: string;
  run_attempt?: number;
  execution_id?: string;
  actor_identity_id: string;
  agent_id?: string;
  core_id?: string;
  command_id?: string;
  model_call_id?: string;
  connection_action_receipt_id?: string;
  trace_root_id: string;
  parent_trace_id?: string;
  sequence: number;
  action_descriptor_key: string;
  operation_key?: string;
  status: AgentActionStatus;
  evidence_class_key: string;
  capture_profile_key: string;
  coverage_key: string;
  adapter_key?: string;
  adapter_version?: string;
  tool_descriptor_key?: string;
  tool_descriptor_hash?: string;
  input_hash?: string;
  output_hash?: string;
  input_payload_ref?: string;
  output_payload_ref?: string;
  safe_input_summary?: string;
  safe_output_summary?: string;
  safe_error_key?: string;
  idempotency_key: string;
  event_hash: string;
  trace_hash: string;
  started_at: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentActionTraceLink {
  id: string;
  entity_id: string;
  space_id: string;
  trace_id: string;
  relation_descriptor_key: string;
  resource_type_key: string;
  resource_id: string;
  resource_revision?: string;
  evidence_payload_ref?: string;
  ordinal: number;
  content_hash?: string;
  sensitivity_tags?: string[];
  link_hash: string;
  created_at: string;
}

export type AgentActionTraceLinkInput = {
  relation_descriptor_key: string;
  resource_type_key: string;
  resource_id: string;
  resource_revision?: string;
  content_hash?: string;
  sensitivity_tags?: string[];
};

export type AgentActionTraceEventInput = {
  sequence: number;
  parent_trace_id?: string;
  action_descriptor_key: string;
  operation_key?: string;
  status: AgentActionStatus;
  tool_descriptor_key?: string;
  tool_descriptor_hash?: string;
  input_hash?: string;
  output_hash?: string;
  safe_input_summary?: string;
  safe_output_summary?: string;
  safe_error_key?: string;
  event_hash?: string;
  started_at: string;
  ended_at?: string;
  links?: AgentActionTraceLinkInput[];
};

export type AppendAgentActionTraceBatchInput = {
  trace_root_id: string;
  agent_id?: string;
  capture_profile_key?: string;
  coverage_key?: string;
  adapter_key?: string;
  adapter_version?: string;
  events: AgentActionTraceEventInput[];
};

export interface AgentActionTraceBatchResult {
  traces: AgentActionTrace[];
  links?: AgentActionTraceLink[];
  last_sequence: number;
  last_event_hash: string;
  replay_count: number;
}

export type AgentCheckpointSource = {
  resource_type_key: string;
  resource_id: string;
  resource_revision?: string;
  content_hash?: string;
};

type AgentCheckpointPublishBase = {
  agent_id?: string;
  checkpoint_kind_key: string;
  title: string;
  adapter_key?: string;
  adapter_version?: string;
};

export type PublishAgentCheckpointInput = AgentCheckpointPublishBase & (
  | {
      body_text: string;
      media_type?: "text/markdown" | "text/plain" | "application/json";
      sources?: AgentCheckpointSource[];
    }
  | {
      source_resource_ref: string;
      selected_resource_refs?: string[];
      objective?: string;
      observed_source_revision: number;
      observed_compiled_content_hash: string;
      observed_descriptor_snapshot_hash: string;
      output_format_key?: string;
      token_budget?: number;
    }
);

export interface PublishAgentCheckpointResult {
  artifact: Artifact;
  trace: AgentActionTrace;
  links: AgentActionTraceLink[];
  replayed: boolean;
}

export interface AgentActionTraceDetail {
  trace: AgentActionTrace;
  links?: AgentActionTraceLink[];
}

export interface SpaceActionIntelligenceCount {
  key: string;
  count: number;
}

export interface SpaceActionIntelligenceTokenUsageBreakdownItem {
  operation?: string;
  count_source?: TokenCountSource;
  evidence_class: TokenUsageEvidenceClass;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  event_count: number;
  saturated: boolean;
}

export interface SpaceActionIntelligenceTokenUsage {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  event_count: number;
  saturated: boolean;
  breakdowns: SpaceActionIntelligenceTokenUsageBreakdownItem[];
}

export interface SpaceActionIntelligenceTraceSample {
  id: string;
  run_group_id?: string;
  run_id?: string;
  execution_id?: string;
  actor_identity_id: string;
  agent_id?: string;
  core_id?: string;
  parent_trace_id?: string;
  action_descriptor_key: string;
  operation_key?: string;
  status: AgentActionStatus;
  evidence_class_key: string;
  coverage_key: string;
  safe_input_summary?: string;
  safe_output_summary?: string;
  safe_error_key?: string;
  started_at: string;
  ended_at?: string;
}

export interface SpaceActionIntelligenceSummary {
  entity_id: string;
  space_id: string;
  window_start: string;
  window_end: string;
  trace_sample_limit: number;
  trace_sample_count: number;
  trace_sample_truncated: boolean;
  action_descriptor_counts: SpaceActionIntelligenceCount[];
  status_counts: SpaceActionIntelligenceCount[];
  operation_counts: SpaceActionIntelligenceCount[];
  evidence_class_counts: SpaceActionIntelligenceCount[];
  coverage_counts: SpaceActionIntelligenceCount[];
  token_usage: SpaceActionIntelligenceTokenUsage;
  recent_actions: SpaceActionIntelligenceTraceSample[];
  recent_failures: SpaceActionIntelligenceTraceSample[];
}
