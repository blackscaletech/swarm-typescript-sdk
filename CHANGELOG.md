# Changelog

## 0.1.2 - 2026-10-20

- Encode identifiers as individual path segments in typed endpoint helpers.
- Return `false` for malformed webhook signatures, including non-ASCII input.
- Redact sensitive API error response headers while retaining safe retry metadata.
- Add regression coverage without changing public types, contracts or retry keys.

## 0.1.1 - 2026-10-17

- Replace release-preparation wording with public npm installation guidance.
- Document the initial publication and tag-restricted trusted-publisher workflow.
- Preserve all runtime source, TypeScript declarations and public API behavior.

## 0.1.0 - 2026-10-17

- Release the standalone `@blackscaletech/swarm-sdk` package at version `0.1.0`.
- Preserve existing runtime APIs, types, idempotency recipes and response policies.
- Add local contract checks, complete type-consumer tests and isolated package tests.
- Ship the exact public contract fixture and approved repository metadata.
- Exercise README authentication against the installed package and transfer the
  verified release tarball between jobs with digest/ref/version checks.
