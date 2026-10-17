import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { contract, validateContract } from "../scripts/contract.mjs";

test("the complete local SDK contract matches shipped policies and helper hashes", () => {
  validateContract();
});

for (const name of ["sensitive-text", "run-requirements", "operation-policy"]) {
  test(`packaged ${name} module preserves its exact contracted bytes`, () => {
    const shipped = readFileSync(new URL(`../src/${name}.js`, import.meta.url));
    assert.equal(createHash("sha256").update(shipped).digest("hex"), contract.sharedModules[`${name}.js`]);
    assert.doesNotMatch(shipped.toString("utf8"), /from ["']\.\.\/\.\.\//);
  });
}
