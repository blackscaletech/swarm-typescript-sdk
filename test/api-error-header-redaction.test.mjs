import assert from "node:assert/strict";
import test from "node:test";
import { SwarmAPIError, SwarmClient } from "../src/index.js";

const key = "a".repeat(16), proof = "q".repeat(42) + "_", family = "b".repeat(32);
const proofs = [`swa_v2.${key}.${proof}`, `swc_v2.${key}.${proof}`, `swac_v2.${key}.${proof}`,
  `swr_ctf_${family}.17.v2.${key}.${proof}`];

for (const raw of [false, true]) {
  test(`PC3 ${raw ? "raw" : "buffered"} API errors redact proof headers but retain safe metadata`, async () => {
    for (const token of proofs) {
      const client = new SwarmClient({ baseUrl: "https://audit.invalid", token, fetch: async () =>
        Response.json({ error: token }, { status: 403, headers: {
          "x-debug-proof": token, "authorization": "Bearer " + token,
          "x-debug-secret": "API_KEY=synthetic-header-secret", "retry-after": "2", "x-request-id": "req_synthetic"
        } })
      });
      await assert.rejects(client.request("GET", "/v1/me", { raw }), error => {
        assert.ok(error instanceof SwarmAPIError);
        assert.equal(error.status, 403);
        assert.equal(JSON.stringify(error).includes(token), false);
        assert.equal(JSON.stringify(error).includes("synthetic-header-secret"), false);
        assert.equal(error.headers["x-debug-proof"], "[REDACTED_SECRET]");
        assert.equal(error.headers["retry-after"], "2");
        assert.equal(error.headers["content-type"], "application/json");
        assert.equal(error.headers["x-request-id"], "req_synthetic");
        return true;
      });
    }
  });
}

test("PC3 does not redact or otherwise alter successful response data/headers", async () => {
  for (const raw of [false, true]) {
    const token = proofs[0];
    const client = new SwarmClient({ baseUrl: "https://audit.invalid", fetch: async () =>
      Response.json({ connection_token: token }, { headers: { "x-debug-proof": token } })
    });
    const result = await client.request("GET", "/v1/me", { raw });
    const response = raw ? result : result.response;
    const data = raw ? await result.json() : result.data;
    assert.equal(data.connection_token, token);
    assert.equal(response.headers.get("x-debug-proof"), token);
  }
});
