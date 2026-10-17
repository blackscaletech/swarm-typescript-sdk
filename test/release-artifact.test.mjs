import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createReleaseMetadata, verifyReleaseMetadata, validateReleaseContext, validatePublishingNpm } from "../scripts/release-artifact.mjs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const context = {
  version: manifest.version,
  ref: `refs/tags/v${manifest.version}`,
  commit: "a".repeat(40),
  repository: "blackscaletech/swarm-typescript-sdk",
  runId: "12345",
  runAttempt: "1"
};
const bytes = Buffer.from("synthetic tested artifact bytes");

test("release metadata binds exact tested bytes to the approved package, version, ref and workflow run", () => {
  const metadata = createReleaseMetadata(manifest, bytes, context);
  assert.equal(metadata.filename, `blackscaletech-swarm-sdk-${manifest.version}.tgz`);
  assert.deepEqual(verifyReleaseMetadata(metadata, manifest, bytes, context, metadata.sha256), metadata);
  assert.throws(() => verifyReleaseMetadata(metadata, manifest, Buffer.from("repacked bytes"), context, metadata.sha256));
  assert.throws(() => verifyReleaseMetadata(metadata, manifest, bytes, context, "0".repeat(64)));
  assert.throws(() => verifyReleaseMetadata(metadata, manifest, bytes, context, undefined));
});

test("release verification rejects altered metadata, a different source ref/commit/run and wrong package identity", () => {
  const metadata = createReleaseMetadata(manifest, bytes, context);
  for (const change of [{ version: "9.9.9" }, { ref: "refs/heads/main" }, { commit: "b".repeat(40) },
    { runId: "54321" }, { runAttempt: "2" }, { filename: "../other.tgz" }, { sha256: "0".repeat(64) },
    { repository: "other/repository" }]) {
    assert.throws(() => verifyReleaseMetadata({ ...metadata, ...change }, manifest, bytes, context, metadata.sha256));
  }
  for (const change of [{ ref: "refs/heads/main" }, { commit: "b".repeat(40) }, { runId: "54321" }, { runAttempt: "2" }]) {
    assert.throws(() => verifyReleaseMetadata(metadata, manifest, bytes, { ...context, ...change }, metadata.sha256));
  }
  for (const change of [{ name: "@other/sdk" }, { version: "9.9.9" }, { repository: { type: "git", url: "git+https://github.com/other/sdk.git" } }]) {
    assert.throws(() => createReleaseMetadata({ ...manifest, ...change }, bytes, context));
  }
  assert.throws(() => validateReleaseContext({ ...context, version: "../0.1.0" }));
  assert.throws(() => validateReleaseContext({ ...context, repository: "other/repository" }));
});

test("trusted publishing accepts the pinned Node 24 bundled npm and rejects unsupported versions", () => {
  for (const version of ["11.5.1", "11.6.1", "12.0.0"]) validatePublishingNpm(version);
  for (const version of ["10.9.3", "11.4.9", "11.5.0", "11.5.1-beta.0"]) {
    assert.throws(() => validatePublishingNpm(version));
  }
});
