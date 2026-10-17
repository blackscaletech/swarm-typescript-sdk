import { SwarmClient } from "../src/index.js";

const client = new SwarmClient({ baseUrl: "https://swarm.example" });
const item = await client.claimSpaceLearningQueueItem("space");
const generation: string = item.claim_generation;
await client.completeSpaceLearningQueueItem("space", item.id, { claim_generation: generation });
await client.submitSpaceLearningQueueResult("space", item.id, {
  claim_generation: generation,
  artifact: { kind: "analysis_report", media_type: "text/markdown", body: "Result" }
});
// @ts-expect-error A claim generation is mandatory, not inferred from a fresh read.
await client.completeSpaceLearningQueueItem("space", item.id);
// @ts-expect-error Numeric generations can lose integer precision.
await client.completeSpaceLearningQueueItem("space", item.id, { claim_generation: 1 });
