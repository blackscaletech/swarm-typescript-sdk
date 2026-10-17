import { responseByteLimit, DEFAULT_MAX_RESPONSE_BYTES, SwarmResponseLimitError } from "./response-body.js";
import { awaitWithSignal } from "./response-lifetime.js";

export class SwarmArtifactIntegrityError extends Error {
  constructor() {
    super("Swarm Artifact content does not match its declared identity");
    this.name = "SwarmArtifactIntegrityError";
    this.code = "artifact_integrity_failed";
  }
}

export function artifactDigest(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError("Artifact SHA256 must be a 64-character hex digest");
  return value.toLowerCase();
}

export async function verifyArtifactContent(content, artifactId, { signal, expectedSha256, maxArtifactBytes } = {}) {
  signal?.throwIfAborted();
  const limit = responseByteLimit(maxArtifactBytes, DEFAULT_MAX_RESPONSE_BYTES, "maxArtifactBytes");
  if (!content || content.artifact_id !== artifactId || typeof content.body !== "string" ||
      typeof content.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(content.sha256) ||
      !Number.isSafeInteger(content.size_bytes) || content.size_bytes < 0) {
    throw new SwarmArtifactIntegrityError();
  }
  if (content.size_bytes > limit) throw new SwarmResponseLimitError(limit, 200);
  const bytes = new TextEncoder().encode(content.body);
  if (bytes.byteLength > limit) throw new SwarmResponseLimitError(limit, 200);
  if (bytes.byteLength !== content.size_bytes) throw new SwarmArtifactIntegrityError();
  const digest = await awaitWithSignal(() => globalThis.crypto.subtle.digest("SHA-256", bytes), signal);
  const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  if (actual !== content.sha256.toLowerCase() || expectedSha256 && actual !== artifactDigest(expectedSha256)) {
    throw new SwarmArtifactIntegrityError();
  }
  signal?.throwIfAborted();
  return content;
}
