import { responseByteLimit } from "./response-body.js";

export function responsePolicies(input = []) {
  if (!Array.isArray(input) || input.length > 256) throw new TypeError("responseByteLimits must contain at most 256 endpoint policies");
  const seen = new Set();
  return input.map(policy => {
    if (!policy || typeof policy !== "object" || Array.isArray(policy) ||
        Object.keys(policy).some(key => !["method", "path", "maxResponseBytes", "maxErrorResponseBytes"].includes(key))) {
      throw new TypeError("Invalid endpoint response policy");
    }
    const method = String(policy.method || "").toUpperCase();
    const path = policy.path;
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method) || typeof path !== "string" ||
        !path.startsWith("/") || /[?#\\\s]/.test(path) || path.split("/").some(segment => [".", ".."].includes(segment))) {
      throw new TypeError("Endpoint response policy requires a method and absolute route template");
    }
    let pattern = "";
    for (const part of path.split(/(\{[A-Za-z][A-Za-z0-9_]*\})/)) {
      if (/^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(part)) pattern += "[^/]+";
      else {
        if (/[{}]/.test(part)) throw new TypeError("Invalid endpoint route parameter");
        pattern += part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }
    const key = method + " " + pattern;
    if (seen.has(key)) throw new TypeError("Duplicate endpoint response policy");
    seen.add(key);
    const maxResponseBytes = responseByteLimit(policy.maxResponseBytes, undefined, "maxResponseBytes");
    const maxErrorResponseBytes = responseByteLimit(policy.maxErrorResponseBytes, undefined, "maxErrorResponseBytes");
    if (maxResponseBytes === undefined && maxErrorResponseBytes === undefined) throw new TypeError("Endpoint response policy requires a byte limit");
    return Object.freeze({ method, pattern: new RegExp("^" + pattern + "$"), maxResponseBytes, maxErrorResponseBytes });
  });
}

export function endpointResponsePolicy(policies, method, path) {
  let selected;
  for (const policy of policies) {
    if (policy.method !== String(method).toUpperCase() || !policy.pattern.test(path)) continue;
    if (selected) throw new TypeError("Ambiguous endpoint response policies");
    selected = policy;
  }
  return selected;
}
