import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(packageDir, ".artifacts");
mkdirSync(artifacts, { recursive: true });
const work = mkdtempSync(join(artifacts, "packaged-test-"));
const consumer = join(work, "consumer");
const env = { PATH: process.env.PATH, HOME: work, USERPROFILE: work,
  TMPDIR: work, TEMP: work, TMP: work,
  npm_config_cache: join(work, "cache"), npm_config_userconfig: join(work, "user.npmrc"),
  npm_config_globalconfig: join(work, "global.npmrc") };
for (const key of ["SYSTEMROOT", "SystemRoot", "COMSPEC", "ComSpec", "PATHEXT"]) {
  if (process.env[key]) env[key] = process.env[key];
}
const run = (command, args, cwd) => execFileSync(command, args, { cwd, env, encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] });
const npm = (args, cwd) => process.env.npm_execpath
  ? run(process.execPath, [process.env.npm_execpath, ...args], cwd)
  : run("npm", args, cwd);
try {
  writeFileSync(env.npm_config_userconfig, "");
  writeFileSync(env.npm_config_globalconfig, "");
  const [pack] = JSON.parse(npm(["pack", packageDir, "--offline", "--json", "--pack-destination", artifacts], work));
  const publicDocs = ["README.md", "LICENSE", "CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md", "docs/reference.md"];
  const contractPath = "contracts/client-contract.json";
  assert.ok(pack.files.every(file => file.path.startsWith("src/") || ["package.json", contractPath, ...publicDocs].includes(file.path)), "Unexpected private/test/build files in SDK artifact");
  for (const path of [...publicDocs, contractPath]) assert.ok(pack.files.some(file => file.path === path), `Missing public file: ${path}`);
  const tarball = join(artifacts, pack.filename);
  const contractBytes = readFileSync(join(packageDir, contractPath));
  const packedContract = execFileSync("tar", ["-xOf", tarball, `package/${contractPath}`]);
  assert.deepEqual(packedContract, contractBytes, "Tarball contract must preserve exact fixture bytes");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "swarm-isolated-sdk-consumer", private: true, type: "module" }));
  npm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", tarball], consumer);
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json")));
  const installedRoot = join(consumer, "node_modules", manifest.name);
  assert.deepEqual(readFileSync(join(installedRoot, contractPath)), contractBytes, "Installed contract must preserve exact fixture bytes");
  const installedManifest = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  assert.equal(installedManifest.repository.url, "git+https://github.com/blackscaletech/swarm-typescript-sdk.git");
  assert.equal(installedManifest.homepage, "https://github.com/blackscaletech/swarm-typescript-sdk#readme");
  assert.equal(installedManifest.bugs.url, "https://github.com/blackscaletech/swarm-typescript-sdk/issues");
  const quickstart = readFileSync(join(installedRoot, "README.md"), "utf8").match(/```js\n([\s\S]*?)\n```/)?.[1];
  assert.ok(quickstart, "The README quickstart must contain runnable JavaScript");
  writeFileSync(join(consumer, "quickstart.mjs"), `
    import assert from 'node:assert/strict';
    process.env.SWARM_BASE_URL = 'https://quickstart.example';
    process.env.SWARM_CONNECTION_TOKEN = 'synthetic_quickstart_credential';
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), 'https://quickstart.example/v1/spaces');
      assert.equal(init.headers.get('authorization'), 'Bearer synthetic_quickstart_credential');
      return Response.json([{ id: 'sp_quickstart' }]);
    };
    ${quickstart}
    assert.equal(calls, 1);
    assert.deepEqual(spaces.items, [{ id: 'sp_quickstart' }]);
    assert.equal(spaces.nextCursor, null);
  `);
  run(process.execPath, ["quickstart.mjs"], consumer);
  const modules = Object.keys(manifest.exports).map(key => key === "." ? manifest.name : manifest.name + key.slice(1));
  const smoke = `
    import assert from 'node:assert/strict';
    import { SwarmClient, SwarmResponseLimitError, SwarmArtifactIntegrityError } from '@blackscaletech/swarm-sdk';
    for (const name of ${JSON.stringify(modules)}) assert.ok(Object.keys(await import(name)).length);
    const client = new SwarmClient({ baseUrl: 'https://audit.example', fetch: async () => Response.json({ error: 'API_KEY=synthetic_package_secret_123456789' }, { status: 403 }) });
    await assert.rejects(client.listSpaces(), error => error.status === 403 && !error.message.includes('synthetic_package_secret') && error.message.includes('REDACTED'));
    const body = 'Installed source evidence';
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))), value => value.toString(16).padStart(2, '0')).join('');
    const verified = new SwarmClient({ baseUrl: 'https://audit.example', responseByteLimits: [{ method: 'GET', path: '/v1/artifacts/{id}/content', maxResponseBytes: 1024 }],
      fetch: async () => Response.json({ artifact_id: 'art_installed', body, sha256, size_bytes: new TextEncoder().encode(body).length, media_type: 'text/plain' }) });
    assert.equal((await verified.getVerifiedArtifactContent('art_installed', { expectedSha256: sha256 })).body, body);
    await assert.rejects(verified.getVerifiedArtifactContent('art_installed', { expectedSha256: '0'.repeat(64) }), SwarmArtifactIntegrityError);
    const bytes = new Uint8Array([0, 255, 195, 40]);
    const binaryHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    const download = new SwarmClient({ baseUrl: 'https://audit.example', fetch: async (_, init) => {
      assert.equal(init.headers.get('accept'), 'application/octet-stream');
      return new Response(bytes, { headers: {
        'content-type': 'application/octet-stream', 'content-length': String(bytes.length),
        'x-swarm-artifact-id': 'art_binary', 'x-swarm-content-id': 'sha256:' + binaryHash,
        'x-swarm-content-sha256': binaryHash, 'x-swarm-content-length': String(bytes.length),
        etag: '"sha256:' + binaryHash + '"', 'cache-control': 'no-store, no-transform'
      } });
    } });
    assert.deepEqual((await download.downloadArtifact('art_binary', { expectedSha256: binaryHash })).bytes, bytes);
    await assert.rejects(download.downloadArtifact('art_binary', { expectedSha256: '0'.repeat(64) }), SwarmArtifactIntegrityError);
    let launch;
    const authority = new SwarmClient({ baseUrl: 'https://audit.example', fetch: async (_, init) => {
      launch = JSON.parse(init.body); return Response.json({});
    } });
    await authority.launchFromPrompt('sp_installed', { title: 'Review', run_requirements: {
      execution_mode: 'agent', assignment_mode: 'others', target_identity_ids: ['idn_Target'], excluded_identity_ids: ['idn_Excluded'],
      required_approval_actions: ['approve.launch'], result_approval_actions: ['approve.agent_result']
    }, run_context_refs: [{ resource_type: 'artifact', resource_id: 'art_Source' }] });
    assert.equal(launch.run_requirements.execution_mode, 'agent');
    assert.equal(launch.run_requirements.assignment_mode, 'others');
    assert.deepEqual(launch.run_requirements.target_identity_ids, ['idn_Target']);
    assert.deepEqual(launch.run_requirements.excluded_identity_ids, ['idn_Excluded']);
    assert.deepEqual(launch.run_requirements.required_approval_actions, ['approve.launch']);
    assert.deepEqual(launch.run_context_refs, [{ resource_type: 'artifact', resource_id: 'art_Source' }]);
    await assert.rejects(authority.launchFromPrompt('sp_installed', { run_requirements: { unknown_authority: true } }), TypeError);
  `;
  writeFileSync(join(consumer, "smoke.mjs"), smoke);
  run(process.execPath, ["smoke.mjs"], consumer);
  writeFileSync(join(consumer, "types.mts"), `
    import { SwarmClient, SwarmResponseLimitError, SwarmArtifactIntegrityError, type VerifiedArtifactDownload } from '@blackscaletech/swarm-sdk';
    import { runAgentOnce } from '@blackscaletech/swarm-sdk/agent-runtime';
    import { runConnectedCoreOnce } from '@blackscaletech/swarm-sdk/connected-core-runtime';
    import * as idempotency from '@blackscaletech/swarm-sdk/idempotency';
    import * as webhooks from '@blackscaletech/swarm-sdk/webhooks';
    const client = new SwarmClient({ baseUrl: 'https://audit.example', maxResponseBytes: 1024,
      responseByteLimits: [{ method: 'GET', path: '/v1/artifacts/{id}/content', maxResponseBytes: 1024 }] });
    const verified = client.getVerifiedArtifactContent('art_installed', { expectedSha256: '0'.repeat(64), maxArtifactBytes: 1024 });
    const download: Promise<VerifiedArtifactDownload> = client.downloadArtifact('art_installed', { expectedSha256: '0'.repeat(64), maxArtifactBytes: 1024 });
    download.then(result => {
      new Blob([result.bytes]);
      void crypto.subtle.digest('SHA-256', result.bytes);
    });
    const integrityCode: 'artifact_integrity_failed' = new SwarmArtifactIntegrityError().code;
    const limit: number = new SwarmResponseLimitError(1024, 200).maxBytes;
    void [client, verified, download, integrityCode, limit, runAgentOnce, runConnectedCoreOnce, idempotency, webhooks];
  `);
  const fixtures = readdirSync(join(packageDir, "test")).filter(name => name.endsWith(".mts")).sort();
  assert.ok(fixtures.length > 0, "Every type consumer fixture must be checked against the installed package");
  for (const name of fixtures) {
    const fixture = readFileSync(join(packageDir, "test", name), "utf8").replace(/(["'])\.\.\/src\/([^"']+)\.js\1/g, (_, quote, entry) => {
      const subpath = entry === "index" ? "." : `./${entry}`;
      assert.ok(Object.hasOwn(manifest.exports, subpath), `Fixture ${name} uses a non-public entry: ${entry}`);
      return quote + (entry === "index" ? manifest.name : `${manifest.name}/${entry}`) + quote;
    });
    writeFileSync(join(consumer, name), fixture);
  }
  const tsc = resolve(packageDir, "node_modules/typescript/bin/tsc");
  assert.equal(JSON.parse(readFileSync(resolve(packageDir, "node_modules/typescript/package.json"))).version, "6.0.3");
  const config = JSON.parse(readFileSync(join(packageDir, "tsconfig.json"), "utf8"));
  config.include = ["*.mts"];
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify(config));
  for (const [module, resolution] of [["NodeNext", "NodeNext"], ["ESNext", "Bundler"]]) {
    run(process.execPath, [tsc, "--project", "tsconfig.json", "--module", module, "--moduleResolution", resolution], consumer);
  }
  console.log(JSON.stringify({ package: manifest.name, version: manifest.version, files: pack.files.length,
    sha256: createHash("sha256").update(readFileSync(tarball)).digest("hex"), exports: modules,
    runtime: "passed", types: ["NodeNext", "Bundler"], type_fixtures: fixtures,
    tarball, contract_sha256: createHash("sha256").update(contractBytes).digest("hex"),
    readme_quickstart_auth: "passed", network: "offline", consumer_has_monorepo_siblings: false }));
} finally {
  rmSync(work, { recursive: true, force: true });
}
