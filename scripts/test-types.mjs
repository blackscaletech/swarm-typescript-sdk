import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const tsc = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
const fixtures = readdirSync(new URL("../test/", import.meta.url)).filter(name => name.endsWith(".mts"));
if (!fixtures.length) throw new Error("No TypeScript consumer fixtures found");
for (const [module, moduleResolution] of [["NodeNext", "NodeNext"], ["ESNext", "Bundler"]]) {
  execFileSync(process.execPath, [tsc, "--project", "tsconfig.json", "--module", module, "--moduleResolution", moduleResolution], {
    cwd: root, stdio: "inherit"
  });
  console.log(`${moduleResolution}: checked all ${fixtures.length} TypeScript consumer fixtures`);
}
