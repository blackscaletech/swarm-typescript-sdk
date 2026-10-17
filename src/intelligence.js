import { pathSegment } from "./client-core.js";

function method(value) {
  return { value, writable: true, configurable: true };
}

async function askSpace(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/ask`, input, options);
}

async function askConnectedChatSpace(input = {}, options = {}) {
  return this.post("/v1/chat/ask", input, options);
}

async function buildSpaceContextPack(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/context-pack`, input, options);
}

async function buildConnectedChatContextPack(input = {}, options = {}) {
  return this.post("/v1/chat/context-pack", input, options);
}

async function previewHandoff(spaceId, input, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/handoff-preview/view`, input, { ...options, effect: "read" });
}

async function getContextPlan(spaceId, input, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/context-plan/view`, input, { ...options, effect: "read" });
}

async function createConnectedChatSessionDigest(input = {}, options = {}) {
  return this.post("/v1/chat/session-digest", input, options);
}

async function listSpaceAnswers(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.list(`/v1/spaces/${spaceKey}/answers`, query, options);
}

async function getSpaceAnswer(spaceId, answerId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const answerKey = pathSegment(answerId);
  return this.get(`/v1/spaces/${spaceKey}/answers/${answerKey}`, options);
}

async function getSpaceDecisionGraph(spaceId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.get(`/v1/spaces/${spaceKey}/decision-graph`, options);
}

async function getSpaceAnswerContract(spaceId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.get(`/v1/spaces/${spaceKey}/answer-contract`, options);
}

async function getSpaceWorkContract(spaceId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.get(`/v1/spaces/${spaceKey}/work-contract`, options);
}

async function listSpaceCapabilities(spaceId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.get(`/v1/spaces/${spaceKey}/capabilities`, options);
}

async function getSpaceOperationContract(spaceId, operationKind, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const operationKey = pathSegment(operationKind);
  return this.get(`/v1/spaces/${spaceKey}/operation-contracts/${operationKey}`, options);
}

async function listSpaceIntelligenceOperations(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.list(`/v1/spaces/${spaceKey}/operations`, query, options);
}

async function createSpaceIntelligenceOperation(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/operations`, input, options);
}

async function getSpaceIntelligenceOperation(spaceId, operationId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const operationKey = pathSegment(operationId);
  return this.get(`/v1/spaces/${spaceKey}/operations/${operationKey}`, options);
}

async function updateQueuedSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const operationKey = pathSegment(operationId);
  return this.patch(`/v1/spaces/${spaceKey}/operations/${operationKey}`, input, options);
}

async function cancelQueuedSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const operationKey = pathSegment(operationId);
  return this.post(`/v1/spaces/${spaceKey}/operations/${operationKey}/cancel`, input, options);
}

async function transitionSpaceIntelligenceOperation(spaceId, operationId, action, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const operationKey = pathSegment(operationId);
  const actionKey = pathSegment(action);
  return this.post(`/v1/spaces/${spaceKey}/operations/${operationKey}/${actionKey}`, input, options);
}

async function startSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
  return transitionSpaceIntelligenceOperation.call(this, spaceId, operationId, "start", input, options);
}

async function completeSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
  return transitionSpaceIntelligenceOperation.call(this, spaceId, operationId, "complete", input, options);
}

async function failSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
  return transitionSpaceIntelligenceOperation.call(this, spaceId, operationId, "fail", input, options);
}

async function listSpaceLearningCandidates(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.list(`/v1/spaces/${spaceKey}/learning-candidates`, query, options);
}

async function createSpaceLearningCandidate(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/learning-candidates`, input, options);
}

async function createSpaceLearningCandidateFromArtifact(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/learning-candidates/from-artifact`, input, options);
}

async function promoteSpaceLearningCandidate(spaceId, candidateId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const candidateKey = pathSegment(candidateId);
  return this.data("POST", `/v1/spaces/${spaceKey}/learning-candidates/${candidateKey}/promote`, options);
}

async function rejectSpaceLearningCandidate(spaceId, candidateId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const candidateKey = pathSegment(candidateId);
  return this.post(`/v1/spaces/${spaceKey}/learning-candidates/${candidateKey}/reject`, input, options);
}

async function correctSpaceLearningCandidate(spaceId, candidateId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const candidateKey = pathSegment(candidateId);
  return this.post(`/v1/spaces/${spaceKey}/learning-candidates/${candidateKey}/corrections`, input, options);
}

async function supersedeSpaceLearningCandidate(spaceId, candidateId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const candidateKey = pathSegment(candidateId);
  return this.post(`/v1/spaces/${spaceKey}/learning-candidates/${candidateKey}/supersede`, input, options);
}

async function listSpacePromotionGates(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.list(`/v1/spaces/${spaceKey}/promotion-gates`, query, options);
}

async function listSpaceIntelligenceProjections(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.list(`/v1/spaces/${spaceKey}/projections`, query, options);
}

async function listSpaceLearningQueueItems(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.list(`/v1/spaces/${spaceKey}/learning-queue`, query, options);
}

async function createSpaceLearningQueueItem(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/learning-queue`, input, options);
}

async function claimSpaceLearningQueueItem(spaceId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.post(`/v1/spaces/${spaceKey}/learning-queue/claim`, input, options);
}

async function completeSpaceLearningQueueItem(spaceId, itemId, input, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const itemKey = pathSegment(itemId);
  return this.post(`/v1/spaces/${spaceKey}/learning-queue/${itemKey}/complete`, input, options);
}

async function submitSpaceLearningQueueResult(spaceId, itemId, input = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  const itemKey = pathSegment(itemId);
  return this.post(`/v1/spaces/${spaceKey}/learning-queue/${itemKey}/result`, input, options);
}

async function getSpaceLearningFrontier(spaceId, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.get(`/v1/spaces/${spaceKey}/learning-frontier`, options);
}

async function getSpaceActionIntelligence(spaceId, query = {}, options = {}) {
  const spaceKey = pathSegment(spaceId);
  return this.get(`/v1/spaces/${spaceKey}/action-intelligence`, {
    ...options,
    query
  });
}

export function attachIntelligenceMethods(proto) {
  Object.defineProperties(proto, {
    askSpace: method(askSpace),
    askConnectedChatSpace: method(askConnectedChatSpace),
    buildSpaceContextPack: method(buildSpaceContextPack),
    buildConnectedChatContextPack: method(buildConnectedChatContextPack),
    previewHandoff: method(previewHandoff),
    getContextPlan: method(getContextPlan),
    createConnectedChatSessionDigest: method(createConnectedChatSessionDigest),
    listSpaceAnswers: method(listSpaceAnswers),
    getSpaceAnswer: method(getSpaceAnswer),
    getSpaceDecisionGraph: method(getSpaceDecisionGraph),
    getSpaceAnswerContract: method(getSpaceAnswerContract),
    getSpaceWorkContract: method(getSpaceWorkContract),
    listSpaceCapabilities: method(listSpaceCapabilities),
    getSpaceOperationContract: method(getSpaceOperationContract),
    listSpaceIntelligenceOperations: method(listSpaceIntelligenceOperations),
    createSpaceIntelligenceOperation: method(createSpaceIntelligenceOperation),
    getSpaceIntelligenceOperation: method(getSpaceIntelligenceOperation),
    updateQueuedSpaceIntelligenceOperation: method(updateQueuedSpaceIntelligenceOperation),
    cancelQueuedSpaceIntelligenceOperation: method(cancelQueuedSpaceIntelligenceOperation),
    startSpaceIntelligenceOperation: method(startSpaceIntelligenceOperation),
    completeSpaceIntelligenceOperation: method(completeSpaceIntelligenceOperation),
    failSpaceIntelligenceOperation: method(failSpaceIntelligenceOperation),
    listSpaceLearningCandidates: method(listSpaceLearningCandidates),
    createSpaceLearningCandidate: method(createSpaceLearningCandidate),
    createSpaceLearningCandidateFromArtifact: method(createSpaceLearningCandidateFromArtifact),
    promoteSpaceLearningCandidate: method(promoteSpaceLearningCandidate),
    rejectSpaceLearningCandidate: method(rejectSpaceLearningCandidate),
    correctSpaceLearningCandidate: method(correctSpaceLearningCandidate),
    supersedeSpaceLearningCandidate: method(supersedeSpaceLearningCandidate),
    listSpacePromotionGates: method(listSpacePromotionGates),
    listSpaceIntelligenceProjections: method(listSpaceIntelligenceProjections),
    listSpaceLearningQueueItems: method(listSpaceLearningQueueItems),
    createSpaceLearningQueueItem: method(createSpaceLearningQueueItem),
    claimSpaceLearningQueueItem: method(claimSpaceLearningQueueItem),
    completeSpaceLearningQueueItem: method(completeSpaceLearningQueueItem),
    submitSpaceLearningQueueResult: method(submitSpaceLearningQueueResult),
    getSpaceLearningFrontier: method(getSpaceLearningFrontier),
    getSpaceActionIntelligence: method(getSpaceActionIntelligence)
  });
}
