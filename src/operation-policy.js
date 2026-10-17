// Generated from runtime-js-common. Run npm run build:shared; do not edit.
import { CLIENT_OPERATION_POLICIES } from "./operation-policies.js";

const policies = CLIENT_OPERATION_POLICIES.map(([method, path, required, strategy]) => ({ method,
  segments: path.split("/").map(segment => segment.includes("{") ? { prefix: segment.slice(0, segment.indexOf("{")), suffix: segment.slice(segment.indexOf("}") + 1) } : segment), required, strategy }));

export function clientOperationKeyStrategy(method, path, explicitStrategy) {
  if (explicitStrategy !== undefined && !["fresh-attempt", "durable-content"].includes(explicitStrategy)) throw new TypeError("Invalid client idempotency policy");
  const normalizedMethod = String(method).trim().toUpperCase(), segments = path.split("/");
  const matches = policies.filter(policy => policy.method === normalizedMethod && policy.segments.length === segments.length &&
    policy.segments.every((segment, index) => typeof segment === "string" ? segment === segments[index] :
      segments[index].startsWith(segment.prefix) && segments[index].endsWith(segment.suffix) && segments[index].length > segment.prefix.length + segment.suffix.length));
  if (matches.length > 1) throw new TypeError("Ambiguous client operation policy");
  const policy = matches[0];
  if (!policy) {
    if (!explicitStrategy) throw new TypeError("Unknown mutation operation requires an explicit idempotency key or policy");
    return explicitStrategy;
  }
  if (explicitStrategy && explicitStrategy !== policy.strategy) throw new TypeError("Explicit idempotency policy conflicts with the operation contract");
  return policy.required ? policy.strategy : null;
}
