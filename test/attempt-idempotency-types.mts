import { SwarmClient } from "../src/index.js";
import { defaultMutationIdempotencyKey } from "../src/idempotency.js";

const key = defaultMutationIdempotencyKey("POST", "/api/v1/runs/run/acquire", {}, "/v1/runs/run/acquire");
if (key === null) throw new Error("Acquisition requires an operation key");
const client = new SwarmClient({ baseUrl: "https://swarm.example/api/" });
await client.claimSpaceLearningQueueItem("space", {}, { idempotencyKey: key });
