import {
  normalizeBootstrapCurrentUserEntityInput,
  normalizeBootstrapSpaceInput,
  normalizeConnectClientInput,
  normalizeConnectCurrentUserAndLaunchInput,
  normalizeConnectCurrentUserClientInput,
  normalizeLaunchRunInput
} from "./input-normalizers.js";
import { clientOperationKeyStrategy } from "./operation-policy.js";

function createIdempotencyKey(prefix = "swarm-sdk") {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `${prefix}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error("SwarmClient requires Web Crypto support to generate operation-scoped idempotency keys");
}

function canonicalizeIdempotencyValue(value, trimStrings = true) {
  if (typeof value === "string") {
    return trimStrings ? value.trim() : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeIdempotencyValue(item, trimStrings));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const canonical = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = canonicalizeIdempotencyValue(value[key], trimStrings);
    if (normalized !== undefined) {
      canonical[key] = normalized;
    }
  }
  return canonical;
}

function hashStableString(value) {
  const bytes = new TextEncoder().encode(value);
  const left = fnv1a64(bytes, 0xcbf29ce484222325n);
  const right = fnv1a64(bytes, 0x9e3779b97f4a7c15n);
  return `${left}${right}`;
}

function fnv1a64(bytes, offsetBasis) {
  let hash = offsetBasis;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

function buildStableMutationIdempotencyKey(prefix, method, path, body = null, intentKey = "", trimStrings = true) {
  const canonical = JSON.stringify(
    canonicalizeIdempotencyValue({
      method: typeof method === "string" ? method.trim().toUpperCase() : "",
      path: typeof path === "string" ? path.trim() : "",
      body,
      intent_key: typeof intentKey === "string" ? intentKey.trim() : ""
    }, trimStrings)
  );
  return `${prefix}-${hashStableString(canonical)}`;
}

export function defaultMutationIdempotencyKey(method, path, body, operationPath = path, explicitStrategy) {
  const strategy = clientOperationKeyStrategy(method, operationPath, explicitStrategy);
  if (strategy === null) return null;
  if (strategy === "fresh-attempt") {
    return createIdempotencyKey("swarm-sdk-op");
  }
  // Hash the same JSON representation that goes on the wire. Raw evidence
  // whitespace is content, not an SDK normalization rule.
  const wireBody = body === undefined ? null : JSON.parse(JSON.stringify(body));
  return buildStableMutationIdempotencyKey("swarm-sdk-v2", method, path, wireBody, "", false);
}

export function buildLaunchRunIdempotencyKey(spaceId, input = {}, intentKey = "") {
  const normalizedSpaceId = typeof spaceId === "string" ? spaceId.trim() : "";
  const normalizedIntentKey = typeof intentKey === "string" ? intentKey.trim() : "";
  const normalizedInput = normalizeLaunchRunInput(input);
  const canonical = JSON.stringify({
    ...(normalizedInput.model_route_policy_id ? { model_route_policy_id: normalizedInput.model_route_policy_id } : {}),
    space_id: normalizedSpaceId,
    automation_profile_id: normalizedInput.automation_profile_id,
    launch_template_id: normalizedInput.launch_template_id,
    title: normalizedInput.title,
    description: normalizedInput.description,
    execution_policy_id: normalizedInput.execution_policy_id,
    prompt_capture_mode: normalizedInput.prompt_capture_mode,
    prompt_visibility_mode: normalizedInput.prompt_visibility_mode,
    acknowledge_public_raw_prompt_visibility:
      normalizedInput.acknowledge_public_raw_prompt_visibility,
    source_prompt: normalizedInput.source_prompt,
    compiled_brief: normalizedInput.compiled_brief,
    run_requirements: normalizedInput.run_requirements,
    run_context_refs: normalizedInput.run_context_refs,
    intent_key: normalizedIntentKey
  });
  return `swarm-launch-${hashStableString(canonical)}`;
}

export function buildBootstrapSpaceIdempotencyKey(entityId, input = {}, intentKey = "") {
  const normalizedEntityId = typeof entityId === "string" ? entityId.trim() : "";
  const normalizedIntentKey = typeof intentKey === "string" ? intentKey.trim() : "";
  const normalizedInput = normalizeBootstrapSpaceInput(input);
  const canonical = JSON.stringify({
    entity_id: normalizedEntityId,
    space: normalizedInput.space,
    agent: normalizedInput.agent,
    credential: normalizedInput.credential,
    launch_template: normalizedInput.launch_template,
    automation_profile: normalizedInput.automation_profile,
    launch: normalizedInput.launch,
    intent_key: normalizedIntentKey
  });
  return `swarm-bootstrap-${hashStableString(canonical)}`;
}

export function buildConnectClientIdempotencyKey(spaceId, input = {}, intentKey = "") {
  const normalizedIntentKey = typeof intentKey === "string" ? intentKey.trim() : "";
  const normalizedInput = normalizeConnectClientInput(spaceId, input);
  const canonical = JSON.stringify({
    space_id: normalizedInput.space_id,
    agent_id: normalizedInput.agent_id,
    kind: normalizedInput.kind,
    name: normalizedInput.name,
    description: normalizedInput.description,
    capabilities: normalizedInput.capabilities,
    credential: normalizedInput.credential,
    intent_key: normalizedIntentKey
  });
  return `swarm-connect-${hashStableString(canonical)}`;
}

export function buildConnectSpaceClientIdempotencyKey(spaceId, input = {}, intentKey = "") {
  return buildConnectClientIdempotencyKey(spaceId, input, intentKey);
}

export function buildConnectCurrentUserClientIdempotencyKey(input = {}, intentKey = "") {
  const normalizedIntentKey = typeof intentKey === "string" ? intentKey.trim() : "";
  const normalizedInput = normalizeConnectCurrentUserClientInput(input);
  const canonical = JSON.stringify({
    space_id: normalizedInput.space_id,
    space_name: normalizedInput.space_name,
    space_description: normalizedInput.space_description,
    agent_id: normalizedInput.agent_id,
    kind: normalizedInput.kind,
    name: normalizedInput.name,
    description: normalizedInput.description,
    capabilities: normalizedInput.capabilities,
    credential: normalizedInput.credential,
    intent_key: normalizedIntentKey
  });
  return `swarm-me-connect-${hashStableString(canonical)}`;
}

export function buildBootstrapCurrentUserEntityIdempotencyKey(input = {}, intentKey = "") {
  const normalizedIntentKey = typeof intentKey === "string" ? intentKey.trim() : "";
  const normalizedInput = normalizeBootstrapCurrentUserEntityInput(input);
  const canonical = JSON.stringify({
    key: normalizedInput.key,
    name: normalizedInput.name,
    activate_session: normalizedInput.activate_session,
    space: normalizedInput.space,
    connection: normalizedInput.connection,
    launch_template: normalizedInput.launch_template,
    automation_profile: normalizedInput.automation_profile,
    intent_key: normalizedIntentKey
  });
  return `swarm-me-bootstrap-entity-${hashStableString(canonical)}`;
}

export function buildConnectCurrentUserAndLaunchIdempotencyKey(input = {}, intentKey = "") {
  const normalizedIntentKey = typeof intentKey === "string" ? intentKey.trim() : "";
  const normalizedInput = normalizeConnectCurrentUserAndLaunchInput(input);
  const canonical = JSON.stringify({
    connection: normalizedInput.connection,
    runtime_heartbeat: normalizedInput.runtime_heartbeat,
    webhook_follow_up: normalizedInput.webhook_follow_up,
    launch: normalizedInput.launch,
    intent_key: normalizedIntentKey
  });
  return `swarm-me-connect-launch-${hashStableString(canonical)}`;
}
