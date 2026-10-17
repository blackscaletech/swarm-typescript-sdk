import { consumeEventStream } from "./event-stream.js";
import { responseLifetimeSignal } from "./response-lifetime.js";
import { artifactDigest, verifyArtifactContent } from "./artifact-integrity.js";
import { downloadArtifact } from "./artifact-download.js";
import { responseByteLimit } from "./response-body.js";
export { SwarmArtifactIntegrityError } from "./artifact-integrity.js";
export { SwarmStreamError } from "./event-stream.js";
import {
  buildBootstrapCurrentUserEntityIdempotencyKey,
  buildBootstrapSpaceIdempotencyKey,
  buildConnectClientIdempotencyKey,
  buildConnectCurrentUserAndLaunchIdempotencyKey,
  buildConnectCurrentUserClientIdempotencyKey,
  buildConnectSpaceClientIdempotencyKey,
  buildLaunchRunIdempotencyKey
} from "./idempotency.js";
import {
  normalizeBootstrapCurrentUserEntityInput,
  normalizeBootstrapSpaceInput,
  normalizeConnectCurrentUserAndLaunchInput,
  normalizeConnectCurrentUserClientInput,
  normalizePromptLaunchInput
} from "./input-normalizers.js";
import { attachIntelligenceMethods } from "./intelligence.js";
import { pathSegment, SwarmAPIError, SwarmClientBase } from "./client-core.js";
export { SwarmAPIError, SwarmResponseLimitError } from "./client-core.js";
export {
  computeWebhookSignature,
  parseWebhookHeaders,
  verifyWebhookSignature
} from "./webhooks.js";

export {
  buildBootstrapCurrentUserEntityIdempotencyKey,
  buildBootstrapSpaceIdempotencyKey,
  buildConnectClientIdempotencyKey,
  buildConnectCurrentUserAndLaunchIdempotencyKey,
  buildConnectCurrentUserClientIdempotencyKey,
  buildConnectSpaceClientIdempotencyKey,
  buildLaunchRunIdempotencyKey
} from "./idempotency.js";

export {
  SwarmCoreExecutionUncertainError,
  computeConnectedCoreLoopDelayMs,
  executeConnectedCoreAcquisition,
  runConnectedCoreLoop,
  runConnectedCoreOnce
} from "./connected-core-runtime.js";

export {
  executeAgentAcquisition,
  runAgentLoop,
  runAgentOnce
} from "./agent-runtime.js";

export class SwarmClient extends SwarmClientBase {
  async createEntity(input, options = {}) {
    return this.post("/v1/entities", input, options);
  }

  async getCurrentUser(options = {}) {
    return this.get("/v1/me", options);
  }

  async createProviderSession(input, options = {}) {
    return this.post("/v1/auth/provider-sessions", input, options);
  }

  async getUserSession(sessionId, options = {}) {
    return this.get(`/v1/user-sessions/${sessionId}`, options);
  }

  async revokeUserSession(sessionId, input = {}, options = {}) {
    return this.post(`/v1/user-sessions/${sessionId}/revoke`, input, options);
  }

  async createSpace(input, options = {}) {
    return this.post("/v1/spaces", input, options);
  }

  async bootstrapSpace(entityId, input, options = {}) {
    const { idempotencyKey, intentKey, ...requestOptions } = options;
    const normalizedInput = normalizeBootstrapSpaceInput(input);
    return this.post(`/v1/entities/${entityId}/bootstrap-space`, normalizedInput, {
      ...requestOptions,
      idempotencyKey: idempotencyKey || buildBootstrapSpaceIdempotencyKey(entityId, normalizedInput, intentKey)
    });
  }

  async updateSpace(spaceId, input, options = {}) {
    return this.patch(`/v1/spaces/${spaceId}`, input, options);
  }

  async updateSpaceLearningPolicy(spaceId, input, options = {}) {
    return this.patch(`/v1/spaces/${spaceId}/learning-policy`, input, options);
  }

  async connectSpaceClient(spaceId, input = {}, options = {}) {
    const { idempotencyKey, intentKey, ...requestOptions } = options;
    return this.post(`/v1/spaces/${spaceId}/connect-client`, input, {
      ...requestOptions,
      idempotencyKey: idempotencyKey || buildConnectClientIdempotencyKey(spaceId, input, intentKey)
    });
  }

  async connectClient(spaceId, input = {}, options = {}) {
    return this.connectSpaceClient(spaceId, input, options);
  }

  async connectCurrentUserClient(input = {}, options = {}) {
    const { idempotencyKey, intentKey, ...requestOptions } = options;
    const normalizedInput = normalizeConnectCurrentUserClientInput(input);
    return this.post("/v1/me/connect-client", normalizedInput, {
      ...requestOptions,
      idempotencyKey: idempotencyKey || buildConnectCurrentUserClientIdempotencyKey(normalizedInput, intentKey)
    });
  }

  async bootstrapCurrentUserEntity(input = {}, options = {}) {
    const { idempotencyKey, intentKey, ...requestOptions } = options;
    const normalizedInput = normalizeBootstrapCurrentUserEntityInput(input);
    return this.post("/v1/me/bootstrap-entity", normalizedInput, {
      ...requestOptions,
      idempotencyKey: idempotencyKey || buildBootstrapCurrentUserEntityIdempotencyKey(normalizedInput, intentKey)
    });
  }

  async connectCurrentUserAndLaunch(input = {}, options = {}) {
    const { idempotencyKey, intentKey, ...requestOptions } = options;
    const normalizedInput = normalizeConnectCurrentUserAndLaunchInput(input);
    return this.post("/v1/me/connect-and-launch", normalizedInput, {
      ...requestOptions,
      idempotencyKey: idempotencyKey || buildConnectCurrentUserAndLaunchIdempotencyKey(input, intentKey)
    });
  }

  async createAgent(input, options = {}) {
    return this.post("/v1/agents", input, options);
  }

  async listAgents(query = {}, options = {}) {
    return this.list("/v1/agents", query, options);
  }

  async listAgentRuntimeCredentials(agentId, query = {}, options = {}) {
    return this.list(`/v1/agents/${pathSegment(agentId)}/runtime-credentials`, query, options);
  }

  async listSpaceAgentParticipants(spaceId, query = {}, options = {}) {
    return this.list(`/v1/spaces/${encodeURIComponent(spaceId)}/agent-participants`, query, options);
  }

  async getAgent(agentId, options = {}) {
    return this.get(`/v1/agents/${agentId}`, options);
  }

  async listSpaces(query = {}, options = {}) {
    return this.list("/v1/spaces", query, options);
  }

  async getSpace(spaceId, options = {}) {
    return this.get(`/v1/spaces/${spaceId}`, options);
  }

  async listTasks(query = {}, options = {}) {
    return this.list("/v1/tasks", query, options);
  }

  async listLaunchTemplates(query = {}, options = {}) {
    return this.list("/v1/setups", query, options);
  }

  async createLaunchTemplate(input, options = {}) {
    return this.post("/v1/setups", input, options);
  }

  async getLaunchTemplate(templateId, options = {}) {
    return this.get(`/v1/setups/${templateId}`, options);
  }

  async updateLaunchTemplate(templateId, input, options = {}) {
    return this.post(`/v1/setups/${templateId}/update`, input, options);
  }

  async disableLaunchTemplate(templateId, options = {}) {
    return this.data("POST", `/v1/setups/${templateId}/disable`, options);
  }

  async listAutomationProfiles(query = {}, options = {}) {
    return this.list("/v1/automation-profiles", query, options);
  }

  async createAutomationProfile(input, options = {}) {
    return this.post("/v1/automation-profiles", input, options);
  }

  async getAutomationProfile(profileId, options = {}) {
    return this.get(`/v1/automation-profiles/${profileId}`, options);
  }

  async updateAutomationProfile(profileId, input, options = {}) {
    return this.post(`/v1/automation-profiles/${profileId}/update`, input, options);
  }

  async disableAutomationProfile(profileId, options = {}) {
    return this.data("POST", `/v1/automation-profiles/${profileId}/disable`, options);
  }

  async createTask(input, options = {}) {
    return this.post("/v1/tasks", input, options);
  }

  async listRuns(query = {}, options = {}) {
    return this.list("/v1/runs", query, options);
  }

  async launchSpaceRun(spaceId, input, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/launch-run`, input, {
      ...options,
      idempotencyKey:
        options.idempotencyKey ||
        buildLaunchRunIdempotencyKey(spaceId, input, options.intentKey)
    });
  }

  async launchRun(spaceId, input = {}, options = {}) {
    return this.post(`/v1/foundation/spaces/${pathSegment(spaceId)}/runs:launch`, input, options);
  }

  async createRunGroup(spaceId, input = {}, options = {}) {
    return this.post(`/v1/foundation/spaces/${pathSegment(spaceId)}/run-groups`, input, options);
  }

  async createGroupRun(runGroupId, input = {}, options = {}) {
    return this.post(`/v1/foundation/run-groups/${pathSegment(runGroupId)}/runs`, input, options);
  }

  async pauseRunGroup(runGroupId, options = {}) {
    return this.post(`/v1/foundation/run-groups/${pathSegment(runGroupId)}:pause`, {}, options);
  }

  async resumeRunGroup(runGroupId, options = {}) {
    return this.post(`/v1/foundation/run-groups/${pathSegment(runGroupId)}:resume`, {}, options);
  }

  async cancelRunGroup(runGroupId, options = {}) {
    return this.post(`/v1/foundation/run-groups/${pathSegment(runGroupId)}:cancel`, {}, options);
  }

  async launchFromPrompt(spaceId, input = {}, options = {}) {
    return this.launchSpaceRun(spaceId, normalizePromptLaunchInput(input), options);
  }

  async getRun(runId, options = {}) {
    return this.get(`/v1/runs/${pathSegment(runId)}`, options);
  }

  async acquireRun(runId, input = {}, options = {}) {
    return this.post(`/v1/runs/${pathSegment(runId)}/acquire`, input, options);
  }

  async launchTaskRun(taskId, input = {}, options = {}) {
    return this.post(`/v1/foundation/tasks/${pathSegment(taskId)}/runs:launch`, input, options);
  }

  async spawnSubrun(runId, input, options = {}) {
    return this.post(`/v1/foundation/runs/${pathSegment(runId)}/subruns`, input, options);
  }

  async claimNextRun(spaceId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/runs:claim-next`, input, options);
  }

  async declareExecutorCapabilities(spaceId, input, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/executor-capabilities`, input, options);
  }

  async getRunContext(runId, options = {}) {
    return this.get(`/v1/runs/${pathSegment(runId)}/context`, options);
  }

  async getTask(taskId, options = {}) {
    return this.get(`/v1/tasks/${pathSegment(taskId)}`, options);
  }

  async updateTask(taskId, input, options = {}) {
    return this.patch(`/v1/tasks/${pathSegment(taskId)}`, input, options);
  }

  async cancelTask(taskId, input = {}, options = {}) {
    return this.post(`/v1/tasks/${pathSegment(taskId)}/cancel`, input, options);
  }

  async listAuditEvents(query = {}, options = {}) {
    return this.list("/v1/audit-events", query, options);
  }

  async search(query = {}, options = {}) {
    return this.list("/v1/search", query, options);
  }

  async searchPublic(query = {}, options = {}) {
    return this.list("/v1/search/public", query, options);
  }

  async listChatClientProfiles(options = {}) {
    return this.get("/v1/chat-client-profiles", options);
  }

  async streamAuditEvents(query = {}, onEvent, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.lastEventId) {
      headers["Last-Event-ID"] = options.lastEventId;
    }
    const response = await this.request("GET", "/v1/audit-events/stream", {
      ...options,
      query,
      headers,
      accept: "text/event-stream",
      raw: true
    });
    if (!response.body) {
      throw new Error("Audit event stream response body is unavailable");
    }
    return consumeEventStream(response.body, onEvent, {
      signal: responseLifetimeSignal(response, options.signal),
      onStreamError: options.onStreamError,
      strict: options.strict,
      lastEventId: options.lastEventId,
      maxEventBytes: options.sseMaxEventBytes || this.sseMaxEventBytes,
      maxBufferBytes: options.sseMaxBufferBytes || this.sseMaxBufferBytes
    });
  }

  async listRuntimeHints(agentId, query = {}, options = {}) {
    return this.list(`/v1/agents/${agentId}/runtime-hints`, query, options);
  }

  async createAgentCapabilityManifest(input, options = {}) {
    return this.post("/v1/agent-capability-manifests", input, options);
  }

  async listAgentCapabilityManifests(query = {}, options = {}) {
    return this.list("/v1/agent-capability-manifests", query, options);
  }

  async getAgentCapabilityManifest(manifestId, options = {}) {
    return this.get(`/v1/agent-capability-manifests/${manifestId}`, options);
  }

  async updateAgentCapabilityManifest(manifestId, input, options = {}) {
    return this.post(`/v1/agent-capability-manifests/${manifestId}/update`, input, options);
  }

  async heartbeatAgent(agentId, input = {}, options = {}) {
    return this.post(`/v1/agents/${agentId}/heartbeat`, input, options);
  }

  async streamRuntimeHints(agentId, onEvent, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.lastEventId) {
      headers["Last-Event-ID"] = options.lastEventId;
    }
    const query = {};
    if (options.kind) {
      query.kind = options.kind;
    }
    if (options.limit) {
      query.limit = options.limit;
    }
    const response = await this.request("GET", `/v1/agents/${agentId}/runtime-hints/stream`, {
      ...options,
      query,
      headers,
      accept: "text/event-stream",
      raw: true
    });
    if (!response.body) {
      throw new Error("Runtime hint stream response body is unavailable");
    }
    return consumeEventStream(response.body, onEvent, {
      signal: responseLifetimeSignal(response, options.signal),
      onStreamError: options.onStreamError,
      strict: options.strict,
      lastEventId: options.lastEventId,
      maxEventBytes: options.sseMaxEventBytes || this.sseMaxEventBytes,
      maxBufferBytes: options.sseMaxBufferBytes || this.sseMaxBufferBytes
    });
  }

  async listAgentPresence(query = {}, options = {}) {
    return this.list("/v1/agent-presence", query, options);
  }

  async getAgentPresence(agentId, options = {}) {
    return this.get(`/v1/agents/${agentId}/presence`, options);
  }

  async claimNextCoreRun(input = {}, options = {}) {
    return this.post("/v1/core-runner/runs/claim-next", input, options);
  }

  async acquireCoreRun(runId, input = {}, options = {}) {
    return this.post(`/v1/core-runs/${pathSegment(runId)}/acquire`, input, options);
  }

  async recordCoreRunnerHeartbeat(options = {}) {
    return this.post("/v1/core-runner/heartbeat", {}, options);
  }

  async startCoreRun(runId, leaseId, options = {}) {
    return this.post(
      `/v1/core-runs/${pathSegment(runId)}/leases/${pathSegment(leaseId)}/start`,
      {},
      options
    );
  }

  async executeCoreRun(runId, leaseId, options = {}) {
    return this.post(
      `/v1/core-runs/${pathSegment(runId)}/leases/${pathSegment(leaseId)}/execute`,
      {},
      options
    );
  }

  async completeCoreRun(runId, leaseId, input, options = {}) {
    return this.post(
      `/v1/core-runs/${pathSegment(runId)}/leases/${pathSegment(leaseId)}/complete`,
      input,
      options
    );
  }

  async renewCoreRunLease(runId, leaseId, input, options = {}) {
    return this.post(
      `/v1/core-runs/${pathSegment(runId)}/leases/${pathSegment(leaseId)}/renew`,
      input,
      options
    );
  }

  async releaseCoreRunLease(runId, leaseId, options = {}) {
    return this.post(
      `/v1/core-runs/${pathSegment(runId)}/leases/${pathSegment(leaseId)}/release`,
      {},
      options
    );
  }

  async startRun(runId, input, options = {}) {
    return this.post(`/v1/runs/${pathSegment(runId)}/start`, input, options);
  }

  async completeRun(runId, input, options = {}) {
    return this.post(`/v1/runs/${pathSegment(runId)}/complete`, input, options);
  }

  async requestRunStop(runId, input = {}, options = {}) {
    return this.post(`/v1/runs/${pathSegment(runId)}/stop`, input, options);
  }

  async getRunLease(leaseId, options = {}) {
    return this.get(`/v1/run-leases/${pathSegment(leaseId)}`, options);
  }

  async renewRunLease(leaseId, input, options = {}) {
    return this.post(`/v1/run-leases/${pathSegment(leaseId)}/renew`, input, options);
  }

  async releaseRunLease(leaseId, options = {}) {
    return this.post(`/v1/run-leases/${pathSegment(leaseId)}/release`, {}, options);
  }

  async createArtifact(input, options = {}) {
    return this.post("/v1/artifacts", input, options);
  }

  async getArtifactContent(artifactId, options = {}) {
    return this.get(`/v1/artifacts/${pathSegment(artifactId)}/content`, options);
  }

  async downloadArtifact(artifactId, options = {}) {
    return downloadArtifact(this, artifactId, options);
  }

  async getVerifiedArtifactContent(artifactId, options = {}) {
    const expectedSha256 = options.expectedSha256 === undefined ? undefined : artifactDigest(options.expectedSha256);
    const maxArtifactBytes = responseByteLimit(options.maxArtifactBytes, this.maxResponseBytes, "maxArtifactBytes");
    const content = await this.getArtifactContent(artifactId, options);
    return verifyArtifactContent(content, String(artifactId), { ...options, expectedSha256, maxArtifactBytes });
  }

  async createEvaluation(input, options = {}) {
    return this.post("/v1/evaluations", input, options);
  }

  async createTokenUsageEvent(input, options = {}) {
    return this.post("/v1/token-usage-events", input, options);
  }

  async listTokenUsageEvents(query = {}, options = {}) {
    return this.list("/v1/token-usage-events", query, options);
  }

  async getTokenUsageEvent(eventId, options = {}) {
    const eventKey = pathSegment(eventId);
    return this.get(`/v1/token-usage-events/${eventKey}`, options);
  }

  async listTokenUsageRollups(query = {}, options = {}) {
    return this.get("/v1/token-usage-rollups", {
      ...options,
      query
    });
  }

  async appendAgentActionTraceBatch(spaceId, input, options = {}) {
    const spaceKey = pathSegment(spaceId);
    return this.post(`/v1/spaces/${spaceKey}/agent-action-traces/batches`, input, options);
  }

  async publishAgentCheckpoint(spaceId, input, options = {}) {
    const spaceKey = pathSegment(spaceId);
    return this.post(`/v1/spaces/${spaceKey}/checkpoints`, input, options);
  }

  async listAgentActionTraces(query = {}, options = {}) {
    return this.list("/v1/agent-action-traces", query, options);
  }

  async getAgentActionTrace(traceId, options = {}) {
    const traceKey = pathSegment(traceId);
    return this.get(`/v1/agent-action-traces/${traceKey}`, options);
  }

  async listBudgetAccounts(query = {}, options = {}) {
    return this.list("/v1/budget-accounts", query, options);
  }

  async getBudgetAccount(accountId, options = {}) {
    return this.get(`/v1/budget-accounts/${accountId}`, options);
  }

  async createBudgetAccount(input, options = {}) {
    return this.post("/v1/budget-accounts", input, options);
  }

  async fundBudgetAccount(accountId, input, options = {}) {
    return this.post(`/v1/budget-accounts/${accountId}/fund`, input, options);
  }

  async listBudgetLedgerEntries(query = {}, options = {}) {
    return this.list("/v1/budget-ledger-entries", query, options);
  }

  async getBudgetLedgerEntry(entryId, options = {}) {
    return this.get(`/v1/budget-ledger-entries/${entryId}`, options);
  }

  async listBudgetDelegations(query = {}, options = {}) {
    return this.list("/v1/budget-delegations", query, options);
  }

  async getBudgetDelegation(delegationId, options = {}) {
    return this.get(`/v1/budget-delegations/${delegationId}`, options);
  }

  async createBudgetDelegation(input, options = {}) {
    return this.post("/v1/budget-delegations", input, options);
  }

  async consumeBudgetDelegation(delegationId, input, options = {}) {
    return this.post(`/v1/budget-delegations/${delegationId}/consume`, input, options);
  }

  async revokeBudgetDelegation(delegationId, input = {}, options = {}) {
    return this.post(`/v1/budget-delegations/${delegationId}/revoke`, input, options);
  }

  async listApprovalRequests(query = {}, options = {}) {
    return this.list("/v1/approval-requests", query, options);
  }

  async getApprovalRequest(requestId, options = {}) {
    return this.get(`/v1/approval-requests/${requestId}`, options);
  }

  async createApprovalRequest(input, options = {}) {
    return this.post("/v1/approval-requests", input, options);
  }

  async approveApprovalRequest(requestId, input = {}, options = {}) {
    return this.post(`/v1/approval-requests/${requestId}/approve`, input, options);
  }

  async rejectApprovalRequest(requestId, input = {}, options = {}) {
    return this.post(`/v1/approval-requests/${requestId}/reject`, input, options);
  }

  async listWebhookActions(options = {}) {
    return this.get("/v1/webhook-actions", options);
  }

  async listWebhookActionPresets(options = {}) {
    return this.get("/v1/webhook-action-presets", options);
  }

  async listWebhookTargets(query = {}, options = {}) {
    return this.list("/v1/webhook-targets", query, options);
  }

  async getWebhookTarget(targetId, options = {}) {
    return this.get(`/v1/webhook-targets/${targetId}`, options);
  }

  async createWebhookTarget(input, options = {}) {
    return this.post("/v1/webhook-targets", input, options);
  }

  async createWebhookTargetFromPreset(presetKey, input, options = {}) {
    const presets = await this.listWebhookActionPresets({
      signal: options.signal,
      headers: options.headers
    });
    const normalizedKey = String(presetKey || "").trim().toLowerCase();
    const preset = presets.find((candidate) => String(candidate.key || "").trim().toLowerCase() === normalizedKey);
    if (!preset) {
      throw new Error(`Unknown Swarm webhook action preset: ${presetKey}`);
    }
    return this.createWebhookTarget({
      ...input,
      included_actions: Array.isArray(preset.included_actions) ? preset.included_actions.slice() : []
    }, options);
  }

  async updateWebhookTarget(targetId, input, options = {}) {
    return this.post(`/v1/webhook-targets/${targetId}/update`, input, options);
  }

  async disableWebhookTarget(targetId, options = {}) {
    return this.data("POST", `/v1/webhook-targets/${targetId}/disable`, options);
  }

  async reconcileWebhookTarget(targetId, input = {}, options = {}) {
    return this.post(`/v1/webhook-targets/${targetId}/reconcile`, input, options);
  }

  async listWebhookDeliveries(query = {}, options = {}) {
    return this.list("/v1/webhook-deliveries", query, options);
  }

  async getWebhookDelivery(deliveryId, options = {}) {
    return this.get(`/v1/webhook-deliveries/${deliveryId}`, options);
  }

  async redriveWebhookDelivery(deliveryId, options = {}) {
    return this.data("POST", `/v1/webhook-deliveries/${deliveryId}/redrive`, options);
  }

  async listSpaceDirectoryEntries(query = {}, options = {}) {
    return this.list("/v1/directory/spaces", query, options);
  }

  async listAgentDirectoryEntries(query = {}, options = {}) {
    return this.list("/v1/directory/agents", query, options);
  }

  async getSpaceOperatorSummary(spaceId, options = {}) {
    return this.get(`/v1/operator/spaces/${spaceId}/summary`, options);
  }

  async getSpaceOperatorLiveSnapshot(spaceId, query = {}, options = {}) {
    return this.get(`/v1/operator/spaces/${spaceId}/live`, {
      ...options,
      query
    });
  }

  async getControlPlaneObservability(options = {}) {
    return this.get("/v1/operator/control-plane-observability", options);
  }

  async listSpaceOperatorActivity(spaceId, query = {}, options = {}) {
    return this.list(`/v1/operator/spaces/${spaceId}/activity`, query, options);
  }

  async listSpaceOperatorPresenceEntries(spaceId, query = {}, options = {}) {
    return this.list(`/v1/operator/spaces/${spaceId}/presence`, query, options);
  }

  async listSpaceSignedStatusEntries(spaceId, query = {}, options = {}) {
    return this.list(`/v1/operator/spaces/${spaceId}/signed-status`, query, options);
  }

}

attachIntelligenceMethods(SwarmClient.prototype);
