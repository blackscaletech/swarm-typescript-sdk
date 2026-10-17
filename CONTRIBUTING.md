# Contributing

## Maintainer Commit Identity

For Blackscale maintainer work, configure each new checkout explicitly rather
than inheriting an unrelated machine-wide Git identity:

```sh
git config --local user.name Blackscale
git config --local user.email hello@blackscale.tech
git config --local core.hooksPath .githooks
sh scripts/check-attribution.sh identity
```

The hooks and CI reject the known unrelated inherited identity in authors,
committers and co-author trailers. Required attribution CI protects the default
branch. Genuine outside contributors retain their own identity.
Never retarget published release tags to repair display attribution; those tags
anchor registry provenance.

Use Node.js 20.19 or newer and npm. CI pins its Node 20 baseline to 20.19.5.
Install the pinned development dependency, then
run the complete verification suite:

```sh
npm ci --ignore-scripts
npm run verify
```

After dependencies are cached, `npm ci --offline --ignore-scripts` and the whole
verification suite work without registry access. Tests use synthetic transports
and one loopback HTTP server; they never require an API server or other checkout.
`npm test` checks every `.mts` consumer fixture under both NodeNext and Bundler
resolution. `test:packaged` checks those same fixtures against an offline tarball
installation and retains the tarball in `.artifacts/`.

Keep changes small and include regression tests. Preserve public methods/types,
response ownership and size policies, redaction, exact retry keys and idempotency
recipes. Never add live credentials, private infrastructure or runtime settings.

## Contract Inputs

`contracts/client-contract.json` is the versioned, public-safe compatibility
fixture. It contains complete JSON field lists, operation policy rows and SHA256
digests of the three shipped shared helpers, including their original comments.
`build:shared` and `check:shared` validate these local inputs without rewriting
source. No sibling repository, shared npm package or API source is required.
Contract updates and changed helpers must be reviewed together; do not refresh a
digest just to silence a failure. Declaration changes must pass every type test.

## Manual Releases

Releases are not triggered by pushes or tags. Package metadata targets
`blackscaletech/swarm-typescript-sdk`. The npm trusted publisher is bound to
`release.yml` and the tag-restricted `npm` GitHub environment. A maintainer must
review the source and tag before dispatching a release. Follow
[npm's trusted publishing setup](https://docs.npmjs.com/trusted-publishers/).
No long-lived npm publish token is needed. npm requires an existing package
before trust can be configured; the initial `0.1.0` release used maintainer
authentication with the exact CI-tested artifact. Subsequent releases use OIDC.
Release jobs pin Node.js 24.10.0, which bundles npm 11.6.1, above the trusted
publishing minimum of 11.5.1. The workflow checks that minimum explicitly.
See the [Node.js release notes](https://nodejs.org/en/blog/release/v24.10.0).

Update the version and changelog in a reviewed change, then create its matching
`v<version>` tag. Manually dispatch `release.yml` from that tag with the exact
package version and explicit publish confirmation. The workflow verifies the
tag, repository metadata, runtime tests, types and tarball, then uploads that
exact tarball and its SHA256/ref/version metadata as an immutable artifact. The
publish job downloads the artifact by ID, verifies its digest, version and source
ref against the verify job's outputs, and publishes the named tarball without
rebuilding or repacking. Leaving confirmation unchecked only verifies
the candidate. Initial publication and npm trust setup remain maintainer actions.
