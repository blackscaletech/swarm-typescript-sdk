import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repository = "blackscaletech/swarm-typescript-sdk";
const packageName = "@blackscaletech/swarm-sdk";

export function validateReleaseContext(context) {
  assert.equal(context.repository, repository);
  assert.match(context.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
  assert.equal(context.ref, `refs/tags/v${context.version}`);
  assert.match(context.commit, /^[a-f0-9]{40}$/);
  assert.match(context.runId, /^\d+$/);
  assert.match(context.runAttempt, /^[1-9]\d*$/);
  return `blackscaletech-swarm-sdk-${context.version}.tgz`;
}

export function createReleaseMetadata(manifest, bytes, context) {
  const filename = validateReleaseContext(context);
  assert.equal(manifest.name, packageName);
  assert.equal(manifest.version, context.version);
  assert.equal(manifest.repository?.type, "git");
  assert.equal(manifest.repository?.url, `git+https://github.com/${repository}.git`);
  assert.equal(manifest.homepage, `https://github.com/${repository}#readme`);
  assert.equal(manifest.bugs?.url, `https://github.com/${repository}/issues`);
  return {
    schemaVersion: "swarm.sdk-release.v1",
    package: packageName,
    ...context,
    filename,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

export function verifyReleaseMetadata(metadata, manifest, bytes, context, expectedSha256) {
  assert.match(expectedSha256, /^[a-f0-9]{64}$/, "A digest from the verify job is required");
  const expected = createReleaseMetadata(manifest, bytes, context);
  assert.equal(expected.sha256, expectedSha256, "Downloaded tarball differs from the tested artifact");
  assert.deepEqual(metadata, expected, "Release metadata does not match this version/ref/commit/run and artifact");
  return expected;
}

export function validatePublishingNpm(version) {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const [major, minor, patch] = version.split(".").map(Number);
  assert.ok(major > 11 || major === 11 && (minor > 5 || minor === 5 && patch >= 1), "Trusted publishing requires npm >=11.5.1");
}

function main() {
  const [mode, directory = ".artifacts"] = process.argv.slice(2);
  if (mode === "check-npm") {
    const version = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
    validatePublishingNpm(version);
    console.log(`Trusted-publishing npm version: ${version}`);
    return;
  }
  assert.ok(mode === "create" || mode === "verify", "Use create, verify or check-npm");
  const context = {
    version: process.env.RELEASE_VERSION,
    ref: process.env.GITHUB_REF,
    commit: process.env.GITHUB_SHA,
    repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT
  };
  const filename = validateReleaseContext(context);
  const tarball = join(directory, filename);
  const bytes = readFileSync(tarball);
  if (mode === "verify") {
    assert.match(process.env.EXPECTED_SHA256, /^[a-f0-9]{64}$/);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), process.env.EXPECTED_SHA256, "Tarball digest differs from the verify job output");
  }
  const manifest = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
  const metadataPath = join(directory, "release-metadata.json");
  const metadata = mode === "create"
    ? createReleaseMetadata(manifest, bytes, context)
    : verifyReleaseMetadata(JSON.parse(readFileSync(metadataPath, "utf8")), manifest, bytes, context, process.env.EXPECTED_SHA256);
  if (mode === "create") writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `filename=${metadata.filename}\nsha256=${metadata.sha256}\n`);
  console.log(JSON.stringify(metadata));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
