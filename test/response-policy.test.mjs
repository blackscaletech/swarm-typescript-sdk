import assert from "node:assert/strict";
import test from "node:test";
import { SwarmClient, SwarmResponseLimitError } from "../src/index.js";

test("endpoint ceilings match canonical routes and explicit per-request limits win", async () => {
  for (const baseUrl of ["https://audit.example", "https://audit.example/api/"]) {
    const client = new SwarmClient({ baseUrl, maxResponseBytes: 1000,
      responseByteLimits: [{ method: "GET", path: "/v1/artifacts/{artifactId}/content", maxResponseBytes: 8 }],
      fetch: async () => new Response("ten bytes!") });
    await assert.rejects(client.getArtifactContent("art_test"), error => error instanceof SwarmResponseLimitError && error.maxBytes === 8);
    assert.equal(await client.getArtifactContent("art_test", { maxResponseBytes: 16 }), "ten bytes!");
    assert.equal(await client.get("/v1/spaces"), "ten bytes!");
  }
});

test("endpoint error ceiling remains bounded independently of success bodies", async () => {
  const client = new SwarmClient({ baseUrl: "https://audit.example",
    responseByteLimits: [{ method: "GET", path: "/v1/artifacts/{artifactId}/content", maxResponseBytes: 1000, maxErrorResponseBytes: 4 }],
    fetch: async () => new Response("private diagnostic", { status: 503 }) });
  await assert.rejects(client.getArtifactContent("art_test"), error => error instanceof SwarmResponseLimitError && error.status === 503 && error.maxBytes === 4 && !error.message.includes("private"));
});

test("invalid and ambiguous endpoint policies fail without sending a request", async () => {
  const fetch = () => assert.fail("invalid policy reached transport");
  for (const responseByteLimits of [null, {}, [{ method: "GET", path: "/v1/test" }], [{ method: "GET", path: "/v1/../test", maxResponseBytes: 1 }],
    [{ method: "GET", path: "/v1/{broken", maxResponseBytes: 1 }], [{ method: "GET", path: "/v1/test?key=1", maxResponseBytes: 1 }],
    [{ method: "GET", path: "/v1/test", maxResponseBytes: 0 }], [{ method: "GET", path: "/v1/{a}", maxResponseBytes: 1 }, { method: "GET", path: "/v1/{b}", maxResponseBytes: 1 }]]) {
    assert.throws(() => new SwarmClient({ baseUrl: "https://audit.example", responseByteLimits, fetch }));
  }
  const client = new SwarmClient({ baseUrl: "https://audit.example", fetch,
    responseByteLimits: [{ method: "GET", path: "/v1/{id}", maxResponseBytes: 1 }, { method: "GET", path: "/v1/test", maxResponseBytes: 1 }] });
  await assert.rejects(client.get("/v1/test"), /Ambiguous/);
});
