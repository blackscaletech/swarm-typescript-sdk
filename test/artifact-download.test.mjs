import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { SwarmClient, SwarmAPIError, SwarmArtifactIntegrityError, SwarmResponseLimitError } from "../src/index.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const source = new Uint8Array([0, 255, 195, 40, 10]);

function artifactHeaders(bytes, overrides = {}, artifactId = "art_test") {
  const digest = hash(bytes);
  return { "content-type": "application/octet-stream", "content-length": String(bytes.length),
    "x-swarm-artifact-id": artifactId, "x-swarm-content-id": `sha256:${digest}`,
    "x-swarm-content-sha256": digest, "x-swarm-content-length": String(bytes.length),
    etag: `"sha256:${digest}"`, "x-swarm-content-media-type": "application/pdf",
    "cache-control": "no-store, no-transform", ...overrides };
}

function fixture(bytes = source, overrides = {}, clientOptions = {}) {
  let request;
  const client = new SwarmClient({ baseUrl: "https://example.invalid/prefix/", token: "test-token", ...clientOptions,
    fetch: async (url, options) => { request = { url: String(url), options }; return new Response(bytes, { headers: artifactHeaders(bytes, overrides) }); }
  });
  return { client, request: () => request };
}

test("raw download verifies binary bytes and stays on the authenticated prefixed route", async () => {
  const { client, request } = fixture();
  const result = await client.downloadArtifact("art_test", { expectedSha256: hash(source).toUpperCase(), headers: { Accept: "application/json" } });
  assert.deepEqual(result, { artifact_id: "art_test", media_type: "application/pdf", sha256: hash(source), size_bytes: source.length, bytes: source });
  assert.equal(request().url, "https://example.invalid/prefix/v1/artifacts/art_test/content");
  assert.equal(request().options.method, "GET"); assert.equal(request().options.redirect, "error");
  assert.equal(request().options.headers.get("authorization"), "Bearer test-token");
  assert.equal(request().options.headers.get("accept"), "application/octet-stream");
  assert.equal(request().options.headers.get("accept-encoding"), "identity");
});

test("download metadata must be complete and internally consistent", async () => {
  for (const headers of [{ "content-type": "application/json" }, { "x-swarm-artifact-id": "another" },
    { "x-swarm-content-id": `sha256:${"0".repeat(64)}` }, { "x-swarm-content-sha256": hash(source).toUpperCase() },
    { etag: `W/"sha256:${hash(source)}"` }, { etag: "" }, { "content-encoding": "gzip" },
    { "cache-control": "" }, { "cache-control": "no-store" }, { "cache-control": "no-transform" },
    { "x-swarm-content-length": "-1" }, { "x-swarm-content-length": "01" }, { "x-swarm-content-length": "1.0" },
    { "x-swarm-content-length": "9007199254740992" }, { "x-swarm-content-length": "" },
    { "content-length": "4" }, { "content-length": "invalid" }]) {
    await assert.rejects(fixture(source, headers).client.downloadArtifact("art_test"), SwarmArtifactIntegrityError);
  }
  await assert.rejects(fixture().client.downloadArtifact("art_test", { expectedSha256: "0".repeat(64) }), SwarmArtifactIntegrityError);
});

test("missing identity headers reject before reading and cancel the body", async () => {
  for (const name of ["x-swarm-artifact-id", "x-swarm-content-id", "x-swarm-content-sha256", "x-swarm-content-length", "etag"]) {
    let reads = 0, cancelled = 0;
    const headers = new Headers(artifactHeaders(source)); headers.delete(name);
    const body = new ReadableStream({ pull() { reads++; }, cancel() { cancelled++; } }, { highWaterMark: 0 });
    const client = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async () => new Response(body, { headers }) });
    await assert.rejects(client.downloadArtifact("art_test"), SwarmArtifactIntegrityError);
    assert.equal(reads, 0); assert.equal(cancelled, 1);
  }
});

test("empty and multi-megabyte Artifacts verify without UTF8 decoding", async () => {
  for (const bytes of [new Uint8Array(), new Uint8Array(2 * 1024 * 1024).fill(255)]) {
    const result = await fixture(bytes).client.downloadArtifact("art_test");
    assert.equal(result.sha256, hash(bytes)); assert.deepEqual(result.bytes, bytes);
  }
});

test("EOF, oversize bytes and altered content cannot become verified", async () => {
  for (const body of [source.slice(0, -1), new Uint8Array([...source, 0]), new Uint8Array(source.length).fill(7)]) {
    const client = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async () => new Response(body, { headers: artifactHeaders(source) }) });
    await assert.rejects(client.downloadArtifact("art_test"), SwarmArtifactIntegrityError);
  }
});

test("wire, route and Artifact ceilings remain independently bounded", async () => {
  for (const options of [{ maxArtifactBytes: 4 }, { maxResponseBytes: 4 }]) {
    await assert.rejects(fixture().client.downloadArtifact("art_test", options), SwarmResponseLimitError);
  }
  const route = fixture(source, {}, { responseByteLimits: [{ method: "GET", path: "/v1/artifacts/{id}/content", maxResponseBytes: 4 }] });
  await assert.rejects(route.client.downloadArtifact("art_test"), SwarmResponseLimitError);
  await assert.rejects(route.client.downloadArtifact("art_test", { maxResponseBytes: 100 }), SwarmResponseLimitError);
  const raised = fixture(source, {}, { maxResponseBytes: 1, responseByteLimits: [{ method: "GET", path: "/v1/artifacts/{id}/content", maxResponseBytes: 100 }] });
  assert.equal((await raised.client.downloadArtifact("art_test")).size_bytes, 5);
  const oversized = fixture(source, { "x-swarm-content-length": String(64 * 1024 * 1024 + 1) });
  await assert.rejects(oversized.client.downloadArtifact("art_test", { maxArtifactBytes: 2 ** 30, maxResponseBytes: 2 ** 30 }), SwarmResponseLimitError);
});

test("invalid options, conditional requests and pre-abort never open transport", async () => {
  const { client, request } = fixture();
  for (const id of ["", ".", "..", null, 1]) await assert.rejects(client.downloadArtifact(id));
  for (const value of [0, -1, 1.5, true, 120001]) await assert.rejects(client.downloadArtifact("art_test", { downloadTimeoutMs: value }));
  for (const value of [0, -1, true, 1.5]) await assert.rejects(client.downloadArtifact("art_test", { maxArtifactBytes: value }));
  for (const header of ["Range", "If-Range", "If-Match", "If-None-Match", "If-Modified-Since", "If-Unmodified-Since"]) {
    await assert.rejects(client.downloadArtifact("art_test", { headers: { [header]: "test" } }));
  }
  await assert.rejects(client.downloadArtifact("art_test", { expectedSha256: "not a digest" }));
  const stop = new AbortController(), reason = new Error("caller stopped"); stop.abort(reason);
  await assert.rejects(client.downloadArtifact("art_test", { signal: stop.signal }), error => error === reason);
  assert.equal(request(), undefined);
});

test("total deadline and caller cancellation discard staging and close stream", async () => {
  for (const kind of ["deadline", "cancel"]) {
    let cancelled = 0;
    const body = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled++; } }, { highWaterMark: 0 });
    const client = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async () => new Response(body, { headers: artifactHeaders(source) }) });
    const stop = new AbortController(), reason = new Error("caller stopped");
    const timer = kind === "cancel" ? setTimeout(() => stop.abort(reason), 20) : undefined;
    await assert.rejects(client.downloadArtifact("art_test", { downloadTimeoutMs: kind === "deadline" ? 20 : 1000, signal: stop.signal }),
      error => kind === "deadline" ? /timed out/.test(error.message) : error === reason);
    clearTimeout(timer); assert.equal(cancelled, 1);
  }
});

test("API rejections retain bounded metadata without verification or retries", async () => {
  for (const status of [401, 403, 410, 429, 503]) {
    let calls = 0;
    const client = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async () => { calls++; return Response.json({ error: "Unavailable", content_id: "sha256:old" }, { status }); } });
    await assert.rejects(client.downloadArtifact("art_test"), error => error instanceof SwarmAPIError && error.status === status && error.body.content_id === "sha256:old");
    assert.equal(calls, 1);
  }
});

test("download never downgrades to JSON and leaves JSON reads intact", async () => {
  let accept;
  const client = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async (_url, options) => {
    accept = options.headers.get("accept"); return Response.json({ artifact_id: "art_test", body: "text", sha256: hash("text"), size_bytes: 4 });
  } });
  await assert.rejects(client.downloadArtifact("art_test"), SwarmArtifactIntegrityError);
  assert.equal(accept, "application/octet-stream");
  assert.equal((await client.getVerifiedArtifactContent("art_test")).body, "text"); assert.equal(accept, "application/json");
});

test("custom redirects and incomplete success responses still fail identity checks", async () => {
  const response = new Response(source, { headers: artifactHeaders(source) });
  Object.defineProperty(response, "redirected", { value: true });
  const client = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async () => response });
  await assert.rejects(client.downloadArtifact("art_test"), SwarmArtifactIntegrityError);
  const noBody = new SwarmClient({ baseUrl: "https://example.invalid", fetch: async () => new Response(null, { status: 204 }) });
  await assert.rejects(noBody.downloadArtifact("art_test"), SwarmArtifactIntegrityError);
});

test("raw and JSON requests retain defaults, configured token, explicit override precedence", async () => {
  const seen = [];
  const client = new SwarmClient({ baseUrl: "https://example.invalid", token: "current", headers: { Authorization: "Bearer stale", "X-Default": "kept" },
    fetch: async (_url, options) => {
      seen.push(options.headers.get("authorization"));
      assert.equal(options.headers.get("x-default"), "kept");
      return options.headers.get("accept") === "application/octet-stream"
        ? new Response(source, { headers: artifactHeaders(source) }) : Response.json({});
    }
  });
  await client.downloadArtifact("art_test");
  await client.getArtifactContent("art_test");
  await client.downloadArtifact("art_test", { headers: { Authorization: "Bearer explicit" } });
  assert.deepEqual(seen, ["Bearer current", "Bearer current", "Bearer explicit"]);
  const conditional = fixture(source, {}, { headers: { Range: "bytes=0-1" } });
  await assert.rejects(conditional.client.downloadArtifact("art_test"));
  assert.equal(conditional.request(), undefined);
});

test("client total-stream deadline is inherited, explicit override and download cap stay distinct", async () => {
  for (const [options, message] of [[{}, /stream total/], [{ streamTotalTimeoutMs: 20 }, /stream total/],
    [{ streamTotalTimeoutMs: 0, downloadTimeoutMs: 20 }, /Artifact download/]]) {
    let cancelled = 0;
    const body = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled++; } }, { highWaterMark: 0 });
    const client = new SwarmClient({ baseUrl: "https://example.invalid", streamTotalTimeoutMs: 10, streamIdleTimeoutMs: 1000,
      fetch: async () => new Response(body, { headers: artifactHeaders(source) }) });
    await assert.rejects(client.downloadArtifact("art_test", { downloadTimeoutMs: 200, ...options }), error => message.test(error.message));
    assert.equal(cancelled, 1);
  }
});
