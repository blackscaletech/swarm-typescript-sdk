import { SwarmClient } from "../src/index.js";
import { defaultMutationIdempotencyKey } from "../src/idempotency.js";

const client = new SwarmClient({ baseUrl: "https://local.invalid" });
void client.post("/v2/custom", { evidence: "same" }, { idempotencyPolicy: "durable-content" });
void client.data("POST", "/v2/custom", { body: {}, idempotencyPolicy: "fresh-attempt" });
void client.request("POST", "/v1/artifacts", { idempotencyKey: "old-exact-retry" });
const maybeKey: string | null = defaultMutationIdempotencyKey("POST", "/v1/chat/context-pack", {});
void maybeKey;
// @ts-expect-error Unsupported client key strategy must not become implicit authority.
void client.post("/v2/custom", {}, { idempotencyPolicy: "retry-everything" });
