import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { computeWebhookSignature, verifyWebhookSignature } from "../src/index.js";

const secret = "synthetic-signing-secret";
const body = '{"message":"\u00e9"}';
const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

test("PC2 malformed webhook signature inputs return false without throwing", () => {
  for (const malformed of [undefined, null, 42, {}, "", " ", "sha256=", "sha256=" + "0".repeat(63),
    "sha256=" + "0".repeat(65), "sha256=" + "g".repeat(64), "sha256=" + "A".repeat(64),
    "SHA256=" + "0".repeat(64), "sha256=" + "\u00e9".repeat(64), "sha256=" + "\u00e9".repeat(32),
    "sha256=" + "\ud83d\udca5".repeat(32), "sha256=" + "0".repeat(63) + "\0"]) {
    assert.equal(verifyWebhookSignature({ secret, body, signature: malformed }), false, JSON.stringify(malformed));
  }
});

test("PC2 valid signatures, whitespace and byte-payload support are preserved", () => {
  const bytes = new TextEncoder().encode(body);
  for (const payload of [body, bytes, bytes.buffer]) {
    assert.equal(computeWebhookSignature(secret, payload), signature);
    assert.equal(verifyWebhookSignature({ secret, body: payload, signature }), true);
    assert.equal(verifyWebhookSignature({ secret, body: payload, signature: " \t" + signature + "\r\n" }), true);
  }
});

test("PC2 wrong digests, changed bodies and unsupported versions remain invalid", () => {
  assert.equal(verifyWebhookSignature({ secret, body, signature: "sha256=" + "0".repeat(64) }), false);
  assert.equal(verifyWebhookSignature({ secret, body: body + " ", signature }), false);
  for (const signatureVersion of ["v2", "", null]) {
    assert.equal(verifyWebhookSignature({ secret, body, signature, signatureVersion }), false);
  }
});

test("PC2 valid-format signatures still surface signing-secret configuration errors", () => {
  assert.throws(() => verifyWebhookSignature({ secret: "", body, signature }), /non-empty signing secret/);
});
