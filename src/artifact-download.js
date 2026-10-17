import { pathSegment } from "./client-core.js";
import { artifactDigest, SwarmArtifactIntegrityError } from "./artifact-integrity.js";
import { createTimedAbortSignal } from "./event-stream.js";
import { responseByteLimit, SwarmResponseLimitError } from "./response-body.js";
import { endpointResponsePolicy } from "./response-policy.js";
import { awaitWithSignal } from "./response-lifetime.js";

const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_DOWNLOAD_TIMEOUT_MS = 120_000;

function downloadTimeout(value) {
  if (value === undefined) return MAX_DOWNLOAD_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_DOWNLOAD_TIMEOUT_MS) {
    throw new TypeError("downloadTimeoutMs must be an integer between 1 and 120000");
  }
  return value;
}

function decimalLength(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw new SwarmArtifactIntegrityError();
  const length = Number(value);
  if (!Number.isSafeInteger(length)) throw new SwarmArtifactIntegrityError();
  return length;
}

function downloadMetadata(response, artifactId, limit, expectedSha256) {
  const headers = response.headers;
  const sha256 = headers.get("x-swarm-content-sha256");
  const cacheControls = new Set((headers.get("cache-control") || "").toLowerCase().split(",").map(value => value.trim()));
  if (response.status !== 200 || response.redirected ||
      headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/octet-stream" ||
      headers.get("x-swarm-artifact-id") !== artifactId || !/^[a-f0-9]{64}$/.test(sha256 || "") ||
      headers.get("x-swarm-content-id") !== `sha256:${sha256}` ||
      headers.get("etag") !== `"sha256:${sha256}"` ||
      !cacheControls.has("no-store") || !cacheControls.has("no-transform") ||
      ![null, "identity"].includes(headers.get("content-encoding")) ||
      expectedSha256 && sha256 !== expectedSha256) {
    throw new SwarmArtifactIntegrityError();
  }
  const size = decimalLength(headers.get("x-swarm-content-length"));
  if (size > limit) throw new SwarmResponseLimitError(limit, response.status);
  const wireLength = headers.get("content-length");
  if (wireLength !== null && decimalLength(wireLength) !== size) throw new SwarmArtifactIntegrityError();
  return { artifact_id: artifactId, sha256, size_bytes: size, media_type: headers.get("x-swarm-content-media-type") };
}

function cancelBody(body, reason) {
  try { Promise.resolve(body?.cancel(reason)).catch(() => {}); } catch { /* Preserve the primary failure. */ }
}

async function stageBytes(response, metadata, signal) {
  const bytes = new Uint8Array(metadata.size_bytes);
  let offset = 0;
  let finished = false;
  if (!response.body) {
    if (bytes.byteLength !== 0) throw new SwarmArtifactIntegrityError();
    return bytes;
  }
  const reader = response.body.getReader();
  try {
    for (;;) {
      const chunk = await awaitWithSignal(() => reader.read(), signal);
      signal.throwIfAborted();
      if (chunk.done) { finished = true; break; }
      if (!(chunk.value instanceof Uint8Array) || offset + chunk.value.byteLength > bytes.byteLength) {
        throw new SwarmArtifactIntegrityError();
      }
      bytes.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
    if (offset !== bytes.byteLength) throw new SwarmArtifactIntegrityError();
    return bytes;
  } finally {
    if (!finished) cancelBody(reader, signal.reason);
    try { reader.releaseLock(); } catch { /* A cancelled custom reader can remain pending. */ }
  }
}

export async function downloadArtifact(client, artifactId, options = {}) {
  if (typeof artifactId !== "string") throw new TypeError("Artifact ID must be a non-empty string");
  const path = `/v1/artifacts/${pathSegment(artifactId)}/content`;
  const policy = endpointResponsePolicy(client.responseByteLimits, "GET", path);
  const wireCeiling = policy?.maxResponseBytes ?? client.maxResponseBytes;
  const wireLimit = Math.min(wireCeiling, responseByteLimit(options.maxResponseBytes, wireCeiling, "maxResponseBytes"));
  const limit = Math.min(MAX_ARTIFACT_BYTES, wireLimit, responseByteLimit(options.maxArtifactBytes, MAX_ARTIFACT_BYTES, "maxArtifactBytes"));
  const expectedSha256 = options.expectedSha256 === undefined ? undefined : artifactDigest(options.expectedSha256);
  const deadline = downloadTimeout(options.downloadTimeoutMs);
  const headers = new Headers();
  for (const [key, value] of Object.entries(options.headers || {})) {
    if (value !== undefined && value !== null) headers.set(key, String(value));
  }
  const mergedHeaders = new Headers(client.defaultHeaders);
  for (const [key, value] of headers) mergedHeaders.set(key, value);
  for (const name of ["range", "if-range", "if-match", "if-none-match", "if-modified-since", "if-unmodified-since"]) {
    if (mergedHeaders.has(name)) throw new TypeError("Verified Artifact downloads do not support range or conditional requests");
  }
  headers.set("Accept", "application/octet-stream");
  headers.set("Accept-Encoding", "identity");
  const scope = createTimedAbortSignal(options.signal, deadline, "Swarm Artifact download timed out");
  let response;
  try {
    scope.signal.throwIfAborted();
    response = await client.request("GET", path, {
      ...options, headers: Object.fromEntries(headers), accept: "application/octet-stream", raw: true,
      signal: scope.signal, streamTotalTimeoutMs: options.streamTotalTimeoutMs ?? (client.streamTotalTimeoutMs || deadline),
      streamIdleTimeoutMs: options.streamIdleTimeoutMs ?? (client.streamIdleTimeoutMs || client.timeoutMs)
    });
    const metadata = downloadMetadata(response, artifactId, limit, expectedSha256);
    const bytes = await stageBytes(response, metadata, scope.signal);
    const digest = await awaitWithSignal(() => globalThis.crypto.subtle.digest("SHA-256", bytes), scope.signal);
    const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
    if (actual !== metadata.sha256) throw new SwarmArtifactIntegrityError();
    scope.signal.throwIfAborted();
    return { ...metadata, bytes };
  } finally {
    cancelBody(response?.body, scope.signal.reason);
    scope.cleanup();
  }
}
