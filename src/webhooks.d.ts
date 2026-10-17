export function computeWebhookSignature(secret: string, body: string | Uint8Array | ArrayBuffer): string;

export function verifyWebhookSignature(input: {
  secret: string;
  body: string | Uint8Array | ArrayBuffer;
  signature: string;
  signatureVersion?: string;
}): boolean;

export interface SwarmWebhookHeaders {
  deliveryId: string;
  auditEventId: string;
  eventAction: string;
  eventSequence: number | null;
  signature: string;
  signatureVersion: string;
}

export function parseWebhookHeaders(
  headers: Headers | Map<string, string> | Record<string, string>
): SwarmWebhookHeaders;
