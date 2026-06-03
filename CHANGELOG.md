# local-proxy

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
