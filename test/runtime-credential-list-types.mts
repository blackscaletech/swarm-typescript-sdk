import { SwarmClient, type CollectionPage, type RuntimeCredential } from "../src/index.js";

const client = new SwarmClient({ baseUrl: "https://swarm.example" });
const page: Promise<CollectionPage<RuntimeCredential>> = client.listAgentRuntimeCredentials("agt_test", {
  active_only: true, limit: 100, cursor: "continuation", order: "asc"
}, { signal: new AbortController().signal });
void page;
