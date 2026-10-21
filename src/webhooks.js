import { createHmac, timingSafeEqual } from "node:crypto";

function normalizeWebhookPayloadBytes(body) {
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }
  throw new Error("Swarm webhook body must be a string, Uint8Array, or ArrayBuffer");
}

function readHeaderValue(headers, name) {
  if (!headers) {
    return "";
  }
  if (headers instanceof Headers) {
    return headers.get(name) || "";
  }
  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(name.toLowerCase()) || "";
  }
  if (typeof headers === "object") {
    const direct = headers[name];
    if (direct !== undefined && direct !== null) {
      return String(direct);
    }
    const lower = headers[name.toLowerCase()];
    if (lower !== undefined && lower !== null) {
      return String(lower);
    }
  }
  return "";
}

export function computeWebhookSignature(secret, body) {
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new Error("computeWebhookSignature requires a non-empty signing secret");
  }
  const payload = normalizeWebhookPayloadBytes(body);
  return `sha256=${createHmac("sha256", Buffer.from(secret, "utf8")).update(payload).digest("hex")}`;
}

export function verifyWebhookSignature({ secret, body, signature, signatureVersion = "v1" } = {}) {
  if (signatureVersion !== "v1") {
    return false;
  }
  if (typeof signature !== "string") {
    return false;
  }
  const received = signature.trim();
  if (!/^sha256=[0-9a-f]{64}$/.test(received)) {
    return false;
  }
  const expected = computeWebhookSignature(secret, body);
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

export function parseWebhookHeaders(headers) {
  const eventSequence = readHeaderValue(headers, "X-Swarm-Event-Sequence");
  const parsedSequence = Number.parseInt(eventSequence, 10);
  return {
    deliveryId: readHeaderValue(headers, "X-Swarm-Delivery-ID"),
    auditEventId: readHeaderValue(headers, "X-Swarm-Audit-Event-ID"),
    eventAction: readHeaderValue(headers, "X-Swarm-Event-Action"),
    eventSequence: Number.isFinite(parsedSequence) ? parsedSequence : null,
    signature: readHeaderValue(headers, "X-Swarm-Signature"),
    signatureVersion: readHeaderValue(headers, "X-Swarm-Signature-Version")
  };
}
