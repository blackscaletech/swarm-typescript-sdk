export const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
export const DEFAULT_MAX_ERROR_RESPONSE_BYTES = 1024 * 1024;

export class SwarmResponseLimitError extends Error {
  constructor(maxBytes, status) {
    super(`Swarm response exceeds the ${maxBytes}-byte limit`);
    this.name = "SwarmResponseLimitError";
    this.code = "response_too_large";
    this.maxBytes = maxBytes;
    this.status = status;
  }
}

export function responseByteLimit(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer`);
  return value;
}

function abandon(body, reason) {
  try { Promise.resolve(body.cancel(reason)).catch(() => {}); } catch { /* Keep the primary failure. */ }
}

export async function readBoundedResponseText(response, maxBytes, signal) {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    const error = new SwarmResponseLimitError(maxBytes, response.status);
    if (response.body) abandon(response.body, error);
    throw error;
  }
  if (!response.body?.getReader) {
    // Custom transports without a reader own allocation; still validate bytes.
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new SwarmResponseLimitError(maxBytes, response.status);
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts = [];
  let pending = "";
  let bytes = 0;
  let finished = false;
  const onAbort = () => abandon(reader, signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) { finished = true; break; }
      if (!(chunk.value instanceof Uint8Array)) throw new TypeError("Swarm response stream must contain bytes");
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new SwarmResponseLimitError(maxBytes, response.status);
      pending += decoder.decode(chunk.value, { stream: true });
      // Tiny transport chunks must not create one retained array entry per byte.
      if (pending.length >= 64 * 1024) { parts.push(pending); pending = ""; }
    }
    parts.push(pending + decoder.decode());
    return parts.join("");
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (!finished) abandon(reader, signal.reason);
    reader.releaseLock();
  }
}
