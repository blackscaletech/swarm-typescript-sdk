import type { RuntimeCredential, IssuedRuntimeCredential } from "./runtime-credentials.js";
export type { RuntimeCredential, IssuedRuntimeCredential } from "./runtime-credentials.js";

export type CollectionOrder = "asc" | "desc";
export type RunStatus = "blocked" | "queued" | "leased" | "running" | "succeeded" | "failed" | "canceled";
export type TextTrustLevel = "human_authored" | "chat_authored" | "runtime_generated" | "automation_generated" | "public_untrusted";
export type RunOutcome = "succeeded" | "failed";
export type RunLeaseStatus = "active" | "released" | "expired";
export type EvaluationOutcome = "pass" | "fail" | "needs_review";
export type AgentPresenceStatus = "online" | "idle" | "busy" | "offline";
export type RuntimeReceiptAction =
  | "run_lease.acquired"
  | "run_lease.renewed"
  | "run_lease.released"
  | "artifact.created"
  | "evaluation.created";
export type BudgetLedgerEntryKind = "fund" | "delegate" | "consume" | "release";
export type BudgetDelegationStatus = "active" | "exhausted" | "revoked";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected";
export type SearchResourceType =
  | "space"
  | "agent"
  | "task"
  | "run"
  | "artifact"
  | "evaluation"
  | "space_answer"
  | "audit_event"
  | "automation_profile";

export interface PageQuery {
  limit?: number;
  cursor?: string;
  order?: CollectionOrder;
}

export interface OptionalSpaceScopedInput {
  space_id?: string;
}

export interface SpaceScopedQuery extends OptionalSpaceScopedInput {}

export type SpaceScopedInput = { space_id: string };

export interface CollectionPage<T> {
  items: T[];
  nextCursor: string | null;
  order: string | null;
  headers: Record<string, string>;
}

export interface SwarmRequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  maxResponseBytes?: number;
  maxErrorResponseBytes?: number;
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
}

export interface SwarmMutationOptions extends SwarmRequestOptions {
  idempotencyKey?: string;
  idempotencyPolicy?: "fresh-attempt" | "durable-content";
  intentKey?: string;
}

export interface Entity {
  id: string;
  key: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  primary_email: string;
  display_name: string;
  avatar_url?: string;
  default_entity_id?: string;
  default_space_id?: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  disabled_at?: string;
}

export interface UserIdentity {
  id: string;
  user_id: string;
  provider: string;
  provider_subject: string;
  primary_email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  disabled_at?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  active_entity_id?: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at?: string;
  revocation_reason?: string;
}

export interface ConnectedClientRuntimeHeartbeat {
  status?: string;
  region?: string;
  protocol?: string;
  version?: string;
  execution_mode?: string;
  sandbox_provider?: string;
  sandbox_preset?: string;
}

export interface ConnectedClientWebhookFollowUp {
  preset_key?: string;
  presetKey?: string;
  name?: string;
  url?: string;
  signing_secret?: string;
  signingSecret?: string;
}

export interface IssuedUserSession {
  session: UserSession;
  token: string;
}

export interface IssuedProviderSession {
  user: User;
  identity: UserIdentity;
  session: UserSession;
  token: string;
}

export interface CurrentUserResponse {
  user: User;
  session: UserSession;
  active_entity_role?: "entity_owner" | "entity_admin" | "entity_member";
}

export interface Space {
  id: string;
  entity_id: string;
  key: string;
  name: string;
  description?: string;
  memory_policy?: SpaceMemoryPolicy;
  cloud_execution_access?: "all_members" | "admins_only" | "disabled";
  created_at: string;
}

export type SpaceMemoryPolicy = "off" | "suggest" | "auto_promote_safe";
export type UpdateSpaceLearningPolicyInput = Readonly<{ memory_policy: SpaceMemoryPolicy; expected_updated_at: string; confirm_verified_auto_promotion: boolean }>;

/** Current connection authorization, not a durable Agent or online readiness. */
export interface ExecutionParticipant {
  id: string;
  executor_identity_id: string;
  name: string;
  kind: "client" | "agent";
  is_self: boolean;
  can_execute: boolean;
  created_at: string;
}

export interface Agent {
  id: string;
  space_id: string;
  kind: string;
  name?: string;
  description?: string;
  capabilities: string[];
  created_at: string;
}

export interface AgentCapabilityManifest {
  id: string;
  space_id: string;
  agent_id: string;
  tools: string[];
  models: string[];
  connectors: string[];
  regions: string[];
  protocols: string[];
  latency_class?: string;
  cost_class?: string;
  safety_tier?: string;
  hosting_mode?: string;
  runtime_human_action_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AgentPresence {
  agent_id: string;
  space_id: string;
  status: AgentPresenceStatus;
  current_run_id?: string;
  current_run_lease_id?: string;
  region?: string;
  protocol?: string;
  version?: string;
  execution_mode?: string;
  sandbox_provider?: string;
  sandbox_preset?: string;
  metadata_trust?: string;
  last_heartbeat_at: string;
  updated_at: string;
}

export type RuntimeHintScopeMode = "space_any" | "target_agents" | "run_holder";
export type RuntimeHintKind = "run.available" | "run.requeued" | "run.stop_requested" | "run.unblocked";

export interface RuntimeHintEvent {
  id: string;
  sequence: number;
  space_id: string;
  agent_scope_mode: RuntimeHintScopeMode;
  target_agent_ids?: string[];
  hint_key: string;
  kind: RuntimeHintKind;
  run_id?: string;
  task_id?: string;
  source_run_id?: string;
  source_resource_type: string;
  source_resource_id: string;
  queued_reason_code?: string;
  current_status?: string;
  stop_requested?: boolean;
  automation_profile_id?: string;
  scheduler_policy_id?: string;
  created_at: string;
  expires_at: string;
}

export interface Task {
  id: string;
  space_id: string;
  title: string;
  description: string;
  text_trust?: TextTrustLevel;
  run_requirements?: RunRequirementsSpec;
  status: "active" | "canceled";
  created_at: string;
  updated_at: string;
  canceled_at?: string;
  cancel_reason?: string;
}

export interface ExecutionPolicySpec {
  max_runtime_seconds: number;
  max_tool_calls: number;
  max_external_requests: number;
  allow_network: boolean;
  allow_shell: boolean;
  allowed_tools?: string[];
}

export interface RunRequirementsSpec {
  execution_mode?: "agent" | "core";
  assignment_mode?: "self" | "specific" | "any" | "others";
  target_identity_ids?: string[];
  excluded_identity_ids?: string[];
  target_agent_ids?: string[];
  required_capabilities?: string[];
  required_tools?: string[];
  required_models?: string[];
  required_connectors?: string[];
  required_regions?: string[];
  required_protocols?: string[];
  required_hosting_mode?: string;
  required_runtime_human_action_tags?: string[];
  required_approval_actions?: string[];
  result_approval_actions?: string[];
}

export interface RunContextRefSpec {
  resource_type: "run" | "task" | "artifact" | "evaluation";
  resource_id: string;
}

export interface ScoringDimensionRule {
  key: string;
  weight_bps: number;
  min_required?: number;
}

export interface ScoringContract {
  rubric_key: string;
  version: number;
  pass_threshold: number;
  fail_threshold: number;
  strict_mode?: boolean;
  dimensions: ScoringDimensionRule[];
  accepted_evaluation_method_keys?: string[];
}

export interface LaunchTemplate {
  id: string;
  space_id: string;
  name: string;
  summary?: string;
  title: string;
  description: string;
  execution_policy_id?: string;
  run_requirements: RunRequirementsSpec;
  scoring_contract?: ScoringContract;
  run_context_refs?: RunContextRefSpec[];
  created_at: string;
  updated_at: string;
  disabled_at?: string;
}

export type PromptCaptureMode = "off" | "compiled_only" | "raw_and_compiled";
export type PromptVisibilityMode = "hidden" | "space" | "public_compiled_only" | "public_raw_and_compiled";

export interface AutomationProfileTaskInput {
  title: string;
  description: string;
  execution_policy_id?: string;
}

export interface AutomationProfileLaunchTemplateInput {
  name: string;
  summary?: string;
  title: string;
  description: string;
  execution_policy_id?: string;
  run_requirements?: RunRequirementsSpec;
  scoring_contract: ScoringContract;
  run_context_refs?: RunContextRefSpec[];
}

export interface AutomationProfile {
  id: string;
  space_id: string;
  key: string;
  name: string;
  summary?: string;
  compiler_key: string;
  compiler_version: string;
  launch_template_id: string;
  review_task_id?: string;
  review_execution_policy_id?: string;
  remediation_task_id?: string;
  finalize_task_id?: string;
  pass_scheduler_policy_id?: string;
  needs_review_scheduler_policy_id?: string;
  fail_scheduler_policy_id?: string;
  review_threshold: number;
  prompt_capture_mode: PromptCaptureMode;
  created_at: string;
  updated_at: string;
  disabled_at?: string;
}

export interface RunQueuedReason {
  code:
    | "awaiting_dependencies"
    | "queued_ready"
    | "waiting_for_agent"
    | "no_matching_runtime_online"
    | "waiting_for_target_runtime"
    | "waiting_for_capability_match"
    | "waiting_for_runtime_capacity"
    | "runtime_missing_manifest"
    | "waiting_for_approval"
    | "waiting_for_budget";
  target_agent_ids?: string[];
  required_capabilities?: string[];
  required_tools?: string[];
  required_models?: string[];
  required_protocols?: string[];
  required_connectors?: string[];
  required_regions?: string[];
  required_runtime_human_action_tags?: string[];
  required_approval_actions?: string[];
  required_hosting_mode?: string;
  waiting_on_budget?: boolean;
  waiting_on_approval?: boolean;
}

export interface ExecutionCapabilities {
  capabilities?: string[];
  tools?: string[];
  models?: string[];
  connectors?: string[];
  regions?: string[];
  protocols?: string[];
  runtime_human_action_tags?: string[];
}

export interface ConnectedRuntimePreview {
  agent_id: string;
  name: string;
  presence: AgentPresenceStatus;
  last_seen_at: string;
}

export interface Run {
  id: string;
  entity_id: string;
  space_id: string;
  run_group_id: string;
  root_run_id: string;
  run_role_key: "main" | "subrun";
  run_depth: number;
  spawned_by_run_id?: string;
  spawn_reason_key?: string;
  core_id?: string;
  facet_instance_id?: string;
  task_id?: string;
  status: RunStatus;
  run_lease_id?: string;
  attempt: number;
  execution_policy_id?: string;
  model_route_policy_id?: string;
  execution_policy: ExecutionPolicySpec;
  run_requirements: RunRequirementsSpec;
  scoring_contract?: ScoringContract;
  scoring_contract_hash?: string;
  automation_profile_id?: string;
  eligible_agent_count?: number;
  eligible_runtime_count?: number;
  eligible_runtimes_preview?: ConnectedRuntimePreview[];
  queued_reason?: RunQueuedReason;
  run_context_ref_count?: number;
  run_context_preview?: RunContextPreviewItem[];
  run_context_preview_truncated?: boolean;
  latest_handoff_artifact?: RunArtifactPreview;
  latest_context_summary?: RunContextSummary;
  latest_handoff_summary?: RunHandoffSummary;
  automation_profile_summary?: RunAutomationProfileSummary;
  prompt_capture_summary?: RunPromptCaptureSummary;
  follow_up_summary?: RunFollowUpSummary;
  scheduler_policy_id?: string;
  trigger_resource_type?: string;
  trigger_resource_id?: string;
  source_run_id?: string;
  stop_requested_at?: string;
  stop_reason?: string;
  created_at: string;
  updated_at: string;
  finished_at?: string;
}

export interface RunGroup {
  id: string;
  entity_id: string;
  space_id: string;
  requested_by_identity_id?: string;
  root_run_id?: string;
  primary_task_id?: string;
  core_id?: string;
  facet_instance_id?: string;
  agent_id?: string;
  goal_summary?: string;
  status: "open" | "running" | "blocked" | "completed" | "failed" | "cancelled";
  max_subrun_depth: number;
  max_total_subruns: number;
  max_concurrent_subruns: number;
  active_run_count: number;
  total_spawned_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  canceled_at?: string;
}

export interface RunContextPreviewItem {
  position: number;
  resource_type: "run" | "task" | "artifact" | "evaluation";
  resource_id: string;
  title?: string;
  summary?: string;
  artifact_kind?: string;
}

export interface RunArtifactPreview {
  id: string;
  kind: string;
  media_type: string;
  summary?: string;
  summary_truncated?: boolean;
  created_at: string;
}

export interface RunContextSummaryItem {
  resource_type: "run" | "task" | "artifact" | "evaluation";
  resource_id: string;
  artifact_id?: string;
  artifact_kind?: string;
  title?: string;
  source_run_id?: string;
  source_task_title?: string;
  created_at: string;
}

export interface RunContextSummary {
  item_count: number;
  top_items?: RunContextSummaryItem[];
}

export interface RunHandoffSummary {
  artifact_id: string;
  artifact_kind: string;
  summary?: string;
  author_agent_id?: string;
  author_name?: string;
  created_at: string;
}

export interface RunAutomationProfileSummary {
  id: string;
  key: string;
  name: string;
  review_threshold: number;
  prompt_capture_mode: "off" | "compiled_only" | "raw_and_compiled";
}

export interface RunPromptCaptureSummary {
  compiled_brief_captured: boolean;
  raw_prompt_captured: boolean;
  redaction_applied: boolean;
  compiled_brief_artifact_id?: string;
  raw_prompt_artifact_id?: string;
  redaction_report_artifact_id?: string;
}

export interface RunFollowUpSummary {
  kind: "automation_review_handoff" | "scheduler_trigger";
  source_run_id?: string;
  source_task_title?: string;
  automation_profile_id?: string;
  automation_profile_name?: string;
  review_threshold?: number;
  trigger_resource_type?: string;
  trigger_resource_id?: string;
  trigger_outcome?: EvaluationOutcome;
  trigger_score?: number;
}

export interface RunContextRef {
  id: string;
  space_id: string;
  run_id: string;
  position: number;
  resource_type: "run" | "task" | "artifact" | "evaluation";
  resource_id: string;
  created_at: string;
}

export interface RunContextArtifact {
  artifact: Artifact;
  body?: string;
  body_truncated?: boolean;
}

export interface ResolvedRunContextRef {
  ref: RunContextRef;
  task?: Task;
  run?: Run;
  run_group?: RunGroup;
  evaluation?: Evaluation;
  artifact?: RunContextArtifact;
}

export interface RunContext {
  run: Run;
  run_group?: RunGroup;
  task?: Task;
  context_refs: ResolvedRunContextRef[];
}

export interface RunLease {
  id: string;
  run_id: string;
  core_id: string;
  leased_by_identity_id: string;
  status: RunLeaseStatus;
  issued_at: string;
  renewed_at: string;
  expires_at: string;
  released_at?: string;
}

export interface RunAcquisition {
  run: Run;
  run_lease: RunLease;
}

export interface SpaceCore {
  id: string;
  entity_id: string;
  space_id: string;
  identity_id: string;
  created_by_identity_id?: string;
  name: string;
  core_profile_key: string;
  location_key: string;
  isolation_profile_key: string;
  backend_provider_key: string;
  capability_keys: string[];
  capability_policy: Record<string, string>;
  trust_posture_key: string;
  region?: string;
  status: string;
  is_default: boolean;
  max_concurrent_runs: number;
  max_run_seconds: number;
  max_subrun_depth: number;
  max_total_subruns_per_run_group: number;
  max_concurrent_subruns: number;
  daily_credit_limit: number;
  monthly_credit_limit: number;
  degrade_reason?: string;
  created_at: string;
  updated_at: string;
  last_heartbeat_at?: string;
  disabled_at?: string;
}

export interface CoreHealth {
  core: SpaceCore;
  dispatchable: boolean;
  status: string;
  reason: string;
  repair_action_key: string;
}

export interface UsageReceipt {
  id: string;
  entity_id: string;
  space_id?: string;
  core_id?: string;
  facet_instance_id?: string;
  run_group_id?: string;
  run_id?: string;
  source_resource_type_key: string;
  source_resource_id: string;
  usage_unit_key: string;
  quantity: number;
  cost_units?: number;
  currency_code?: string;
  pricing_snapshot_ref?: string;
  usage_hash: string;
  idempotency_key: string;
  external_billing_ref?: string;
  created_at: string;
}

export interface CoreRunnerExecutionResult {
  run: Run;
  model_call: {
    id: string;
    status: string;
  };
  artifact: Artifact;
  publication: {
    entry?: {
      id: string;
      entry_descriptor_key: string;
      source_resource_ref?: string;
    };
  };
  usage?: UsageReceipt[];
}

export interface RunLaunch {
  task: Task;
  run: Run;
}

export interface BootstrapSpaceResult {
  space: Space;
  agent: Agent;
  credential: IssuedRuntimeCredential;
  launch_template?: LaunchTemplate;
  automation_profile?: AutomationProfile;
  launched?: RunLaunch;
}

export interface ClientConnection {
  mode: "direct_api";
  space_id: string;
  agent_id: string;
  authentication_type: "bearer";
  authorization_header: "Authorization";
}

export interface ConnectClientResult {
  space: Space;
  agent: Agent;
  credential: IssuedRuntimeCredential;
  connection: ClientConnection;
  agent_created: boolean;
}

export interface ConnectCurrentUserClientResult {
  user: User;
  entity: Entity;
  space: Space;
  agent: Agent;
  credential: IssuedRuntimeCredential;
  connection: ClientConnection;
  created_entity: boolean;
  created_space: boolean;
  agent_created: boolean;
}

export interface BootstrapCurrentUserEntityResult {
  user: User;
  session: UserSession;
  entity: Entity;
  entity_role: "entity_owner" | "entity_admin" | "entity_member";
  space: Space;
  space_role: "space_viewer" | "space_operator" | "space_admin";
  launch_template?: LaunchTemplate;
  automation_profile?: AutomationProfile;
  session_activated: boolean;
}

export interface ConnectCurrentUserAndLaunchInput {
  connection?: ConnectCurrentUserClientInput;
  runtime_heartbeat?: ConnectedClientRuntimeHeartbeat;
  runtimeHeartbeat?: ConnectedClientRuntimeHeartbeat;
  webhook_follow_up?: ConnectedClientWebhookFollowUp;
  webhookFollowUp?: ConnectedClientWebhookFollowUp;
  launch?: {
    ttl_seconds?: number;
    automation_profile_id?: string;
    launch_template_id?: string;
    title?: string;
    description?: string;
    execution_policy_id?: string;
    run_requirements?: RunRequirementsSpec;
    run_context_refs?: RunContextRefSpec[];
    prompt_capture_mode?: string;
    source_prompt?: string;
    compiled_brief?: string;
  };
}

export interface ConnectCurrentUserAndLaunchResult {
  user: User;
  entity: Entity;
  space: Space;
  agent: Agent;
  credential: RuntimeCredential;
  runtime_access: IssuedRuntimeCredential;
  connection: ClientConnection;
  runtime_presence: AgentPresence | null;
  webhook_target?: WebhookTarget;
  task: Task;
  run: Run;
  run_lease: RunLease;
  created_entity: boolean;
  created_space: boolean;
  agent_created: boolean;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  entity_id?: string;
  space_id?: string;
  resource_type: string;
  resource_id: string;
  action: string;
  data?: Record<string, string>;
  occurred_at: string;
}

export interface SearchResult {
  resource_type: SearchResourceType;
  resource_id: string;
  entity_id: string;
  space_id: string;
  visibility_scope: "private" | "authorized" | "public";
  title: string;
  snippet: string;
  score: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, string>;
}

export * from "./intelligence.js";

export interface Artifact {
  id: string;
  space_id: string;
  run_id?: string;
  repository_id?: string;
  kind: string;
  media_type: string;
  sha256: string;
  size_bytes: number;
  created_at: string;
}

export type { ArtifactContent, VerifiedArtifactDownload, ArtifactDownloadOptions } from "./artifact-download.js";
export interface Evaluation {
  id: string;
  space_id: string;
  run_id?: string;
  artifact_id?: string;
  evaluator_agent_id?: string;
  evaluated_by_identity_id?: string;
  evaluation_method_key: string;
  outcome: EvaluationOutcome;
  score: number;
  rubric_key?: string;
  dimensions?: Record<string, number>;
  confidence?: number;
  signals?: string[];
  contract_hash?: string;
  summary: string;
  created_at: string;
}

export interface BudgetAccount {
  id: string;
  space_id: string;
  name: string;
  unit: string;
  funded_balance: number;
  reserved_balance: number;
  consumed_balance: number;
  available_balance: number;
  hard_limit: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetLedgerEntry {
  id: string;
  account_id: string;
  space_id: string;
  delegation_id?: string;
  target_agent_id?: string;
  target_run_id?: string;
  approval_request_id?: string;
  kind: BudgetLedgerEntryKind;
  amount: number;
  reason?: string;
  created_at: string;
}

export interface BudgetDelegation {
  id: string;
  account_id: string;
  space_id: string;
  target_agent_id?: string;
  target_run_id?: string;
  approval_request_id?: string;
  amount: number;
  remaining_amount: number;
  status: BudgetDelegationStatus;
  reason?: string;
  created_at: string;
  updated_at: string;
  revoked_at?: string;
}

export interface ApprovalRequest {
  id: string;
  space_id: string;
  resource_type: string;
  resource_id?: string;
  action: string;
  requested_by: string;
  status: ApprovalRequestStatus;
  summary: string;
  resolution_note?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface BudgetAccountFundingResult {
  budget_account: BudgetAccount;
  budget_ledger_entry: BudgetLedgerEntry;
}

export interface BudgetDelegationMutationResult {
  budget_delegation: BudgetDelegation;
  budget_account: BudgetAccount;
  budget_ledger_entry?: BudgetLedgerEntry | null;
}

export interface DirectorySpaceEntry {
  space_id: string;
  entity_id: string;
  entity_key?: string;
  entity_name?: string;
  key: string;
  name: string;
  description?: string;
  participation_mode: string;
  directory_visible: boolean;
}

export interface DirectoryAgentEntry {
  agent_id: string;
  space_id: string;
  space_key?: string;
  space_name?: string;
  entity_id?: string;
  entity_key?: string;
  entity_name?: string;
  kind: string;
  name?: string;
  description?: string;
  capabilities: string[];
}

export interface SpaceOperatorActivityItem {
  id: string;
  space_id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  actor_id: string;
  agent_id?: string;
  agent_name?: string;
  run_id?: string;
  run_status?: string;
  task_id?: string;
  task_title?: string;
  data?: Record<string, string>;
  occurred_at: string;
}

export interface SpaceOperatorPresenceEntry {
  agent_id: string;
  space_id: string;
  kind: string;
  name: string;
  description?: string;
  capabilities?: string[];
  status: AgentPresenceStatus;
  last_heartbeat_at: string;
  current_run_id?: string;
  current_run_status?: string;
  current_run_task_id?: string;
  current_run_task_title?: string;
  current_run_lease_id?: string;
  region?: string;
  protocol?: string;
  version?: string;
  execution_mode?: string;
  sandbox_provider?: string;
  sandbox_preset?: string;
  capability_manifest_id?: string;
  tools?: string[];
  models?: string[];
  connectors?: string[];
  regions?: string[];
  protocols?: string[];
  latency_class?: string;
  cost_class?: string;
  safety_tier?: string;
  hosting_mode?: string;
  runtime_human_action_tags?: string[];
  trust_policy_present: boolean;
  allow_run_claim: boolean;
  allow_artifact_publish: boolean;
  allow_evaluation_publish: boolean;
  allow_budget_delegation: boolean;
  require_signed_receipts: boolean;
  updated_at: string;
}

export interface SpaceSignedStatusEntry {
  receipt_id: string;
  space_id: string;
  agent_id: string;
  agent_name?: string;
  run_id?: string;
  run_status?: string;
  task_id?: string;
  task_title?: string;
  run_lease_id?: string;
  action: RuntimeReceiptAction;
  issued_at: string;
  expires_at: string;
  expired: boolean;
  payload_sha256: string;
  key_id: string;
  signature_valid: boolean;
  signature_required: boolean;
}

export interface WebhookAction {
  action: string;
  label: string;
  description: string;
}

export interface WebhookActionPreset {
  key: string;
  label: string;
  description: string;
  included_actions: string[];
}

export interface ChatClientProfile {
  key: string;
  label: string;
  description: string;
  connection_mode: string;
  primary_entry_path: string;
  same_client_supported: boolean;
  delegated_supported: boolean;
  follow_up_preset_key: string;
  recommended_prompt_hints: string[];
}

export interface WebhookTarget {
  id: string;
  space_id: string;
  name: string;
  url: string;
  included_actions: string[];
  has_signing_secret: boolean;
  max_attempts: number;
  initial_backoff_seconds: number;
  max_backoff_seconds: number;
  last_delivered_at?: string;
  last_delivery_id?: string;
  last_failed_at?: string;
  last_failed_delivery_id?: string;
  dead_letter_count?: number;
  created_at: string;
  updated_at: string;
  disabled_at?: string;
}

export interface WebhookTargetState {
  target_id: string;
  last_audit_sequence: number;
  last_audit_event_id?: string;
  last_reconciled_at?: string;
  last_delivered_at?: string;
  last_delivery_id?: string;
  last_failed_at?: string;
  last_failed_delivery_id?: string;
  dead_letter_count: number;
  updated_at: string;
}

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "dead_letter";

export interface WebhookDelivery {
  id: string;
  target_id: string;
  space_id: string;
  audit_event_id: string;
  target_url: string;
  payload: string;
  signature: string;
  status: WebhookDeliveryStatus;
  attempt_count: number;
  failure_count: number;
  response_status_code?: number;
  last_error?: string;
  last_attempt_at?: string;
  next_attempt_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReconcileWebhookTargetResult {
  target: WebhookTarget;
  state: WebhookTargetState;
  queued_deliveries: WebhookDelivery[];
  processed_count: number;
}

export type RuntimeAttachState = "awaiting_manifest" | "awaiting_heartbeat" | "connected" | "stale";

export interface RuntimeAttachStatusCounts {
  awaiting_manifest: number;
  awaiting_heartbeat: number;
  connected: number;
  stale: number;
}

export interface SpaceAttention {
  pending_approval_count: number;
  blocked_run_count: number;
  queued_run_count: number;
  stale_runtime_count: number;
  requires_human_action: boolean;
}

export interface SpaceRuntimeAttachStatus {
  space_id: string;
  agent_id: string;
  kind: string;
  name: string;
  runtime_attach_state: RuntimeAttachState;
  active_credential_count: number;
  has_active_credential: boolean;
  latest_capability_manifest_id?: string;
  has_capability_manifest: boolean;
  last_heartbeat_at?: string;
  has_recent_heartbeat: boolean;
  runtime_protocol?: string;
  runtime_version?: string;
  runtime_execution_mode?: string;
  runtime_sandbox_provider?: string;
  runtime_sandbox_preset?: string;
  runtime_metadata_trust?: string;
  trust_policy_present?: boolean;
  allow_run_claim?: boolean;
  allow_artifact_publish?: boolean;
  allow_evaluation_publish?: boolean;
  allow_budget_delegation?: boolean;
  require_signed_receipts?: boolean;
  presence_status?: string;
  is_live: boolean;
}

export interface SpaceArtifactSummary {
  id: string;
  run_id?: string;
  task_id?: string;
  task_title?: string;
  kind: string;
  media_type: string;
  summary?: string;
  summary_truncated?: boolean;
  created_at: string;
}

export interface SpaceEvaluationSummary {
  id: string;
  run_id?: string;
  task_id?: string;
  task_title?: string;
  artifact_id?: string;
  evaluator_agent_id?: string;
  evaluator_name?: string;
  outcome: EvaluationOutcome;
  score: number;
  summary?: string;
  summary_truncated?: boolean;
  created_at: string;
}

export interface SpaceOperatorSummary {
  space_id: string;
  entity_id: string;
  entity_key?: string;
  entity_name?: string;
  key: string;
  name: string;
  description?: string;
  participation_mode?: string;
  directory_visible: boolean;
  agent_count: number;
  manifest_backed_agent_count: number;
  active_run_lease_count: number;
  webhook_target_count: number;
  pending_webhook_deliveries: number;
  dead_letter_webhook_deliveries: number;
  runtime_receipt_count: number;
  active_runtime_credential_count: number;
  budget_account_count: number;
  active_budget_delegation_count: number;
  pending_approval_request_count: number;
  runtime_attach_counts: RuntimeAttachStatusCounts;
  latest_artifact?: SpaceArtifactSummary;
  latest_handoff_artifact?: SpaceArtifactSummary;
  latest_evaluation?: SpaceEvaluationSummary;
  run_counts: Record<string, number>;
  presence_counts: Record<string, number>;
  last_activity_at?: string;
}

export interface SpaceSinceLastViewDigest {
  last_viewed_at: string;
  run_completed_count: number;
  run_succeeded_count: number;
  run_failed_count: number;
  run_canceled_count: number;
  artifact_published_count: number;
  handoff_published_count: number;
  evaluation_published_count: number;
  approval_requested_count: number;
  runtime_connected_count: number;
  runtime_disconnected_count: number;
  top_changes?: string[];
}

export interface SpaceOperatorRuntimeCredentialEntry {
  agent_id: string;
  space_id: string;
  kind: string;
  name: string;
  description?: string;
  capabilities?: string[];
  latest_capability_manifest_id?: string;
  runtime_attach_state?: RuntimeAttachState;
  last_heartbeat_at?: string;
  runtime_protocol?: string;
  runtime_version?: string;
  runtime_execution_mode?: string;
  runtime_sandbox_provider?: string;
  runtime_sandbox_preset?: string;
  runtime_metadata_trust?: string;
  credentials: RuntimeCredential[];
}

export interface SpaceOperatorGovernanceView {
  space_id: string;
  active_credential_count: number;
  budget_account_count: number;
  active_budget_delegations: number;
  pending_approval_requests: number;
  runtime_attach_counts: RuntimeAttachStatusCounts;
  active_credentials: SpaceOperatorRuntimeCredentialEntry[];
  budget_accounts: BudgetAccount[];
  active_delegations: BudgetDelegation[];
  pending_approval_queue: ApprovalRequest[];
}

export interface SpaceOperatorLiveSnapshot {
  summary: SpaceOperatorSummary;
  partial?: boolean;
  snapshot_revision?: number;
  snapshot_at?: string;
  attention?: SpaceAttention;
  pending_approval_queue?: ApprovalRequest[];
  runtime_attach_statuses?: SpaceRuntimeAttachStatus[];
  activity: SpaceOperatorActivityItem[];
  presence: SpaceOperatorPresenceEntry[];
  signed_status?: SpaceSignedStatusEntry[];
  governance?: SpaceOperatorGovernanceView;
  runs: Run[];
}

export interface ControlPlaneOperationStats {
  count: number;
  error_count: number;
  total_duration_ms: number;
  last_duration_ms: number;
  max_duration_ms: number;
  last_candidate_count?: number;
  max_candidate_count?: number;
  last_payload_bytes?: number;
  max_payload_bytes?: number;
  last_observed_at?: string;
}

export interface ControlPlaneObservabilitySnapshot {
  run_acquisition: ControlPlaneOperationStats;
  run_context_resolution: ControlPlaneOperationStats;
  artifact_search_indexing: ControlPlaneOperationStats;
}

export interface SwarmAPIErrorDetails {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface EndpointResponseByteLimits {
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Absolute canonical route, optionally with {named} path parameters. */
  path: string;
  maxResponseBytes?: number;
  maxErrorResponseBytes?: number;
}

export interface SwarmClientOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  sseMaxEventBytes?: number;
  sseMaxBufferBytes?: number;
  timeoutMs?: number;
  allowInsecureTransport?: boolean;
  maxResponseBytes?: number;
  maxErrorResponseBytes?: number;
  responseByteLimits?: EndpointResponseByteLimits[];
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
}

export type CreateAgentInput = SpaceScopedInput & {
  kind: string;
  name?: string;
  description?: string;
  capabilities?: string[];
};

export interface CreateAgentCapabilityManifestInput {
  agent_id: string;
  tools?: string[];
  models?: string[];
  connectors?: string[];
  regions?: string[];
  protocols?: string[];
  latency_class?: string;
  cost_class?: string;
  safety_tier?: string;
  hosting_mode?: string;
  runtime_human_action_tags?: string[];
}

export interface HeartbeatAgentInput {
  status?: AgentPresenceStatus;
  current_run_id?: string;
  current_run_lease_id?: string;
  region?: string;
  protocol?: string;
  version?: string;
  execution_mode?: string;
  sandbox_provider?: string;
  sandbox_preset?: string;
}

export type CreateTaskInput = SpaceScopedInput & {
  title: string;
  description: string;
  run_requirements?: RunRequirementsSpec;
};

export interface UpdateTaskInput {
  title: string;
  description: string;
  run_requirements?: RunRequirementsSpec;
  expected_updated_at?: string;
}

export interface CancelTaskInput { reason?: string; }

export interface RunExecutionInput {
  goal_summary?: string;
  core_id?: string;
  automation_profile_id?: string;
  execution_policy_id?: string;
  model_route_policy_id?: string;
  run_requirements?: RunRequirementsSpec;
  run_context_refs?: RunContextRefSpec[];
}

export interface TaskRunLaunchInput extends RunExecutionInput {
  expected_task_updated_at?: string;
}

/** Hosted/device launch, including Task creation and prompt capture. */
export interface LaunchRunInput {
  model_route_policy_id?: string;
  automation_profile_id?: string;
  launch_template_id?: string;
  title?: string;
  description?: string;
  execution_policy_id?: string;
  prompt_capture_mode?: PromptCaptureMode;
  prompt_visibility_mode?: PromptVisibilityMode;
  acknowledge_public_raw_prompt_visibility?: boolean;
  source_prompt?: string;
  compiled_brief?: string;
  run_requirements?: RunRequirementsSpec;
  run_context_refs?: RunContextRefSpec[];
}

export interface BootstrapSpaceAgentInput {
  kind: string;
  name?: string;
  description?: string;
  capabilities?: string[];
}

export interface BootstrapSpaceCredentialInput {
  description?: string;
  ttl_seconds?: number;
}

export interface BootstrapSpaceLaunchTemplateInput {
  name: string;
  summary?: string;
  title: string;
  description: string;
  execution_policy_id?: string;
  run_requirements?: RunRequirementsSpec;
  run_context_refs?: RunContextRefSpec[];
}

export interface BootstrapSpaceAutomationProfileInput {
  key: string;
  name: string;
  summary?: string;
  compiler_key: string;
  review_threshold?: number;
  prompt_capture_mode: PromptCaptureMode;
  launch_template: AutomationProfileLaunchTemplateInput;
  review_task: AutomationProfileTaskInput;
  remediation_task: AutomationProfileTaskInput;
  finalize_task: AutomationProfileTaskInput;
}

export interface BootstrapSpaceLaunchInput extends Omit<LaunchRunInput, "automation_profile_id" | "launch_template_id" | "model_route_policy_id"> {
  mode?: "direct" | "launch_template" | "automation_profile";
}

export interface BootstrapSpaceInput {
  space: {
    key: string;
    name: string;
    description?: string;
  };
  agent: BootstrapSpaceAgentInput;
  credential?: BootstrapSpaceCredentialInput;
  launch_template?: BootstrapSpaceLaunchTemplateInput;
  automation_profile?: BootstrapSpaceAutomationProfileInput;
  launch?: BootstrapSpaceLaunchInput;
}

export interface ConnectClientCredentialInput {
  description?: string;
  ttl_seconds?: number;
}

export interface ConnectClientInput {
  agent_id?: string;
  kind?: string;
  name?: string;
  description?: string;
  capabilities?: string[];
  credential?: ConnectClientCredentialInput;
}

export interface ConnectCurrentUserClientInput extends ConnectClientInput {
  space_id?: string;
  spaceId?: string;
  space_name?: string;
  spaceName?: string;
  space_description?: string;
  spaceDescription?: string;
}

export interface BootstrapCurrentUserEntityAutomationProfileInput {
  key: string;
  name: string;
  summary?: string;
  compiler_key: string;
  review_threshold?: number;
  prompt_capture_mode: PromptCaptureMode;
  launch_template: AutomationProfileLaunchTemplateInput;
  review_task: AutomationProfileTaskInput;
  remediation_task: AutomationProfileTaskInput;
  finalize_task: AutomationProfileTaskInput;
}

export interface BootstrapCurrentUserEntityInput {
  key?: string;
  name: string;
  activate_session?: boolean;
  space?: {
    key?: string;
    name?: string;
    description?: string;
  };
  launch_template?: AutomationProfileLaunchTemplateInput;
  automation_profile?: BootstrapCurrentUserEntityAutomationProfileInput;
}

export interface PromptLaunchInput extends LaunchRunInput {
  target_agent_id?: string;
}

export type CreateArtifactInput = SpaceScopedInput & {
  run_id?: string;
  repository_id?: string;
  runtime_receipt_id?: string;
  kind: string;
  media_type: string;
  body: string;
  parent_artifact_ids?: string[];
};

export type CreateEvaluationInput = SpaceScopedInput & {
  run_id?: string;
  artifact_id?: string;
  outcome?: EvaluationOutcome;
  score?: number;
  rubric_key?: string;
  dimensions?: Record<string, number>;
  confidence?: number;
  signals?: string[];
  contract_hash?: string;
  summary: string;
};

export type CreateAutomationProfileInput = SpaceScopedInput & {
  key: string;
  name: string;
  summary?: string;
  compiler_key: string;
  review_threshold?: number;
  prompt_capture_mode: PromptCaptureMode;
  launch_template: AutomationProfileLaunchTemplateInput;
  review_task: AutomationProfileTaskInput;
  remediation_task: AutomationProfileTaskInput;
  finalize_task: AutomationProfileTaskInput;
};

export interface UpdateAutomationProfileInput {
  key: string;
  name: string;
  summary?: string;
  compiler_key: string;
  review_threshold?: number;
  prompt_capture_mode: PromptCaptureMode;
  launch_template: AutomationProfileLaunchTemplateInput;
  review_task: AutomationProfileTaskInput;
  remediation_task: AutomationProfileTaskInput;
  finalize_task: AutomationProfileTaskInput;
}

export type CreateBudgetAccountInput = SpaceScopedInput & {
  name: string;
  unit: string;
  hard_limit?: number;
};

export interface CreateBudgetDelegationInput {
  account_id: string;
  target_agent_id?: string;
  target_run_id?: string;
  approval_request_id?: string;
  amount: number;
  reason?: string;
}

export type CreateApprovalRequestInput = SpaceScopedInput & {
  resource_type: string;
  resource_id?: string;
  action: string;
  summary: string;
};
