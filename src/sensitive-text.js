// Generated from runtime-js-common. Run npm run build:shared; do not edit.
const SWARM_ASSIGNMENT_RE =
  /\b(SWARM_(?:HUMAN_TOKEN|RUNTIME_TOKEN|CHAT_TOKEN|CONNECT_CODE|AGENT_TOKEN|TOKEN|MCP_TOKEN|OPENCLAW_API_TOKEN))\b\s*[:=]\s*([^\s'"]{8,})/gim;
const SWARM_TOKEN_RE = /\bswarm_(?:usr|agt|chat|pair)_[a-z0-9]{12,}\b/gi;
const SWARM_CONNECTION_TOKEN_RE = /\b(?:sw(?:a|c|ac)_v2\.[a-f0-9]{16}\.[A-Za-z0-9_-]{43}|swr_ctf_[a-f0-9]{32}\.[0-9]+\.v2\.[a-f0-9]{16}\.[A-Za-z0-9_-]{43}|sw(?:u|ur|a|c)_(?!client_)[A-Za-z0-9_-]{43}|swr_ctf_[a-f0-9]{32}\.[A-Za-z0-9_-]{43})/g;
const AUTH_HEADER_BEARER_RE = /\bAuthorization\b\s*:\s*Bearer\s+[^\s'"]{8,}/gim;
const BEARER_TOKEN_RE = /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi;
const API_KEY_ASSIGNMENT_RE = /\b(?:X-API-Key|Api-Key|API_KEY)\b\s*[:=]\s*([^\s'"]{8,})/gim;
const PASSWORD_ASSIGNMENT_RE =
  /\b((?:PASSWORD|PASSWD|DB_PASSWORD|DATABASE_PASSWORD|PGPASSWORD|MYSQL_PWD|REDIS_PASSWORD|TOKEN|SECRET|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN))\b\s*[:=]\s*([^\s'"]{4,})/gim;
const AWS_SECRET_RE = /\b(?:AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)\b\s*[:=]\s*([^\s'"]{8,})/gim;
const AWS_ACCESS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/g;
const PRIVATE_KEY_BLOCK_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const CONNECTION_STRING_PASSWORD_RE =
  /\b([a-z][a-z0-9+.-]*:\/\/[^:\s]+:)([^@\s]+)(@)/gim;
const URL_PASSWORD_QUERY_RE = /([?&](?:password|passwd|pwd|token|secret|key)=)([^&#\s]+)/gim;
const SENTRY_DSN_RE = /\bhttps?:\/\/[0-9a-f]{16,}:[0-9a-z_-]{16,}@o\d+\.ingest\.[^/\s]+\/\d+\b/gi;
const GCP_SERVICE_ACCOUNT_RE = /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----\\n"/g;

export function sanitizeSensitiveText(value, { maxLen = 512 } = {}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed === "") {
    return "";
  }

  let sanitized = trimmed
    .replace(PRIVATE_KEY_BLOCK_RE, "[REDACTED_PRIVATE_KEY]")
    .replace(GCP_SERVICE_ACCOUNT_RE, '"private_key":"[REDACTED_PRIVATE_KEY]"')
    .replace(CONNECTION_STRING_PASSWORD_RE, "$1[REDACTED_SECRET]$3")
    .replace(URL_PASSWORD_QUERY_RE, "$1[REDACTED_SECRET]")
    .replace(SENTRY_DSN_RE, "[REDACTED_DSN]")
    .replace(SWARM_ASSIGNMENT_RE, "$1=[REDACTED_SECRET]")
    .replace(SWARM_TOKEN_RE, "[REDACTED_SECRET]")
    .replace(SWARM_CONNECTION_TOKEN_RE, "[REDACTED_SECRET]")
    .replace(AUTH_HEADER_BEARER_RE, "Authorization: Bearer [REDACTED_SECRET]")
    .replace(BEARER_TOKEN_RE, "Bearer [REDACTED_SECRET]")
    .replace(API_KEY_ASSIGNMENT_RE, "API_KEY=[REDACTED_SECRET]")
    .replace(PASSWORD_ASSIGNMENT_RE, (_match, key) => `${String(key || "").trim()}=[REDACTED_SECRET]`)
    .replace(AWS_SECRET_RE, (match) => match.replace(/[:=]\s*.*/, "=[REDACTED_SECRET]"))
    .replace(AWS_ACCESS_KEY_RE, "[REDACTED_AWS_ACCESS_KEY]");

  if (maxLen > 0 && sanitized.length > maxLen) {
    sanitized = `${sanitized.slice(0, maxLen).trimEnd()}...`;
  }
  return sanitized;
}

export function sanitizeSensitiveValue(value, { maxLen = 512 } = {}) {
  if (typeof value === "string") {
    return sanitizeSensitiveText(value, { maxLen });
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSensitiveValue(item, { maxLen }));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeSensitiveValue(entry, { maxLen })])
    );
  }
  return value;
}
