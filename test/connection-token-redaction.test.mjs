import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSensitiveText } from "../src/sensitive-text.js";

test("opaque connection proofs are redacted including trailing base64url punctuation", () => {
  const key = "a".repeat(16), family = "b".repeat(32);
  for (const end of ["x", "-", "_"]) {
    const proof = "q".repeat(42) + end;
    for (const token of [`swa_v2.${key}.${proof}`, `swc_v2.${key}.${proof}`, `swac_v2.${key}.${proof}`,
      `swr_ctf_${family}.17.v2.${key}.${proof}`, ...["swa_", "swc_", "swu_", "swur_"].map(prefix => prefix + proof),
      `swr_ctf_${family}.${proof}`]) {
      assert.equal(sanitizeSensitiveText(`Rejected proof ${token}.`), "Rejected proof [REDACTED_SECRET].");
    }
  }
  const publicId = `swc_client_reg_${family}`;
  assert.equal(sanitizeSensitiveText(publicId), publicId);
});
