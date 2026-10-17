import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public quickstart names the current registry release without preparation claims", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(readme.includes(`npm install ${pkg.name}@${pkg.version}`));
  assert.ok(readme.includes("token: process.env.SWARM_CONNECTION_TOKEN"));
  assert.ok(readme.includes("https://www.npmjs.com/package/@blackscaletech/swarm-sdk"));
  assert.doesNotMatch(readme, /when available|does not announce a published release/);
});
