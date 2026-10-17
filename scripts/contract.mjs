import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CLIENT_OPERATION_POLICIES } from "../src/operation-policies.js";

export const contract = JSON.parse(readFileSync(new URL("../contracts/client-contract.json", import.meta.url), "utf8"));

export function validateContract() {
  assert.equal(contract.schemaVersion, "swarm.sdk-contract.v1");
  const groups = ["runRequirements", "scoringContract", "scoringDimension", "runContextRef", "launchRun"];
  assert.deepEqual(Object.keys(contract.fields).sort(), groups.sort());
  for (const [group, fields] of Object.entries(contract.fields)) {
    assert.ok(Array.isArray(fields) && fields.length > 0, `${group} requires a complete field list`);
    assert.ok(fields.every(field => typeof field === "string" && /^[a-z][a-z0-9_]*$/.test(field)), group);
    assert.equal(new Set(fields).size, fields.length, `${group} contains duplicate fields`);
  }
  assert.deepEqual(CLIENT_OPERATION_POLICIES, contract.operationPolicies, "Shipped operation policy rows differ from the local contract");
  const helpers = ["sensitive-text.js", "run-requirements.js", "operation-policy.js"];
  assert.deepEqual(Object.keys(contract.sharedModules).sort(), helpers.sort());
  for (const name of helpers) {
    assert.match(contract.sharedModules[name], /^[a-f0-9]{64}$/);
    const bytes = readFileSync(new URL(`../src/${name}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), contract.sharedModules[name], `${name} differs from its contracted shipped bytes`);
  }
  return contract;
}
