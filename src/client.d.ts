import type {
  Agent,
  RuntimeCredential,
  ExecutionParticipant,
  AgentCapabilityManifest,
  AgentPresence,
  AgentPresenceStatus,
  ApprovalRequest,
  ApprovalRequestStatus,
  Artifact,
  ArtifactContent,
  ArtifactDownloadOptions,
  VerifiedArtifactDownload,
  AuditEvent,
  AutomationProfile,
  AutomationProfileLaunchTemplateInput,
  AutomationProfileTaskInput,
  BootstrapCurrentUserEntityAutomationProfileInput,
  BootstrapCurrentUserEntityInput,
  BootstrapCurrentUserEntityResult,
  BootstrapSpaceAgentInput,
  BootstrapSpaceAutomationProfileInput,
  BootstrapSpaceCredentialInput,
  BootstrapSpaceInput,
  BootstrapSpaceLaunchInput,
  BootstrapSpaceLaunchTemplateInput,
  BootstrapSpaceResult,
  BudgetAccount,
  BudgetAccountFundingResult,
  CoreRunnerExecutionResult,
  BudgetDelegation,
  BudgetDelegationMutationResult,
  BudgetDelegationStatus,
  BudgetLedgerEntry,
  BudgetLedgerEntryKind,
  ChatClientProfile,
  ClientConnection,
  CollectionOrder,
  CollectionPage,
  CancelTaskInput,
  ConnectClientCredentialInput,
  ConnectClientInput,
  ConnectClientResult,
  ConnectCurrentUserAndLaunchInput,
  ConnectCurrentUserAndLaunchResult,
  ConnectCurrentUserClientInput,
  ConnectCurrentUserClientResult,
  ConnectedClientRuntimeHeartbeat,
  ConnectedClientWebhookFollowUp,
  ConnectedRuntimePreview,
  ControlPlaneObservabilitySnapshot,
  ControlPlaneOperationStats,
  CreateAgentCapabilityManifestInput,
  CreateAgentInput,
  CreateApprovalRequestInput,
  CreateArtifactInput,
  CreateAutomationProfileInput,
  CreateBudgetAccountInput,
  CreateBudgetDelegationInput,
  CreateEvaluationInput,
  CoreHealth,
  CreateTaskInput,
  CurrentUserResponse,
  DirectoryAgentEntry,
  DirectorySpaceEntry,
  Entity,
  Evaluation,
  EvaluationOutcome,
  ExecutionPolicySpec,
  ExecutionCapabilities,
  HeartbeatAgentInput,
  IssuedProviderSession,
  LaunchRunInput,
  LaunchTemplate,
  OptionalSpaceScopedInput,
  PageQuery,
  PromptCaptureMode,
  PromptLaunchInput,
  ReconcileWebhookTargetResult,
  ResolvedRunContextRef,
  Run,
  RunGroup,
  RunExecutionInput,
  RunAcquisition,
  RunArtifactPreview,
  RunAutomationProfileSummary,
  RunContext,
  RunContextArtifact,
  RunContextPreviewItem,
  RunContextRef,
  RunContextRefSpec,
  RunContextSummary,
  RunContextSummaryItem,
  RunFollowUpSummary,
  RunHandoffSummary,
  RunLaunch,
  RunLease,
  RunLeaseStatus,
  RunOutcome,
  RunPromptCaptureSummary,
  RunQueuedReason,
  RunRequirementsSpec,
  RunStatus,
  RuntimeAttachState,
  RuntimeAttachStatusCounts,
  RuntimeHintEvent,
  RuntimeHintKind,
  RuntimeHintScopeMode,
  RuntimeReceiptAction,
  ScoringContract,
  ScoringDimensionRule,
  SearchResourceType,
  SearchResult,
  Space,
  SpaceArtifactSummary,
  SpaceEvaluationSummary,
  SpaceOperatorActivityItem,
  SpaceOperatorGovernanceView,
  SpaceOperatorLiveSnapshot,
  SpaceOperatorPresenceEntry,
  SpaceOperatorSummary,
  SpaceScopedInput,
  SpaceScopedQuery,
  SpaceSignedStatusEntry,
  SpaceSinceLastViewDigest,
  SwarmAPIErrorDetails,
  SwarmClientOptions,
  SwarmMutationOptions,
  SwarmRequestOptions,
  Task,
  TaskRunLaunchInput,
  UpdateAutomationProfileInput,
  UpdateSpaceLearningPolicyInput,
  UpdateTaskInput,
  User,
  UserIdentity,
  UserSession,
  WebhookAction,
  WebhookActionPreset,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookTarget,
  WebhookTargetState
} from "./types.js";
import type {
  AgentActionStatus,
  AgentActionTrace,
  AgentActionTraceBatchResult,
  AgentActionTraceDetail,
  AppendAgentActionTraceBatchInput,
  PublishAgentCheckpointInput,
  PublishAgentCheckpointResult,
  AskSpaceInput,
  BuildSpaceContextPackInput,
  ContextPlan,
  ContextPlanInput,
  HandoffPreview,
  HandoffPreviewInput,
  CancelQueuedSpaceIntelligenceOperationInput,
  ChatSessionDigestResult,
  ClaimSpaceLearningQueueItemInput,
  CompleteSpaceLearningQueueItemInput,
  CreateChatSessionDigestInput,
  CreateSpaceIntelligenceOperationInput,
  CreateSpaceLearningCandidateFromArtifactInput,
  CreateSpaceLearningCandidateInput,
  CreateSpaceLearningQueueItemInput,
  CreateSpaceOperationRefInput,
  CreateTokenUsageEventInput,
  RejectSpaceLearningCandidateInput,
  CorrectSpaceLearningCandidateInput,
  CorrectSpaceLearningCandidateResult,
  SupersedeSpaceLearningCandidateInput,
  SupersedeSpaceLearningCandidateResult,
  SpaceActionIntelligenceCount,
  SpaceActionIntelligenceSummary,
  SpaceActionIntelligenceTokenUsage,
  SpaceActionIntelligenceTokenUsageBreakdownItem,
  SpaceActionIntelligenceTraceSample,
  SpaceAnswer,
  SpaceAnswerContract,
  SpaceBasicCollaborationContract,
  SpaceCapabilityDefinition,
  SpaceContextPack,
  SpaceContextPackItem,
  SpaceContextTokenSavings,
  SpaceDecisionGraph,
  SpaceIntelligenceOperation,
  SpaceIntelligenceOperationStatus,
  SpaceIntelligenceStatus,
  SpaceLearningCandidate,
  SpaceLearningFrontier,
  SpaceLearningQueueItem,
  SpaceLearningQueueKind,
  SpaceLearningQueueResult,
  SpaceLearningQueueStatus,
  SpaceMemoryEdge,
  SpaceMemoryNode,
  SpaceOperationBudgetContract,
  SpaceOperationContract,
  SpaceOperationContractSummary,
  SpaceOperationOutputContract,
  SpaceOperationRef,
  SpaceOperationRefDirection,
  SpaceProjection,
  SpacePromotionGate,
  SpacePromotionGateDecision,
  SpaceWorkContract,
  SubmitSpaceLearningQueueResultInput,
  SwarmStackLayer,
  TokenCountSource,
  TokenUsageEvent,
  TokenUsageRollup,
  TransitionSpaceIntelligenceOperationInput,
  UpdateQueuedSpaceIntelligenceOperationInput
} from "./intelligence.js";

import type { SwarmStreamOptions } from "./event-stream.js";

export class SwarmAPIError extends Error {
  constructor(message: string, details?: SwarmAPIErrorDetails);
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export class SwarmResponseLimitError extends Error {
  constructor(maxBytes: number, status: number);
  code: "response_too_large";
  maxBytes: number;
  status: number;
}

export class SwarmArtifactIntegrityError extends Error {
  constructor();
  code: "artifact_integrity_failed";
}

export interface SwarmRawRequestOptions extends SwarmRequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  idempotencyKey?: string;
  idempotencyPolicy?: "fresh-attempt" | "durable-content";
  effect?: "read" | "mutation";
  accept?: string;
  raw?: boolean;
  lastEventId?: string;
}

export class SwarmClient {
  constructor(options: SwarmClientOptions);
  request(method: string, path: string, options?: SwarmRawRequestOptions): Promise<any>;
  data(method: string, path: string, options?: SwarmRawRequestOptions): Promise<any>;
  get(path: string, options?: Omit<SwarmRawRequestOptions, "body" | "idempotencyKey" | "idempotencyPolicy" | "effect">): Promise<any>;
  post(path: string, body?: unknown, options?: Omit<SwarmRawRequestOptions, "body">): Promise<any>;
  patch(path: string, body?: unknown, options?: Omit<SwarmRawRequestOptions, "body">): Promise<any>;
  list(path: string, query?: Record<string, unknown>, options?: SwarmRequestOptions): Promise<CollectionPage<any>>;
  createEntity(input: { key?: string; name: string }, options?: SwarmMutationOptions): Promise<Entity>;
  getCurrentUser(options?: SwarmRequestOptions): Promise<CurrentUserResponse>;
  createProviderSession(
    input: {
      provider: string;
      provider_subject: string;
      primary_email: string;
      display_name: string;
      avatar_url?: string;
      active_entity_id?: string;
      ttl_seconds?: number;
      asserted_at: number;
      signature: string;
    },
    options?: SwarmRequestOptions
  ): Promise<IssuedProviderSession>;
  getUserSession(sessionId: string, options?: SwarmRequestOptions): Promise<UserSession>;
  revokeUserSession(sessionId: string, input?: { reason?: string }, options?: SwarmMutationOptions): Promise<UserSession>;
  createSpace(input: { entity_id: string; key: string; name: string; description?: string }, options?: SwarmMutationOptions): Promise<Space>;
  bootstrapSpace(entityId: string, input: BootstrapSpaceInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<BootstrapSpaceResult>;
  updateSpace(
    spaceId: string,
    input: { name?: string; description?: string },
    options?: SwarmMutationOptions
  ): Promise<Space>;
  updateSpaceLearningPolicy(
    spaceId: string,
    input: UpdateSpaceLearningPolicyInput,
    options?: SwarmMutationOptions
  ): Promise<Space>;
  connectSpaceClient(spaceId: string, input?: ConnectClientInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<ConnectClientResult>;
  connectClient(spaceId: string, input?: ConnectClientInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<ConnectClientResult>;
  connectCurrentUserClient(input?: ConnectCurrentUserClientInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<ConnectCurrentUserClientResult>;
  bootstrapCurrentUserEntity(input: BootstrapCurrentUserEntityInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<BootstrapCurrentUserEntityResult>;
  connectCurrentUserAndLaunch(input?: ConnectCurrentUserAndLaunchInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<ConnectCurrentUserAndLaunchResult>;
  createAgent(input: CreateAgentInput, options?: SwarmMutationOptions): Promise<Agent>;
  listAgents(query?: SpaceScopedQuery & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<Agent>>;

  listAgentRuntimeCredentials(agentId: string, query?: { active_only?: boolean } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<RuntimeCredential>>;
  /** Follow nextCursor even on empty pages; can_execute is authorization, not online readiness. */
  listSpaceAgentParticipants(spaceId: string, query?: PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<ExecutionParticipant>>;
  getAgent(agentId: string, options?: SwarmRequestOptions): Promise<Agent>;
  listSpaces(query?: { entity_id?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<Space>>;
  getSpace(spaceId: string, options?: SwarmRequestOptions): Promise<Space>;
  listLaunchTemplates(query?: SpaceScopedQuery & { active_only?: boolean } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<LaunchTemplate>>;
  createLaunchTemplate(input: SpaceScopedInput & { name: string; summary?: string; title: string; description: string; execution_policy_id?: string; run_requirements?: RunRequirementsSpec; scoring_contract?: ScoringContract; run_context_refs?: RunContextRefSpec[] }, options?: SwarmMutationOptions): Promise<LaunchTemplate>;
  getLaunchTemplate(templateId: string, options?: SwarmRequestOptions): Promise<LaunchTemplate>;
  updateLaunchTemplate(templateId: string, input: { name: string; summary?: string; title: string; description: string; execution_policy_id?: string; run_requirements?: RunRequirementsSpec; scoring_contract?: ScoringContract; run_context_refs?: RunContextRefSpec[] }, options?: SwarmMutationOptions): Promise<LaunchTemplate>;
  disableLaunchTemplate(templateId: string, options?: SwarmMutationOptions): Promise<LaunchTemplate>;
  listAutomationProfiles(query?: SpaceScopedQuery & { key?: string; active_only?: boolean } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<AutomationProfile>>;
  createAutomationProfile(input: CreateAutomationProfileInput, options?: SwarmMutationOptions): Promise<AutomationProfile>;
  getAutomationProfile(profileId: string, options?: SwarmRequestOptions): Promise<AutomationProfile>;
  updateAutomationProfile(profileId: string, input: UpdateAutomationProfileInput, options?: SwarmMutationOptions): Promise<AutomationProfile>;
  disableAutomationProfile(profileId: string, options?: SwarmMutationOptions): Promise<AutomationProfile>;
  listTasks(query?: SpaceScopedQuery & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<Task>>;
  createTask(input: CreateTaskInput, options?: SwarmMutationOptions): Promise<Task>;
  listRuns(query?: SpaceScopedQuery & { run_group_id?: string; task_id?: string; automation_profile_id?: string; status?: RunStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<Run>>;
  /** Hosted/device launch only. For normal external agents use launchRun or launchTaskRun. */
  launchSpaceRun(spaceId: string, input: LaunchRunInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<RunLaunch>;
  /** Queue one Run in a new Group. Agent credentials default to external execution. */
  launchRun(spaceId: string, input?: RunExecutionInput, options?: SwarmMutationOptions): Promise<Run>;
  createRunGroup(spaceId: string, input?: { primary_task_id?: string; goal_summary?: string }, options?: SwarmMutationOptions): Promise<RunGroup>;
  createGroupRun(runGroupId: string, input?: RunExecutionInput, options?: SwarmMutationOptions): Promise<Run>;
  pauseRunGroup(runGroupId: string, options?: SwarmMutationOptions): Promise<RunGroup>;
  resumeRunGroup(runGroupId: string, options?: SwarmMutationOptions): Promise<RunGroup>;
  cancelRunGroup(runGroupId: string, options?: SwarmMutationOptions): Promise<RunGroup>;
  launchFromPrompt(spaceId: string, input: PromptLaunchInput, options?: SwarmMutationOptions & { intentKey?: string }): Promise<RunLaunch>;
  getRun(runId: string, options?: SwarmRequestOptions): Promise<Run>;
  acquireRun(runId: string, input?: { ttl_seconds?: number }, options?: SwarmMutationOptions): Promise<RunAcquisition>;
  declareExecutorCapabilities(spaceId: string, input: ExecutionCapabilities, options?: SwarmMutationOptions): Promise<ExecutionCapabilities & { executor_identity_id: string }>;
  launchTaskRun(taskId: string, input?: TaskRunLaunchInput, options?: SwarmMutationOptions): Promise<Run>;
  spawnSubrun(runId: string, input: { spawn_reason_key: string; task_id?: string; core_id?: string; facet_instance_id?: string; run_requirements?: RunRequirementsSpec; run_context_refs?: RunContextRefSpec[] }, options?: SwarmMutationOptions): Promise<Run>;
  claimNextRun(spaceId: string, input?: { ttl_seconds?: number; cursor?: string }, options?: SwarmMutationOptions): Promise<{ idle: boolean; run?: Run; run_lease?: RunLease; next_cursor?: string; retry_after_ms?: number }>;
  getRunContext(runId: string, options?: SwarmRequestOptions): Promise<RunContext>;
  getTask(taskId: string, options?: SwarmRequestOptions): Promise<Task>;
  updateTask(taskId: string, input: UpdateTaskInput, options?: SwarmMutationOptions): Promise<Task>;
  cancelTask(taskId: string, input?: CancelTaskInput, options?: SwarmMutationOptions): Promise<Task>;
  listAuditEvents(query?: SpaceScopedQuery & { entity_id?: string; resource_type?: string; resource_id?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<AuditEvent>>;
  search(query?: SpaceScopedQuery & { q?: string; entity_id?: string; resource_type?: SearchResult["resource_type"] } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SearchResult>>;
  searchPublic(query?: { q?: string; resource_type?: "space" | "agent" } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SearchResult>>;
  listChatClientProfiles(options?: SwarmRequestOptions): Promise<ChatClientProfile[]>;
  askSpace(spaceId: string, input: AskSpaceInput, options?: SwarmMutationOptions): Promise<SpaceAnswer>;
  askConnectedChatSpace(input: AskSpaceInput, options?: SwarmMutationOptions): Promise<SpaceAnswer>;
  buildSpaceContextPack(spaceId: string, input?: BuildSpaceContextPackInput, options?: SwarmMutationOptions): Promise<SpaceContextPack>;
  buildConnectedChatContextPack(input?: BuildSpaceContextPackInput, options?: SwarmMutationOptions): Promise<SpaceContextPack>;
  previewHandoff(spaceId: string, input: HandoffPreviewInput, options?: SwarmRequestOptions): Promise<HandoffPreview>;
  getContextPlan(spaceId: string, input: ContextPlanInput, options?: SwarmRequestOptions): Promise<ContextPlan>;
  createConnectedChatSessionDigest(input: CreateChatSessionDigestInput, options?: SwarmMutationOptions): Promise<ChatSessionDigestResult>;
  listSpaceAnswers(spaceId: string, query?: PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceAnswer>>;
  getSpaceAnswer(spaceId: string, answerId: string, options?: SwarmRequestOptions): Promise<SpaceAnswer>;
  getSpaceDecisionGraph(spaceId: string, options?: SwarmRequestOptions): Promise<SpaceDecisionGraph>;
  getSpaceAnswerContract(spaceId: string, options?: SwarmRequestOptions): Promise<SpaceAnswerContract>;
  getSpaceWorkContract(spaceId: string, options?: SwarmRequestOptions): Promise<SpaceWorkContract>;
  listSpaceCapabilities(spaceId: string, options?: SwarmRequestOptions): Promise<SpaceCapabilityDefinition[]>;
  getSpaceOperationContract(spaceId: string, operationKind: string, options?: SwarmRequestOptions): Promise<SpaceOperationContract>;
  listSpaceIntelligenceOperations(spaceId: string, query?: { operation_kind?: string; capability_key?: string; status?: SpaceIntelligenceOperationStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceIntelligenceOperation>>;
  createSpaceIntelligenceOperation(spaceId: string, input: CreateSpaceIntelligenceOperationInput, options?: SwarmMutationOptions): Promise<SpaceIntelligenceOperation>;
  getSpaceIntelligenceOperation(spaceId: string, operationId: string, options?: SwarmRequestOptions): Promise<SpaceIntelligenceOperation>;
  updateQueuedSpaceIntelligenceOperation(spaceId: string, operationId: string, input: UpdateQueuedSpaceIntelligenceOperationInput, options?: SwarmMutationOptions): Promise<SpaceIntelligenceOperation>;
  cancelQueuedSpaceIntelligenceOperation(spaceId: string, operationId: string, input?: CancelQueuedSpaceIntelligenceOperationInput, options?: SwarmMutationOptions): Promise<SpaceIntelligenceOperation>;
  startSpaceIntelligenceOperation(spaceId: string, operationId: string, input?: TransitionSpaceIntelligenceOperationInput, options?: SwarmMutationOptions): Promise<SpaceIntelligenceOperation>;
  completeSpaceIntelligenceOperation(spaceId: string, operationId: string, input?: TransitionSpaceIntelligenceOperationInput, options?: SwarmMutationOptions): Promise<SpaceIntelligenceOperation>;
  failSpaceIntelligenceOperation(spaceId: string, operationId: string, input?: TransitionSpaceIntelligenceOperationInput, options?: SwarmMutationOptions): Promise<SpaceIntelligenceOperation>;
  listSpaceLearningCandidates(spaceId: string, query?: { family?: string; status?: SpaceIntelligenceStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceLearningCandidate>>;
  createSpaceLearningCandidate(spaceId: string, input: CreateSpaceLearningCandidateInput, options?: SwarmMutationOptions): Promise<SpaceLearningCandidate>;
  createSpaceLearningCandidateFromArtifact(spaceId: string, input: CreateSpaceLearningCandidateFromArtifactInput, options?: SwarmMutationOptions): Promise<SpaceLearningCandidate>;
  promoteSpaceLearningCandidate(spaceId: string, candidateId: string, options?: SwarmMutationOptions): Promise<SpaceProjection>;
  rejectSpaceLearningCandidate(spaceId: string, candidateId: string, input?: RejectSpaceLearningCandidateInput, options?: SwarmMutationOptions): Promise<SpaceLearningCandidate>;
  correctSpaceLearningCandidate(spaceId: string, candidateId: string, input: CorrectSpaceLearningCandidateInput, options?: SwarmMutationOptions): Promise<CorrectSpaceLearningCandidateResult>;
  supersedeSpaceLearningCandidate(spaceId: string, candidateId: string, input: SupersedeSpaceLearningCandidateInput, options?: SwarmMutationOptions): Promise<SupersedeSpaceLearningCandidateResult>;
  listSpacePromotionGates(spaceId: string, query?: { candidate_id?: string; projection_id?: string; decision?: SpacePromotionGateDecision } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpacePromotionGate>>;
  listSpaceIntelligenceProjections(spaceId: string, query?: { family?: string; status?: SpaceIntelligenceStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceProjection>>;
  listSpaceLearningQueueItems(spaceId: string, query?: { family?: string; kind?: SpaceLearningQueueKind; status?: SpaceLearningQueueStatus; due_only?: boolean } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceLearningQueueItem>>;
  createSpaceLearningQueueItem(spaceId: string, input: CreateSpaceLearningQueueItemInput, options?: SwarmMutationOptions): Promise<SpaceLearningQueueItem>;
  claimSpaceLearningQueueItem(spaceId: string, input?: ClaimSpaceLearningQueueItemInput, options?: SwarmMutationOptions): Promise<SpaceLearningQueueItem>;
  completeSpaceLearningQueueItem(
    spaceId: string,
    itemId: string,
    input: CompleteSpaceLearningQueueItemInput,
    options?: SwarmMutationOptions
  ): Promise<SpaceLearningQueueItem>;
  submitSpaceLearningQueueResult(spaceId: string, itemId: string, input: SubmitSpaceLearningQueueResultInput, options?: SwarmMutationOptions): Promise<SpaceLearningQueueResult>;
  getSpaceLearningFrontier(spaceId: string, options?: SwarmRequestOptions): Promise<SpaceLearningFrontier>;
  streamAuditEvents(query: SpaceScopedQuery & { entity_id?: string; resource_type?: string; resource_id?: string; limit?: number }, onEvent: (event: AuditEvent, meta: { id: string | null; event: string }) => Promise<void> | void, options?: SwarmStreamOptions): Promise<string | null>;
  createAgentCapabilityManifest(input: CreateAgentCapabilityManifestInput, options?: SwarmMutationOptions): Promise<AgentCapabilityManifest>;
  listAgentCapabilityManifests(query?: SpaceScopedQuery & { agent_id?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<AgentCapabilityManifest>>;
  getAgentCapabilityManifest(manifestId: string, options?: SwarmRequestOptions): Promise<AgentCapabilityManifest>;
  updateAgentCapabilityManifest(manifestId: string, input: Partial<CreateAgentCapabilityManifestInput>, options?: SwarmMutationOptions): Promise<AgentCapabilityManifest>;
  heartbeatAgent(agentId: string, input?: HeartbeatAgentInput, options?: SwarmMutationOptions): Promise<AgentPresence>;
  listRuntimeHints(agentId: string, query?: { kind?: RuntimeHintKind } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<RuntimeHintEvent>>;
  streamRuntimeHints(agentId: string, onEvent: (event: RuntimeHintEvent, meta: { id: string | null; event: string }) => Promise<void> | void, options?: SwarmStreamOptions & { kind?: RuntimeHintKind; limit?: number }): Promise<string | null>;
  listAgentPresence(query?: SpaceScopedQuery & { agent_id?: string; status?: AgentPresenceStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<AgentPresence>>;
  getAgentPresence(agentId: string, options?: SwarmRequestOptions): Promise<AgentPresence>;
  claimNextCoreRun(input?: { ttl_seconds?: number }, options?: SwarmMutationOptions): Promise<RunAcquisition | null>;
  acquireCoreRun(runId: string, input?: { ttl_seconds?: number }, options?: SwarmMutationOptions): Promise<RunAcquisition>;
  recordCoreRunnerHeartbeat(options?: SwarmMutationOptions): Promise<CoreHealth>;
  startCoreRun(runId: string, leaseId: string, options?: SwarmMutationOptions): Promise<Run>;
  executeCoreRun(runId: string, leaseId: string, options?: SwarmMutationOptions): Promise<CoreRunnerExecutionResult>;
  completeCoreRun(runId: string, leaseId: string, input: { outcome: RunOutcome }, options?: SwarmMutationOptions): Promise<Run>;
  renewCoreRunLease(runId: string, leaseId: string, input: { ttl_seconds: number }, options?: SwarmMutationOptions): Promise<RunLease>;
  releaseCoreRunLease(runId: string, leaseId: string, options?: SwarmMutationOptions): Promise<RunLease>;
  startRun(runId: string, input: { lease_id: string }, options?: SwarmMutationOptions): Promise<Run>;
  completeRun(runId: string, input: { lease_id: string; outcome: RunOutcome | "canceled"; title?: string; body?: string; media_type?: string }, options?: SwarmMutationOptions): Promise<Run>;
  requestRunStop(runId: string, input?: { reason?: string }, options?: SwarmMutationOptions): Promise<Run>;
  getRunLease(leaseId: string, options?: SwarmRequestOptions): Promise<RunLease>;
  renewRunLease(leaseId: string, input: { ttl_seconds: number }, options?: SwarmMutationOptions): Promise<RunLease>;
  releaseRunLease(leaseId: string, options?: SwarmMutationOptions): Promise<RunLease>;
  createArtifact(input: CreateArtifactInput, options?: SwarmMutationOptions): Promise<Artifact>;
  getArtifactContent(artifactId: string, options?: SwarmRequestOptions): Promise<ArtifactContent>;
  downloadArtifact(artifactId: string, options?: ArtifactDownloadOptions): Promise<VerifiedArtifactDownload>;
  getVerifiedArtifactContent(artifactId: string, options?: SwarmRequestOptions & { expectedSha256?: string; maxArtifactBytes?: number }): Promise<ArtifactContent>;
  createEvaluation(input: CreateEvaluationInput, options?: SwarmMutationOptions): Promise<Evaluation>;
  createTokenUsageEvent(input: CreateTokenUsageEventInput, options?: SwarmMutationOptions): Promise<TokenUsageEvent>;
  listTokenUsageEvents(query?: SpaceScopedQuery & { entity_id?: string; run_id?: string; agent_id?: string; source_resource_type?: TokenUsageEvent["source_resource_type"]; source_resource_id?: string; operation?: string; count_source?: TokenCountSource; evidence_class?: TokenUsageEvent["evidence_class"]; start_at?: string; end_at?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<TokenUsageEvent>>;
  getTokenUsageEvent(eventId: string, options?: SwarmRequestOptions): Promise<TokenUsageEvent>;
  listTokenUsageRollups(query?: SpaceScopedQuery & { entity_id?: string; operation?: string; count_source?: TokenCountSource; bucket?: "total" | "hour" | "day"; start_at?: string; end_at?: string; limit?: number }, options?: SwarmRequestOptions): Promise<TokenUsageRollup[]>;
  appendAgentActionTraceBatch(spaceId: string, input: AppendAgentActionTraceBatchInput, options?: SwarmMutationOptions): Promise<AgentActionTraceBatchResult>;
  publishAgentCheckpoint(spaceId: string, input: PublishAgentCheckpointInput, options?: SwarmMutationOptions): Promise<PublishAgentCheckpointResult>;
  listAgentActionTraces(query?: SpaceScopedQuery & { entity_id?: string; run_group_id?: string; run_id?: string; execution_id?: string; actor_identity_id?: string; agent_id?: string; core_id?: string; command_id?: string; model_call_id?: string; trace_root_id?: string; parent_trace_id?: string; action_descriptor_key?: string; status?: AgentActionStatus; evidence_class_key?: string; capture_profile_key?: string; coverage_key?: string; start_at?: string; end_at?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<AgentActionTrace>>;
  getAgentActionTrace(traceId: string, options?: SwarmRequestOptions): Promise<AgentActionTraceDetail>;
  getSpaceActionIntelligence(spaceId: string, query?: { start_at?: string; end_at?: string; trace_limit?: number }, options?: SwarmRequestOptions): Promise<SpaceActionIntelligenceSummary>;
  listBudgetAccounts(query?: SpaceScopedQuery & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<BudgetAccount>>;
  getBudgetAccount(accountId: string, options?: SwarmRequestOptions): Promise<BudgetAccount>;
  createBudgetAccount(input: CreateBudgetAccountInput, options?: SwarmMutationOptions): Promise<BudgetAccount>;
  fundBudgetAccount(accountId: string, input: { amount: number; reason?: string }, options?: SwarmMutationOptions): Promise<BudgetAccountFundingResult>;
  listBudgetLedgerEntries(query?: SpaceScopedQuery & { account_id?: string; delegation_id?: string; target_agent_id?: string; target_run_id?: string; approval_request_id?: string; kind?: BudgetLedgerEntryKind } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<BudgetLedgerEntry>>;
  getBudgetLedgerEntry(entryId: string, options?: SwarmRequestOptions): Promise<BudgetLedgerEntry>;
  listBudgetDelegations(query?: SpaceScopedQuery & { account_id?: string; target_agent_id?: string; target_run_id?: string; approval_request_id?: string; status?: BudgetDelegationStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<BudgetDelegation>>;
  getBudgetDelegation(delegationId: string, options?: SwarmRequestOptions): Promise<BudgetDelegation>;
  createBudgetDelegation(input: CreateBudgetDelegationInput, options?: SwarmMutationOptions): Promise<BudgetDelegationMutationResult>;
  consumeBudgetDelegation(delegationId: string, input: { amount: number; reason?: string }, options?: SwarmMutationOptions): Promise<BudgetDelegationMutationResult>;
  revokeBudgetDelegation(delegationId: string, input?: { reason?: string }, options?: SwarmMutationOptions): Promise<BudgetDelegationMutationResult>;
  listApprovalRequests(query?: SpaceScopedQuery & { resource_type?: string; resource_id?: string; status?: ApprovalRequestStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<ApprovalRequest>>;
  getApprovalRequest(requestId: string, options?: SwarmRequestOptions): Promise<ApprovalRequest>;
  createApprovalRequest(input: CreateApprovalRequestInput, options?: SwarmMutationOptions): Promise<ApprovalRequest>;
  approveApprovalRequest(requestId: string, input?: { resolution_note?: string }, options?: SwarmMutationOptions): Promise<ApprovalRequest>;
  rejectApprovalRequest(requestId: string, input?: { resolution_note?: string }, options?: SwarmMutationOptions): Promise<ApprovalRequest>;
  listWebhookActions(options?: SwarmRequestOptions): Promise<WebhookAction[]>;
  listWebhookActionPresets(options?: SwarmRequestOptions): Promise<WebhookActionPreset[]>;
  listWebhookTargets(query?: SpaceScopedQuery & { active_only?: boolean } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<WebhookTarget>>;
  getWebhookTarget(targetId: string, options?: SwarmRequestOptions): Promise<WebhookTarget>;
  createWebhookTarget(input: SpaceScopedInput & { name: string; url: string; included_actions?: string[]; signing_secret?: string; max_attempts?: number; initial_backoff_seconds?: number; max_backoff_seconds?: number }, options?: SwarmMutationOptions): Promise<WebhookTarget>;
  createWebhookTargetFromPreset(presetKey: string, input: SpaceScopedInput & { name: string; url: string; signing_secret?: string; max_attempts?: number; initial_backoff_seconds?: number; max_backoff_seconds?: number }, options?: SwarmMutationOptions): Promise<WebhookTarget>;
  updateWebhookTarget(targetId: string, input: { name: string; url: string; included_actions?: string[]; signing_secret?: string; clear_signing_secret?: boolean; max_attempts?: number; initial_backoff_seconds?: number; max_backoff_seconds?: number }, options?: SwarmMutationOptions): Promise<WebhookTarget>;
  disableWebhookTarget(targetId: string, options?: SwarmMutationOptions): Promise<WebhookTarget>;
  reconcileWebhookTarget(targetId: string, input?: { limit?: number }, options?: SwarmMutationOptions): Promise<ReconcileWebhookTargetResult>;
  listWebhookDeliveries(query?: SpaceScopedQuery & { target_id?: string; status?: WebhookDeliveryStatus; due_before?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<WebhookDelivery>>;
  getWebhookDelivery(deliveryId: string, options?: SwarmRequestOptions): Promise<WebhookDelivery>;
  redriveWebhookDelivery(deliveryId: string, options?: SwarmMutationOptions): Promise<WebhookDelivery>;
  listSpaceDirectoryEntries(query?: PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<DirectorySpaceEntry>>;
  listAgentDirectoryEntries(query?: SpaceScopedQuery & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<DirectoryAgentEntry>>;
  getSpaceOperatorSummary(spaceId: string, options?: SwarmRequestOptions): Promise<SpaceOperatorSummary>;
  getSpaceOperatorLiveSnapshot(spaceId: string, query?: { activity_limit?: number; presence_limit?: number; profile?: "full" | "critical"; run_limit?: number }, options?: SwarmRequestOptions): Promise<SpaceOperatorLiveSnapshot>;
  getControlPlaneObservability(options?: SwarmRequestOptions): Promise<ControlPlaneObservabilitySnapshot>;
  listSpaceOperatorActivity(spaceId: string, query?: { resource_type?: string } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceOperatorActivityItem>>;
  listSpaceOperatorPresenceEntries(spaceId: string, query?: { status?: AgentPresenceStatus } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceOperatorPresenceEntry>>;
  listSpaceSignedStatusEntries(spaceId: string, query?: { agent_id?: string; run_id?: string; action?: RuntimeReceiptAction } & PageQuery, options?: SwarmRequestOptions): Promise<CollectionPage<SpaceSignedStatusEntry>>;
}
