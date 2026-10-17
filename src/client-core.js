import {
  DEFAULT_SSE_MAX_BUFFER_BYTES,
  DEFAULT_SSE_MAX_EVENT_BYTES,
  createTimedAbortSignal
} from "./event-stream.js";
import { defaultMutationIdempotencyKey } from "./idempotency.js";
import { clientOperationKeyStrategy } from "./operation-policy.js";
import { sanitizeSensitiveText, sanitizeSensitiveValue } from "./sensitive-text.js";
import { DEFAULT_MAX_RESPONSE_BYTES, DEFAULT_MAX_ERROR_RESPONSE_BYTES, readBoundedResponseText, responseByteLimit } from "./response-body.js";
export { SwarmResponseLimitError } from "./response-body.js";
import { ownResponseLifetime, streamTimeout } from "./response-lifetime.js";
import { responsePolicies, endpointResponsePolicy } from "./response-policy.js";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function normalizeBaseUrl(baseUrl, { allowInsecureTransport = false } = {}) {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("SwarmClient requires a non-empty baseUrl");
  }
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("SwarmClient baseUrl must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SwarmClient baseUrl must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new Error("SwarmClient URLs must not include credentials");
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))) {
    if (!allowInsecureTransport) {
      throw new Error("SwarmClient requires HTTPS unless the baseUrl is loopback/local. Pass allowInsecureTransport to override.");
    }
  }
  return parsed.toString();
}

export function pathSegment(value) {
  const segment = String(value);
  if (segment === "" || segment === "." || segment === "..") {
    throw new Error("SwarmClient requires a non-empty identifier, not a path traversal segment");
  }
  return encodeURIComponent(segment);
}

function appendQuery(searchParams, query) {
  if (!query) {
    return;
  }
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (item === undefined || item === null || item === "") {
          continue;
        }
        searchParams.append(key, String(item));
      }
      continue;
    }
    searchParams.set(key, String(rawValue));
  }
}

async function parseResponseBody(response, maxBytes, signal) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await readBoundedResponseText(response, maxBytes, signal);
  if (text === "") {
    return null;
  }
  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); }
    catch { throw new Error("Swarm response contains invalid JSON"); }
  }
  return text;
}

function withRequestAbort(operation, signal) {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw signal.reason;
      return operation();
    }).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

function cancelResponseBody(response, reason) {
  try {
    // A custom transport must not extend the deadline while cancelling its body.
    Promise.resolve(response?.body?.cancel(reason)).catch(() => {});
  } catch {
    // Native fetch aborts locked readers through its signal instead.
  }
}

function headersToObject(headers) {
  const values = {};
  for (const [key, value] of headers.entries()) {
    values[key] = value;
  }
  return values;
}

function normalizeRequestEffect(method, effect, idempotencyKey) {
  const normalizedMethod = String(method || "").toUpperCase();
  const defaultEffect = normalizedMethod === "GET" || normalizedMethod === "HEAD" ? "read" : "mutation";
  const normalizedEffect = effect === undefined ? defaultEffect : String(effect).trim().toLowerCase();
  if (normalizedEffect !== "read" && normalizedEffect !== "mutation") {
    throw new Error("SwarmClient request effect must be read or mutation");
  }
  if ((normalizedMethod === "GET" || normalizedMethod === "HEAD") && normalizedEffect !== "read") {
    throw new Error(`${normalizedMethod} requests cannot declare mutation effect`);
  }
  if (normalizedEffect === "read" && idempotencyKey) {
    throw new Error("Read requests cannot declare an idempotency key");
  }
  return normalizedEffect;
}

function collectionResult(response, data) {
  return {
    items: Array.isArray(data) ? data : [],
    nextCursor: response.headers.get("x-next-cursor"),
    order: response.headers.get("x-order"),
    headers: headersToObject(response.headers)
  };
}

export class SwarmAPIError extends Error {
  constructor(message, { status, body, headers } = {}) {
    super(message);
    this.name = "SwarmAPIError";
    this.status = status || 0;
    this.body = body ?? null;
    this.headers = headers || {};
  }
}

export class SwarmClientBase {
  constructor({
    baseUrl,
    token = "",
    fetch: fetchImpl = globalThis.fetch,
    headers = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    allowInsecureTransport = false,
    sseMaxEventBytes = DEFAULT_SSE_MAX_EVENT_BYTES,
    sseMaxBufferBytes = DEFAULT_SSE_MAX_BUFFER_BYTES,
    maxResponseBytes,
    maxErrorResponseBytes,
    responseByteLimits,
    streamIdleTimeoutMs,
    streamTotalTimeoutMs
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("SwarmClient requires a fetch implementation");
    }
    this.baseUrl = normalizeBaseUrl(baseUrl, { allowInsecureTransport });
    this.allowInsecureTransport = Boolean(allowInsecureTransport);
    this.token = token;
    this.fetch = fetchImpl;
    this.defaultHeaders = { ...headers };
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
    this.sseMaxEventBytes =
      Number.isFinite(sseMaxEventBytes) && sseMaxEventBytes > 0 ? sseMaxEventBytes : DEFAULT_SSE_MAX_EVENT_BYTES;
    this.sseMaxBufferBytes =
      Number.isFinite(sseMaxBufferBytes) && sseMaxBufferBytes > 0 ? sseMaxBufferBytes : DEFAULT_SSE_MAX_BUFFER_BYTES;
    this.maxResponseBytes = responseByteLimit(maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, "maxResponseBytes");
    this.maxErrorResponseBytes = responseByteLimit(maxErrorResponseBytes, DEFAULT_MAX_ERROR_RESPONSE_BYTES, "maxErrorResponseBytes");
    this.responseByteLimits = responsePolicies(responseByteLimits);
    this.streamIdleTimeoutMs = streamTimeout(streamIdleTimeoutMs, 0, "streamIdleTimeoutMs");
    this.streamTotalTimeoutMs = streamTimeout(streamTotalTimeoutMs, 0, "streamTotalTimeoutMs");
  }

  async request(method, path, { query, body, headers, idempotencyKey, idempotencyPolicy, effect, signal, accept = "application/json", raw = false,
    maxResponseBytes, maxErrorResponseBytes, streamIdleTimeoutMs, streamTotalTimeoutMs } = {}) {
    const idleTimeoutMs = streamTimeout(streamIdleTimeoutMs, this.streamIdleTimeoutMs, "streamIdleTimeoutMs");
    const totalTimeoutMs = streamTimeout(streamTotalTimeoutMs, this.streamTotalTimeoutMs, "streamTotalTimeoutMs");
    const url = new URL(path.replace(/^\//, ""), this.baseUrl);
    if (url.username || url.password) {
      throw new Error("SwarmClient URLs must not include credentials");
    }
    if (url.origin !== new URL(this.baseUrl).origin) {
      throw new Error("SwarmClient requests must stay on the configured server origin");
    }
    const prefix = new URL(this.baseUrl).pathname.replace(/\/$/, "");
    const operationPath = prefix && url.pathname.startsWith(prefix + "/") ? url.pathname.slice(prefix.length) : url.pathname;
    const policy = endpointResponsePolicy(this.responseByteLimits, method, operationPath);
    const successLimit = responseByteLimit(maxResponseBytes, policy?.maxResponseBytes ?? this.maxResponseBytes, "maxResponseBytes");
    const errorLimit = responseByteLimit(maxErrorResponseBytes, policy?.maxErrorResponseBytes ?? this.maxErrorResponseBytes, "maxErrorResponseBytes");
    appendQuery(url.searchParams, query);
    const requestEffect = normalizeRequestEffect(method, effect, idempotencyKey);

    const requestHeaders = new Headers(this.defaultHeaders);
    requestHeaders.set("Accept", accept);
    if (this.token) {
      requestHeaders.set("Authorization", `Bearer ${this.token}`);
    }
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined && value !== null) {
          requestHeaders.set(key, String(value));
        }
      }
    }
    if (body !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
    }
    if (requestEffect === "mutation") {
      if (idempotencyKey && idempotencyPolicy !== undefined) clientOperationKeyStrategy(method, operationPath, idempotencyPolicy);
      const key = idempotencyKey || defaultMutationIdempotencyKey(method, url.pathname + url.search, body, operationPath, idempotencyPolicy);
      if (key) requestHeaders.set("Idempotency-Key", key);
      else requestHeaders.delete("Idempotency-Key");
    }

    const timeoutSignal = createTimedAbortSignal(signal, this.timeoutMs, "Swarm request timed out");
    let response;
    let transferred = false;
    try {
      response = await withRequestAbort(async () => {
        const received = await this.fetch(url, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: "error",
          signal: timeoutSignal.signal
        });
        if (timeoutSignal.signal.aborted) {
          cancelResponseBody(received, timeoutSignal.signal.reason);
          throw timeoutSignal.signal.reason;
        }
        return received;
      }, timeoutSignal.signal);

      if (raw && response.ok) {
        timeoutSignal.stopTimeout();
        const owned = ownResponseLifetime(response, timeoutSignal, { idleTimeoutMs, totalTimeoutMs });
        transferred = true;
        return owned;
      }

      const data = await withRequestAbort(() => parseResponseBody(response, response.ok ? successLimit : errorLimit, timeoutSignal.signal), timeoutSignal.signal);
      if (!response.ok) {
        const detail =
          typeof data === "string"
            ? data
            : data && typeof data === "object" && "error" in data
              ? data.error
              : JSON.stringify(data);
        throw new SwarmAPIError(raw ? `${method} ${url.pathname} failed` : `${method} ${url.pathname} failed (${response.status}): ${sanitizeSensitiveText(detail)}`, {
          status: response.status,
          body: sanitizeSensitiveValue(data),
          headers: headersToObject(response.headers)
        });
      }

      return { data, response };
    } catch (error) {
      if (timeoutSignal.signal.aborted) {
        cancelResponseBody(response, timeoutSignal.signal.reason);
      }
      throw error;
    } finally {
      if (!transferred) timeoutSignal.cleanup();
    }
  }

  async list(path, query, options = {}) {
    const { data, response } = await this.request("GET", path, {
      ...options,
      query
    });
    return collectionResult(response, data);
  }

  async data(method, path, options = {}) {
    const { data } = await this.request(method, path, options);
    return data;
  }

  async get(path, options = {}) {
    return this.data("GET", path, options);
  }

  async post(path, body, options = {}) {
    return this.data("POST", path, {
      ...options,
      body
    });
  }

  async patch(path, body, options = {}) {
    return this.data("PATCH", path, {
      ...options,
      body
    });
  }
}
