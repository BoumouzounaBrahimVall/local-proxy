# local-proxy

## 0.3.0

### Minor Changes

- 28214ed: Add Docker support: a multi-stage `Dockerfile`, a `compose.yml` wired to the
  `TARGET`/`PORT`/`API_PREFIX`/`SCENARIOS` environment variables, and a
  `.dockerignore`.

  Each release now also publishes a multi-architecture image to Docker Hub
  (`brahimvall/local-proxy`), tagged with the package version and `latest`.

  The proxy also now closes its HTTP server on `SIGTERM`/`SIGINT`. Running as
  PID 1 no default signal disposition applies, so the container was previously
  SIGKILLed on `docker stop` with requests still in flight.

### Patch Changes

- 13a3b76: Fix `PORT`, `API_PREFIX` and `SCENARIOS` environment variables being ignored by the CLI.

  `createConfig` already fell back to these variables, but the CLI declared plain
  default values for the matching options, so the parsed options were never
  undefined and the fallbacks were unreachable. Only `TARGET` worked, because
  `--target` had no default. The options now declare `.env()`, so commander
  resolves flag > environment > default.

## 0.2.0

### Minor Changes

- 300a0ab: Add CORS handling. Enable with the `--cors` CLI flag for permissive dev defaults, or configure a `cors` block in `scenarios.json` for fine-grained control (origin, credentials, allowedHeaders, allowedMethods, exposedHeaders, maxAge). Preflight `OPTIONS` requests are short-circuited with `204`, mocked responses receive CORS headers, and upstream CORS headers are stripped from proxied responses to avoid duplicates.

## 0.1.1

### Patch Changes

- f179677: update docs

## 0.0.4

### Patch Changes

- afd4082: fix(cli): include cli in the build

## 0.0.3

### Patch Changes

- 831d78e: docs: Update README installation instructions to include npm scope and support for pnpm and yarn

## 0.0.2

### Patch Changes

- fa6365d: init
