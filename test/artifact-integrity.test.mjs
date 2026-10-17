import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { SwarmClient, SwarmArtifactIntegrityError, SwarmResponseLimitError } from "../src/index.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const content = body => ({ artifact_id: "art_test", body, sha256: hash(body), size_bytes: Buffer.byteLength(body), media_type: "text/plain" });

test("verified Artifact reads compare complete UTF8 bytes, ID, size and source revision", async () => {
  const source = content("Source: \u65e5\u672c\u8a9e\n\ud83d\udc4d");
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => Response.json(source) });
  assert.deepEqual(await client.getVerifiedArtifactContent("art_test", { expectedSha256: source.sha256 }), source);
  await assert.rejects(client.getVerifiedArtifactContent("art_test", { expectedSha256: hash("old revision") }), SwarmArtifactIntegrityError);
  await assert.rejects(client.getVerifiedArtifactContent("art_test", { maxArtifactBytes: 1 }), SwarmResponseLimitError);
});

test("corrupt Artifact metadata and changed bytes are never returned as verified", async () => {
  const source = content("Evidence");
  for (const bad of [{ ...source, body: "Modified" }, { ...source, size_bytes: 1 }, { ...source, artifact_id: "other" },
    { ...source, sha256: "invalid" }, { ...source, size_bytes: Infinity }, { ...source, size_bytes: -1 }]) {
    const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => Response.json(bad) });
    await assert.rejects(client.getVerifiedArtifactContent("art_test"), error => error instanceof SwarmArtifactIntegrityError && !error.message.includes("Evidence"));
  }
});

test("valid multi-megabyte content remains supported and caller abort stays authoritative", async () => {
  const source = content("x".repeat(2 * 1024 * 1024));
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async () => Response.json(source) });
  assert.equal((await client.getVerifiedArtifactContent("art_test")).sha256, source.sha256);
  const stop = new AbortController(), reason = new Error("caller stopped");
  stop.abort(reason);
  await assert.rejects(client.getVerifiedArtifactContent("art_test", { signal: stop.signal }), error => error === reason);
  await assert.rejects(client.getVerifiedArtifactContent("art_test", { expectedSha256: "invalid" }), TypeError);
});

test("Artifact IDs stay inside one route segment", async () => {
  let path;
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch: async url => { path = new URL(url).pathname; return Response.json({}); } });
  await client.getArtifactContent("a/1?other=#fragment");
  assert.equal(path, "/v1/artifacts/a%2F1%3Fother%3D%23fragment/content");
});
