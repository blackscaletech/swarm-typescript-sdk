// Generated from runtime-js-common. Run npm run build:shared; do not edit.
const ID_FIELDS = ["target_identity_ids", "excluded_identity_ids", "target_agent_ids"];
const CONSTRAINT_FIELDS = [
  "required_capabilities", "required_tools", "required_models", "required_connectors",
  "required_regions", "required_protocols", "required_runtime_human_action_tags",
  "required_approval_actions", "result_approval_actions"
];
const REQUIREMENT_FIELDS = new Set([
  "execution_mode", "assignment_mode", "required_hosting_mode", ...ID_FIELDS, ...CONSTRAINT_FIELDS
]);

export function normalizeStringList(values, { lowerCase = false } = {}) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(value => typeof value === "string")
    .map(value => lowerCase ? value.trim().toLowerCase() : value.trim())
    .filter(Boolean))].sort();
}

function requirementList(value, field, lowerCase) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
    throw new TypeError(`${field} must be an array of non-empty strings`);
  }
  return normalizeStringList(value, { lowerCase });
}

function requirementMode(value, allowed, field) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new TypeError(`${field} is unsupported`);
  }
  const normalized = value.trim();
  if (normalized && !allowed.includes(normalized)) throw new TypeError(`${field} is unsupported`);
  return normalized;
}

export function normalizeRunRequirements(input = {}) {
  if (input === null) input = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("run_requirements must be an object");
  }
  if (Object.keys(input).some(field => !REQUIREMENT_FIELDS.has(field))) {
    throw new TypeError("run_requirements contains an unsupported field; use a version-compatible raw request instead");
  }
  const executionMode = requirementMode(input.execution_mode, ["agent", "core"], "execution_mode");
  const assignmentMode = requirementMode(input.assignment_mode, ["self", "specific", "any", "others"], "assignment_mode");
  if (input.required_hosting_mode !== undefined && typeof input.required_hosting_mode !== "string") {
    throw new TypeError("required_hosting_mode must be a string");
  }
  const normalized = {
    ...(executionMode ? { execution_mode: executionMode } : {}),
    ...(assignmentMode ? { assignment_mode: assignmentMode } : {})
  };
  for (const field of ID_FIELDS) {
    const values = requirementList(input[field], field, false);
    if (field === "target_agent_ids" || values.length > 0) normalized[field] = values;
  }
  for (const field of CONSTRAINT_FIELDS) normalized[field] = requirementList(input[field], field, true);
  normalized.required_hosting_mode = (input.required_hosting_mode || "").trim().toLowerCase();
  return normalized;
}

export function normalizeRunContextRefs(values) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError("run_context_refs must be an array");
  const normalized = [];
  const seen = new Set();
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some(field => field !== "resource_type" && field !== "resource_id")) {
      throw new TypeError("run_context_ref must contain only resource_type and resource_id");
    }
    const resourceType = typeof value.resource_type === "string" ? value.resource_type.trim().toLowerCase() : "";
    const resourceID = typeof value.resource_id === "string" ? value.resource_id.trim() : "";
    if (!["run", "task", "artifact", "evaluation"].includes(resourceType) || !resourceID) {
      throw new TypeError("run_context_ref requires a supported resource_type and non-empty resource_id");
    }
    const key = `${resourceType}:${resourceID}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ resource_type: resourceType, resource_id: resourceID });
  }
  return normalized;
}
