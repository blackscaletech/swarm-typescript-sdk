import assert from "node:assert/strict";
import { contract as publicContract } from "../scripts/contract.mjs";
import test from "node:test";
import { SwarmClient, buildBootstrapCurrentUserEntityIdempotencyKey, buildLaunchRunIdempotencyKey } from "../src/index.js";
import { normalizeRunRequirements, normalizeRunContextRefs, normalizeScoringContract, normalizeLaunchRunInput } from "../src/input-normalizers.js";

const requirements = {
  execution_mode: "agent", assignment_mode: "specific", target_identity_ids: ["idn_target"], excluded_identity_ids: ["idn_excluded"],
  target_agent_ids: ["agt_target"], required_capabilities: ["repo.read"], required_tools: ["evidence.read"],
  required_models: ["model.example"], required_connectors: ["connector.example"], required_regions: ["region.example"],
  required_protocols: ["mcp"], required_hosting_mode: "connected", required_runtime_human_action_tags: ["human.review"],
  required_approval_actions: ["approve.launch"], result_approval_actions: ["approve.agent_result"]
};

function fixture() {
  const requests = [];
  return { requests, client: new SwarmClient({ baseUrl: "https://audit.example", fetch: async (url, init) => {
    requests.push({ path: new URL(url).pathname, body: JSON.parse(init.body), key: init.headers.get("idempotency-key") });
    return Response.json({});
  } }) };
}

test("normalizer covers every current canonical Run requirement and scoring field", () => {
  assert.deepEqual(Object.keys(requirements).sort(), [...publicContract.fields.runRequirements].sort(), "contract requirements changed; update clients without dropping constraints");
  assert.deepEqual(normalizeRunRequirements(requirements), requirements);
  const contract = { rubric_key: "review", version: 1, pass_threshold: 80, fail_threshold: 40, strict_mode: true,
    dimensions: [{ key: "evidence", weight_bps: 10000, min_required: 80 }], accepted_evaluation_method_keys: ["human_review"] };
  assert.deepEqual(Object.keys(contract).sort(), [...publicContract.fields.scoringContract].sort());
  assert.deepEqual(Object.keys(contract.dimensions[0]).sort(), [...publicContract.fields.scoringDimension].sort());
  assert.deepEqual(normalizeScoringContract(contract), contract);
  const ref = { resource_type: "artifact", resource_id: "art_source" };
  assert.deepEqual(Object.keys(ref).sort(), [...publicContract.fields.runContextRef].sort());
  assert.deepEqual(normalizeRunContextRefs([ref]), [ref]);
});

test("convenience prompt launch preserves every authority and execution constraint", async () => {
  const { client, requests } = fixture();
  await client.launchFromPrompt("sp_test", { title: "Review", run_requirements: requirements });
  assert.deepEqual(requests[0].body.run_requirements, requirements);
  const key = requests[0].key;
  for (const field of Object.keys(requirements)) {
    const changed = { ...requirements, [field]: Array.isArray(requirements[field]) ? [`different_${field}`] : field === "execution_mode" ? "core" : field === "assignment_mode" ? "others" : "hosted" };
    const input = { title: "Review", run_requirements: changed };
    if (field === "execution_mode" || field === "assignment_mode" || Array.isArray(requirements[field]) || field === "required_hosting_mode") {
      assert.notEqual(buildLaunchRunIdempotencyKey("sp_test", input), buildLaunchRunIdempotencyKey("sp_test", { title: "Review", run_requirements: requirements }), field);
    }
  }
  await client.launchFromPrompt("sp_test", { title: "Review", run_requirements: requirements });
  assert.equal(requests.at(-1).key, key);
  await client.launchFromPrompt("sp_test", { title: "Review", run_requirements: requirements }, { intentKey: "second-intent" });
  assert.notEqual(requests.at(-1).key, key);
  await client.launchFromPrompt("sp_test", { title: "Review", run_requirements: requirements }, { idempotencyKey: "explicit-old-retry" });
  assert.equal(requests.at(-1).key, "explicit-old-retry");
});

test("bootstrap retains accepted evaluation methods and includes Entity key in identity", async () => {
  const { client, requests } = fixture();
  const input = { key: "first", name: "Same label", space: { key: "project", name: "Project" },
    launch_template: { name: "Review", scoring_contract: { accepted_evaluation_method_keys: ["human_review"] } } };
  await client.bootstrapCurrentUserEntity(input);
  assert.deepEqual(requests[0].body.launch_template.scoring_contract.accepted_evaluation_method_keys, ["human_review"]);
  assert.notEqual(buildBootstrapCurrentUserEntityIdempotencyKey(input), buildBootstrapCurrentUserEntityIdempotencyKey({ ...input, key: "second" }));
  assert.notEqual(buildBootstrapCurrentUserEntityIdempotencyKey(input), buildBootstrapCurrentUserEntityIdempotencyKey({ ...input,
    launch_template: { ...input.launch_template, scoring_contract: { accepted_evaluation_method_keys: ["automated_review"] } } }));
});

test("unsupported or malformed authority constraints fail before transport", async () => {
  const { client, requests } = fixture();
  for (const value of [{ new_authority_constraint: true }, { target_identity_ids: "idn_target" }, { excluded_identity_ids: [null] },
    { required_approval_actions: [""] }, { execution_mode: "future" }, { assignment_mode: 1 }, []]) {
    await assert.rejects(client.launchFromPrompt("sp_test", { run_requirements: value }), TypeError);
  }
  await assert.rejects(client.bootstrapSpace("ent_test", { launch_template: { scoring_contract: { future_policy: true } } }), TypeError);
  for (const refs of [{}, "artifact", [{}], [{ resource_type: "future", resource_id: "resource" }], [{ resource_type: "artifact", resource_id: "a", role: "context" }]]) {
    await assert.rejects(client.launchFromPrompt("sp_test", { run_context_refs: refs }), TypeError);
  }
  for (const contract of [{ strict_mode: "false" }, { version: 1.5 }, { dimensions: "evidence" },
    { dimensions: [{ key: "evidence", weight_bps: 1, future_constraint: true }] }]) {
    await assert.rejects(client.bootstrapSpace("ent_test", { launch_template: { scoring_contract: contract } }), TypeError);
  }
  assert.equal(requests.length, 0);
});

test("canonical unset constraints are equivalent while uppercase execution enums remain invalid", async () => {
  const { client, requests } = fixture();
  for (const input of [{}, { run_requirements: null, run_context_refs: null },
    { run_requirements: { execution_mode: " ", assignment_mode: "", target_identity_ids: [], excluded_identity_ids: [] }, run_context_refs: [] }]) {
    await client.launchFromPrompt("sp_test", input);
  }
  assert.deepEqual(requests[1], requests[0]);
  assert.deepEqual(requests[2], requests[0]);
  for (const value of [{ execution_mode: "AGENT" }, { assignment_mode: "SELF" }, false, 1, "agent"]) {
    await assert.rejects(client.launchFromPrompt("sp_test", { run_requirements: value }), TypeError);
  }
  assert.equal(requests.length, 3);
});

test("raw supported launch route and convenience route retain the same explicit command", async () => {
  const { client, requests } = fixture();
  const input = { title: "Review", description: "Read the sources", run_requirements: requirements };
  await client.launchFromPrompt("sp_test", input, { idempotencyKey: "intent-1" });
  await client.post(requests[0].path, requests[0].body, { idempotencyKey: "intent-1" });
  assert.deepEqual(requests[1], requests[0]);
});

test("all canonical launch fields survive and model policy changes the operation identity", async () => {
  const input = {
    model_route_policy_id: "mrp_chosen", automation_profile_id: "aut_chosen", launch_template_id: "lt_chosen",
    title: "Review", description: "Read evidence", execution_policy_id: "exp_chosen",
    prompt_capture_mode: "compiled_only", prompt_visibility_mode: "private",
    acknowledge_public_raw_prompt_visibility: false, source_prompt: "User intent", compiled_brief: "Evidence first",
    run_requirements: requirements, run_context_refs: [{ resource_type: "artifact", resource_id: "art_source" }]
  };
  assert.deepEqual(Object.keys(input).sort(), [...publicContract.fields.launchRun].sort());
  assert.deepEqual(normalizeLaunchRunInput(input), input);
  const { client, requests } = fixture();
  await client.launchFromPrompt("sp_test", input);
  assert.deepEqual(requests[0].body, input);
  assert.notEqual(buildLaunchRunIdempotencyKey("sp_test", input), buildLaunchRunIdempotencyKey("sp_test", { ...input, model_route_policy_id: "mrp_other" }));
});
