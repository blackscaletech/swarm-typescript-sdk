import { SwarmClient, SwarmStreamError, type SwarmStreamOptions } from "../src/index.js";

const client = new SwarmClient({baseUrl: "https://swarm.example", sseMaxEventBytes: 1024});
const options: SwarmStreamOptions = {
  strict: true,
  lastEventId: "cursor",
  onStreamError(details) {
    const applied: string | null = details.last_event_id;
    const received: string | null = details.last_received_event_id;
    void [applied, received];
  }
};
try {
  await client.streamAuditEvents({}, async (_event, meta) => { void meta.id; }, options);
  await client.streamRuntimeHints("agent", async (_event, meta) => { void meta.event; }, options);
} catch (error) {
  if (error instanceof SwarmStreamError) {
    const cursor: string | null = error.lastEventId;
    void cursor;
  }
}
