import { normalizeStringList, normalizeRunRequirements, normalizeRunContextRefs } from "./run-requirements.js";
export { normalizeStringList, normalizeRunRequirements, normalizeRunContextRefs };

function constraintObject(input, fields, label) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (Object.keys(input).some(key => !fields.includes(key))) {
    throw new TypeError(`${label} contains an unsupported field; use a version-compatible raw request instead`);
  }
  return input;
}

function constraintList(value, label, lowerCase = false) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  return normalizeStringList(value, { lowerCase });
}

export function normalizeScoringContract(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  if (!spec) {
    throw new TypeError("scoring_contract must be an object");
  }
  constraintObject(spec, ["rubric_key", "version", "pass_threshold", "fail_threshold", "strict_mode", "dimensions", "accepted_evaluation_method_keys"], "scoring_contract");
  const acceptedMethods = constraintList(spec.accepted_evaluation_method_keys, "accepted_evaluation_method_keys", true);
  if (spec.rubric_key !== undefined && typeof spec.rubric_key !== "string") throw new TypeError("rubric_key must be a string");
  if (spec.strict_mode !== undefined && typeof spec.strict_mode !== "boolean") throw new TypeError("strict_mode must be a boolean");
  for (const key of ["version", "pass_threshold", "fail_threshold"]) {
    if (spec[key] !== undefined && !Number.isSafeInteger(spec[key])) throw new TypeError(`${key} must be a safe integer`);
  }
  if (spec.dimensions !== undefined && !Array.isArray(spec.dimensions)) throw new TypeError("dimensions must be an array");
  for (const rule of spec.dimensions || []) {
    constraintObject(rule, ["key", "weight_bps", "min_required"], "scoring dimension");
    if (typeof rule.key !== "string" || !rule.key.trim() || !Number.isSafeInteger(rule.weight_bps) ||
        rule.min_required !== undefined && !Number.isSafeInteger(rule.min_required)) throw new TypeError("Invalid scoring dimension");
  }
  const rubricKey = typeof spec.rubric_key === "string" ? spec.rubric_key.trim() : "";
  const dimensions = Array.isArray(spec.dimensions)
    ? spec.dimensions
        .filter((rule) => rule && typeof rule === "object" && !Array.isArray(rule))
        .map((rule) => ({
          key: typeof rule.key === "string" ? rule.key.trim().toLowerCase() : "",
          weight_bps: Number.isInteger(rule.weight_bps) ? rule.weight_bps : 0,
          min_required: Number.isInteger(rule.min_required) ? rule.min_required : 0
        }))
        .filter((rule) => rule.key !== "")
        .sort((left, right) => left.key.localeCompare(right.key))
    : [];
  if (
    rubricKey === "" &&
    !Number.isInteger(spec.version) &&
    !Number.isInteger(spec.pass_threshold) &&
    !Number.isInteger(spec.fail_threshold) &&
    dimensions.length === 0 &&
    spec.strict_mode !== true && acceptedMethods.length === 0
  ) {
    return undefined;
  }
  return {
    rubric_key: rubricKey,
    version: Number.isInteger(spec.version) ? spec.version : 0,
    pass_threshold: Number.isInteger(spec.pass_threshold) ? spec.pass_threshold : 0,
    fail_threshold: Number.isInteger(spec.fail_threshold) ? spec.fail_threshold : 0,
    strict_mode: spec.strict_mode === true,
    ...(spec.accepted_evaluation_method_keys !== undefined ? { accepted_evaluation_method_keys: acceptedMethods } : {}),
    dimensions
  };
}

export function normalizeLaunchRunInput(input = {}) {
  return {
    ...(typeof input.model_route_policy_id === "string" && input.model_route_policy_id.trim()
      ? { model_route_policy_id: input.model_route_policy_id.trim() } : {}),
    automation_profile_id:
      typeof input.automation_profile_id === "string" && input.automation_profile_id.trim() !== ""
        ? input.automation_profile_id.trim()
        : "",
    launch_template_id:
      typeof input.launch_template_id === "string" && input.launch_template_id.trim() !== ""
        ? input.launch_template_id.trim()
        : "",
    title: typeof input.title === "string" ? input.title.trim() : "",
    description: typeof input.description === "string" ? input.description.trim() : "",
    execution_policy_id:
      typeof input.execution_policy_id === "string" && input.execution_policy_id.trim() !== ""
        ? input.execution_policy_id.trim()
        : "",
    prompt_capture_mode:
      typeof input.prompt_capture_mode === "string" && input.prompt_capture_mode.trim() !== ""
        ? input.prompt_capture_mode.trim()
        : "",
    prompt_visibility_mode:
      typeof input.prompt_visibility_mode === "string" && input.prompt_visibility_mode.trim() !== ""
        ? input.prompt_visibility_mode.trim()
        : "",
    acknowledge_public_raw_prompt_visibility:
      input.acknowledge_public_raw_prompt_visibility === true,
    source_prompt: typeof input.source_prompt === "string" ? input.source_prompt.trim() : "",
    compiled_brief: typeof input.compiled_brief === "string" ? input.compiled_brief.trim() : "",
    run_requirements: normalizeRunRequirements(input.run_requirements),
    run_context_refs: normalizeRunContextRefs(input.run_context_refs)
  };
}

export function normalizeAutomationProfileTaskInput(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    title: typeof spec.title === "string" ? spec.title.trim() : "",
    description: typeof spec.description === "string" ? spec.description.trim() : "",
    execution_policy_id:
      typeof spec.execution_policy_id === "string" && spec.execution_policy_id.trim() !== ""
        ? spec.execution_policy_id.trim()
        : ""
  };
}

export function normalizeAutomationProfileLaunchTemplateInput(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    name: typeof spec.name === "string" ? spec.name.trim() : "",
    summary: typeof spec.summary === "string" ? spec.summary.trim() : "",
    title: typeof spec.title === "string" ? spec.title.trim() : "",
    description: typeof spec.description === "string" ? spec.description.trim() : "",
    execution_policy_id:
      typeof spec.execution_policy_id === "string" && spec.execution_policy_id.trim() !== ""
        ? spec.execution_policy_id.trim()
        : "",
    run_requirements: normalizeRunRequirements(spec.run_requirements),
    run_context_refs: normalizeRunContextRefs(spec.run_context_refs),
    scoring_contract: normalizeScoringContract(spec.scoring_contract)
  };
}

export function normalizeBootstrapSpaceInput(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const space = spec.space && typeof spec.space === "object" && !Array.isArray(spec.space) ? spec.space : {};
  const agent = spec.agent && typeof spec.agent === "object" && !Array.isArray(spec.agent) ? spec.agent : {};
  const credential =
    spec.credential && typeof spec.credential === "object" && !Array.isArray(spec.credential) ? spec.credential : {};
  const automationProfile =
    spec.automation_profile && typeof spec.automation_profile === "object" && !Array.isArray(spec.automation_profile)
      ? spec.automation_profile
      : null;
  return {
    space: {
      key: typeof space.key === "string" ? space.key.trim() : "",
      name: typeof space.name === "string" ? space.name.trim() : "",
      description: typeof space.description === "string" ? space.description.trim() : ""
    },
    agent: {
      kind: typeof agent.kind === "string" ? agent.kind.trim() : "",
      name: typeof agent.name === "string" ? agent.name.trim() : "",
      description: typeof agent.description === "string" ? agent.description.trim() : "",
      capabilities: normalizeStringList(agent.capabilities, { lowerCase: true })
    },
    credential: {
      description: typeof credential.description === "string" ? credential.description.trim() : "",
      ttl_seconds: Number.isInteger(credential.ttl_seconds) && credential.ttl_seconds > 0 ? credential.ttl_seconds : 0
    },
    launch_template:
      spec.launch_template && typeof spec.launch_template === "object" && !Array.isArray(spec.launch_template)
        ? normalizeAutomationProfileLaunchTemplateInput(spec.launch_template)
        : null,
    automation_profile: automationProfile
      ? {
          key: typeof automationProfile.key === "string" ? automationProfile.key.trim() : "",
          name: typeof automationProfile.name === "string" ? automationProfile.name.trim() : "",
          summary: typeof automationProfile.summary === "string" ? automationProfile.summary.trim() : "",
          compiler_key: typeof automationProfile.compiler_key === "string" ? automationProfile.compiler_key.trim() : "",
          review_threshold:
            Number.isInteger(automationProfile.review_threshold) && automationProfile.review_threshold >= 0
              ? automationProfile.review_threshold
              : 0,
          prompt_capture_mode:
            typeof automationProfile.prompt_capture_mode === "string" ? automationProfile.prompt_capture_mode.trim() : "",
          launch_template: normalizeAutomationProfileLaunchTemplateInput(automationProfile.launch_template),
          review_task: normalizeAutomationProfileTaskInput(automationProfile.review_task),
          remediation_task: normalizeAutomationProfileTaskInput(automationProfile.remediation_task),
          finalize_task: normalizeAutomationProfileTaskInput(automationProfile.finalize_task)
        }
      : null,
    launch:
      spec.launch && typeof spec.launch === "object" && !Array.isArray(spec.launch)
        ? {
            mode: typeof spec.launch.mode === "string" ? spec.launch.mode.trim() : "",
            ...normalizeLaunchRunInput(spec.launch)
          }
        : null
  };
}

export function normalizeConnectClientInput(spaceId, input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const credential =
    spec.credential && typeof spec.credential === "object" && !Array.isArray(spec.credential) ? spec.credential : {};
  const agentId =
    typeof spec.agent_id === "string" && spec.agent_id.trim() !== ""
      ? spec.agent_id.trim()
      : typeof spec.agentId === "string" && spec.agentId.trim() !== ""
        ? spec.agentId.trim()
        : "";
  const kindValue = typeof spec.kind === "string" && spec.kind.trim() !== "" ? spec.kind.trim() : "";
  return {
    space_id: typeof spaceId === "string" ? spaceId.trim() : "",
    agent_id: agentId,
    kind: agentId === "" ? kindValue || "client" : "",
    name: agentId === "" && typeof spec.name === "string" ? spec.name.trim() : "",
    description: agentId === "" && typeof spec.description === "string" ? spec.description.trim() : "",
    capabilities: agentId === "" ? normalizeStringList(spec.capabilities, { lowerCase: true }) : [],
    credential: {
      description: typeof credential.description === "string" ? credential.description.trim() : "",
      ttl_seconds: Number.isInteger(credential.ttl_seconds) && credential.ttl_seconds > 0 ? credential.ttl_seconds : 0
    }
  };
}

export function normalizeConnectCurrentUserClientInput(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const explicitSpaceId =
    typeof spec.space_id === "string"
      ? spec.space_id
      : typeof spec.spaceId === "string"
        ? spec.spaceId
        : "";
  const normalized = normalizeConnectClientInput(explicitSpaceId, spec);
  return {
    space_id: normalized.space_id,
    space_name: typeof spec.space_name === "string"
      ? spec.space_name.trim()
      : typeof spec.spaceName === "string"
        ? spec.spaceName.trim()
        : "",
    space_description: typeof spec.space_description === "string"
      ? spec.space_description.trim()
      : typeof spec.spaceDescription === "string"
        ? spec.spaceDescription.trim()
        : "",
    agent_id: normalized.agent_id,
    kind: normalized.kind,
    name: normalized.name,
    description: normalized.description,
    capabilities: normalized.capabilities,
    credential: normalized.credential
  };
}

export function normalizeBootstrapCurrentUserEntityInput(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const space =
    spec.space && typeof spec.space === "object" && !Array.isArray(spec.space)
      ? spec.space
      : {};
  const launchTemplate =
    spec.launch_template && typeof spec.launch_template === "object" && !Array.isArray(spec.launch_template)
      ? spec.launch_template
      : spec.launchTemplate && typeof spec.launchTemplate === "object" && !Array.isArray(spec.launchTemplate)
        ? spec.launchTemplate
        : null;
  const automationProfile =
    spec.automation_profile && typeof spec.automation_profile === "object" && !Array.isArray(spec.automation_profile)
      ? spec.automation_profile
      : spec.automationProfile && typeof spec.automationProfile === "object" && !Array.isArray(spec.automationProfile)
        ? spec.automationProfile
        : null;
  const normalized = {
    key: typeof spec.key === "string" ? spec.key.trim() : "",
    name: typeof spec.name === "string" ? spec.name.trim() : "",
    activate_session: typeof spec.activate_session === "boolean"
      ? spec.activate_session
      : typeof spec.activateSession === "boolean"
        ? spec.activateSession
        : true,
    space: {
      key: typeof space.key === "string" ? space.key.trim() : "",
      name: typeof space.name === "string" ? space.name.trim() : "",
      description: typeof space.description === "string" ? space.description.trim() : ""
    }
  };
  if (launchTemplate) {
    normalized.launch_template = normalizeAutomationProfileLaunchTemplateInput(launchTemplate);
  }
  if (automationProfile) {
    normalized.automation_profile = {
      key: typeof automationProfile.key === "string" ? automationProfile.key.trim() : "",
      name: typeof automationProfile.name === "string" ? automationProfile.name.trim() : "",
      summary: typeof automationProfile.summary === "string" ? automationProfile.summary.trim() : "",
      compiler_key:
        typeof automationProfile.compiler_key === "string" && automationProfile.compiler_key.trim() !== ""
          ? automationProfile.compiler_key.trim()
          : typeof automationProfile.compilerKey === "string"
            ? automationProfile.compilerKey.trim()
            : "",
      review_threshold:
        Number.isInteger(automationProfile.review_threshold) && automationProfile.review_threshold >= 0
          ? automationProfile.review_threshold
          : 0,
      prompt_capture_mode:
        typeof automationProfile.prompt_capture_mode === "string" && automationProfile.prompt_capture_mode.trim() !== ""
          ? automationProfile.prompt_capture_mode.trim()
          : typeof automationProfile.promptCaptureMode === "string"
            ? automationProfile.promptCaptureMode.trim()
            : "",
      launch_template: normalizeAutomationProfileLaunchTemplateInput(automationProfile.launch_template),
      review_task: normalizeAutomationProfileTaskInput(automationProfile.review_task),
      remediation_task: normalizeAutomationProfileTaskInput(automationProfile.remediation_task),
      finalize_task: normalizeAutomationProfileTaskInput(automationProfile.finalize_task)
    };
  }
  return normalized;
}

function normalizeConnectedLaunchInput(spaceId, input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const agentId =
    typeof spec.agent_id === "string" && spec.agent_id.trim() !== ""
      ? spec.agent_id.trim()
      : typeof spec.agentId === "string" && spec.agentId.trim() !== ""
        ? spec.agentId.trim()
        : "";
  return {
    space_id: typeof spaceId === "string" ? spaceId.trim() : "",
    agent_id: agentId,
    ttl_seconds: Number.isInteger(spec.ttl_seconds) && spec.ttl_seconds > 0 ? spec.ttl_seconds : 0,
    ...normalizeLaunchRunInput(spec)
  };
}

export function normalizeConnectCurrentUserAndLaunchInput(input = {}) {
  const spec = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const connection = normalizeConnectCurrentUserClientInput(spec.connection || {});
  const runtimeHeartbeatSpec =
    spec.runtime_heartbeat && typeof spec.runtime_heartbeat === "object" && !Array.isArray(spec.runtime_heartbeat)
      ? spec.runtime_heartbeat
      : spec.runtimeHeartbeat && typeof spec.runtimeHeartbeat === "object" && !Array.isArray(spec.runtimeHeartbeat)
        ? spec.runtimeHeartbeat
        : {};
  const webhookFollowUpSpec =
    spec.webhook_follow_up && typeof spec.webhook_follow_up === "object" && !Array.isArray(spec.webhook_follow_up)
      ? spec.webhook_follow_up
      : spec.webhookFollowUp && typeof spec.webhookFollowUp === "object" && !Array.isArray(spec.webhookFollowUp)
        ? spec.webhookFollowUp
        : {};
  const launch = normalizeConnectedLaunchInput("", spec.launch || {});
  delete launch.space_id;
  const webhookFollowUp = {
    preset_key:
      typeof webhookFollowUpSpec.preset_key === "string" && webhookFollowUpSpec.preset_key.trim() !== ""
        ? webhookFollowUpSpec.preset_key.trim()
        : typeof webhookFollowUpSpec.presetKey === "string" && webhookFollowUpSpec.presetKey.trim() !== ""
          ? webhookFollowUpSpec.presetKey.trim()
          : typeof webhookFollowUpSpec.url === "string" && webhookFollowUpSpec.url.trim() !== ""
            ? "chat_follow_up"
            : "",
    name: typeof webhookFollowUpSpec.name === "string" ? webhookFollowUpSpec.name.trim() : "",
    url: typeof webhookFollowUpSpec.url === "string" ? webhookFollowUpSpec.url.trim() : "",
    signing_secret:
      typeof webhookFollowUpSpec.signing_secret === "string" && webhookFollowUpSpec.signing_secret.trim() !== ""
        ? webhookFollowUpSpec.signing_secret.trim()
        : typeof webhookFollowUpSpec.signingSecret === "string"
          ? webhookFollowUpSpec.signingSecret.trim()
          : ""
  };
  return {
    connection,
    runtime_heartbeat: {
      status: typeof runtimeHeartbeatSpec.status === "string" ? runtimeHeartbeatSpec.status.trim() : "",
      region: typeof runtimeHeartbeatSpec.region === "string" ? runtimeHeartbeatSpec.region.trim() : "",
      protocol: typeof runtimeHeartbeatSpec.protocol === "string" ? runtimeHeartbeatSpec.protocol.trim() : "",
      version: typeof runtimeHeartbeatSpec.version === "string" ? runtimeHeartbeatSpec.version.trim() : "",
      execution_mode:
        typeof runtimeHeartbeatSpec.execution_mode === "string" && runtimeHeartbeatSpec.execution_mode.trim() !== ""
          ? runtimeHeartbeatSpec.execution_mode.trim()
          : typeof runtimeHeartbeatSpec.executionMode === "string"
            ? runtimeHeartbeatSpec.executionMode.trim()
            : "",
      sandbox_provider:
        typeof runtimeHeartbeatSpec.sandbox_provider === "string" && runtimeHeartbeatSpec.sandbox_provider.trim() !== ""
          ? runtimeHeartbeatSpec.sandbox_provider.trim()
          : typeof runtimeHeartbeatSpec.sandboxProvider === "string"
            ? runtimeHeartbeatSpec.sandboxProvider.trim()
            : "",
      sandbox_preset:
        typeof runtimeHeartbeatSpec.sandbox_preset === "string" && runtimeHeartbeatSpec.sandbox_preset.trim() !== ""
          ? runtimeHeartbeatSpec.sandbox_preset.trim()
          : typeof runtimeHeartbeatSpec.sandboxPreset === "string"
            ? runtimeHeartbeatSpec.sandboxPreset.trim()
            : ""
    },
    webhook_follow_up: webhookFollowUp,
    launch: {
      ...(launch.model_route_policy_id ? { model_route_policy_id: launch.model_route_policy_id } : {}),
      ttl_seconds: launch.ttl_seconds,
      automation_profile_id: launch.automation_profile_id,
      launch_template_id: launch.launch_template_id,
      title: launch.title,
      description: launch.description,
      execution_policy_id: launch.execution_policy_id,
      run_requirements: launch.run_requirements,
      run_context_refs: launch.run_context_refs,
      prompt_capture_mode: launch.prompt_capture_mode,
      prompt_visibility_mode: launch.prompt_visibility_mode,
      acknowledge_public_raw_prompt_visibility:
        launch.acknowledge_public_raw_prompt_visibility,
      source_prompt: launch.source_prompt,
      compiled_brief: launch.compiled_brief
    }
  };
}

export function normalizePromptLaunchInput(input = {}) {
  const spec = normalizeLaunchRunInput(input);
  const targetAgentId =
    typeof input?.target_agent_id === "string" && input.target_agent_id.trim() !== "" ? input.target_agent_id.trim() : "";
  if (targetAgentId && spec.run_requirements.target_agent_ids.length === 0) {
    spec.run_requirements.target_agent_ids = [targetAgentId];
  }
  if (!spec.prompt_capture_mode) {
    spec.prompt_capture_mode = "compiled_only";
  }
  return spec;
}

export function normalizeRuntimeHeartbeatPayload(input = {}) {
  const payload = input && typeof input === "object" && !Array.isArray(input) ? { ...input } : {};
  delete payload.status;
  delete payload.current_run_id;
  delete payload.current_run_lease_id;
  return payload;
}
