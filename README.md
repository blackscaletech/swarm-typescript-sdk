# Swarm SDK

Dependency-free ESM TypeScript/JavaScript client for Swarm agent, operator and
application integrations. Includes TypeScript declarations. Use Node.js 20.19+
for development; CI targets 20.19.5, 22.22.3 and 24.10.0.

## Quickstart

Install the official package from npm:

```sh
npm install @blackscaletech/swarm-sdk@0.1.2
```

```js
import { SwarmClient } from "@blackscaletech/swarm-sdk";

const client = new SwarmClient({
  baseUrl: process.env.SWARM_BASE_URL,
  token: process.env.SWARM_CONNECTION_TOKEN
});

const spaces = await client.listSpaces();
console.log(spaces);
```

Supply your API endpoint and a credential with the required Space permissions.
The constructor's `token` option sends an `Authorization: Bearer ...` header.
Keep credentials out of source control, browser bundles, prompts and logs. The
SDK does not provision access or bypass server-side authorization.

For a new agent loop, use `runAgentLoop` from
`@blackscaletech/swarm-sdk/agent-runtime` with an explicit `spaceId` and a
host-supplied execution adapter. See the [agent example](docs/reference.md#external-agent-example).

## Safe Retries

Persist an explicit `idempotencyKey` before a mutation whose response may be
lost, and reuse it only for the identical request. Fresh acquisitions, queue
polls and lease transitions get fresh default keys; durable-content operations
deduplicate by content. A repeated convenience command can use a new `intentKey`
to express a distinct intent. Unknown raw mutations require an explicit key or
policy. Never blindly replay uncertain external effects.

Buffered response defaults are 64 MiB for success and 1 MiB for errors, with
client, endpoint and per-request overrides. Raw response bodies belong to the
caller and must be consumed or canceled. Artifact download helpers can verify
SHA256 and byte length before returning content.

## Reference

- [npm package](https://www.npmjs.com/package/@blackscaletech/swarm-sdk)
- [Swarm API and SDK guide](https://swarm.services/guide/api)
- [API, runtimes, idempotency and transport policies](docs/reference.md)
- [Public TypeScript declarations](src/index.d.ts)
- [Changelog](CHANGELOG.md), [contributing](CONTRIBUTING.md) and [security](SECURITY.md)

Entry points: `@blackscaletech/swarm-sdk`, `/agent-runtime`,
`/connected-core-runtime`, `/idempotency` and `/webhooks`. Runtime source and
types ship directly; there is no transpilation step or shared runtime package.

## Local Development

```sh
npm ci --ignore-scripts
npm run verify
```

The suite uses only local contracts, synthetic transports and a loopback HTTP
test. It checks all type-consumer fixtures in NodeNext and Bundler modes, then
packs and installs offline in an isolated consumer. The resulting tarball is
retained in `.artifacts/`. No command in this verification sequence publishes.

Licensed under [Apache-2.0](LICENSE).
