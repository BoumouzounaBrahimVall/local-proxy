<div align="center">
<h1>Local-proxy</h1>
<img src="https://boumouzounabrahimvall.github.io/local-proxy/logo.svg" width="64" height="64" alt="local proxy logo">

**Scenario-based local API proxy for fast frontend development and test workflows.**

[📖 Documentation](https://boumouzounabrahimvall.github.io/local-proxy/) ·
[⚡ Quick Start](#quick-start) ·
[🔧 CLI](#cli) ·
[💬 GitHub](https://github.com/BoumouzounaBrahimVall/local-proxy)

</div>

---

## Why local-proxy

- Mock only the endpoints you care about
- Keep all other traffic flowing to your real API
- Simulate delays and failures before production
- Reuse realistic fixtures without backend dependencies

<h2 id="quick-start">Quick Start</h2>

```bash
# install
npm i -g @bvbmz/local-proxy

# create scenarios template
local-proxy --init

# run proxy
local-proxy --target https://api.example.com
```

Default local endpoint:

```text
http://localhost:5050/api
```

<h2 id="cli">CLI</h2>

```bash
local-proxy [options]
```

| Option | Description | Default |
| --- | --- | --- |
| `-t, --target <url>` | Upstream API URL | required unless `--init` |
| `-p, --port <number>` | Port to listen on | `5050` |
| `-a, --api-prefix <path>` | API path prefix | `/api` |
| `-s, --scenarios <file>` | Scenarios file path | `./scenarios.json` |
| `--init` | Create starter `scenarios.json` | - |
| `--cors` | Enable permissive CORS headers for browser dev | - |
| `-h, --help` | Show help | - |
| `-V, --version` | Show version | - |

## Environment variables

Every option except `--init` and `--cors` can also be set through the environment. Resolution order is **flag > environment > default**, so a flag always wins over an exported variable.

| Variable | Equivalent flag | Default |
| --- | --- | --- |
| `TARGET` | `-t, --target` | required unless `--init` |
| `PORT` | `-p, --port` | `5050` |
| `API_PREFIX` | `-a, --api-prefix` | `/api` |
| `SCENARIOS` | `-s, --scenarios` | `./scenarios.json` |

```bash
TARGET=https://api.example.com PORT=3000 local-proxy
```

A `.env` file in the working directory is loaded automatically — see `.env.example`.

## Docker

Run the proxy in a container instead of installing it globally. Released images are published to Docker Hub, tagged with the package version and `latest`:

```bash
docker pull brahimvall/local-proxy:latest
```

To add it to an existing stack, point the service at a published image:

```yaml
services:
  local-proxy:
    image: brahimvall/local-proxy:latest
    ports:
      - 5050:5050
    environment:
      TARGET: https://api.example.com
    volumes:
      - ./:/workspace:ro
    init: true
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Building from this repository

```bash
# copy the sample env file and set your upstream
cp .env.example .env

docker compose up --build
```

Compose reads `.env` and passes `TARGET`, `PORT`, `API_PREFIX` and `SCENARIOS` to the container. `TARGET` is required — `docker compose` fails immediately if it is unset rather than starting a proxy that points nowhere.

The project directory is mounted read-only at `/workspace`, so `scenarios.json` and any `fixtures/` are picked up from the host and edits apply on the next request without a rebuild.

### Proxying to an API on your host machine

Inside the container, `localhost` is the container itself. Use `host.docker.internal` to reach a server running on your machine:

```bash
TARGET=http://host.docker.internal:8080
```

### Without compose

```bash
docker build -t local-proxy .

docker run --rm -p 5050:5050 \
  -e TARGET=https://api.example.com \
  -v "$PWD":/workspace:ro \
  local-proxy
```

The image has no default command, so any CLI flag can be appended:

```bash
docker run --rm -v "$PWD":/workspace local-proxy --init
```

### Notes

- `--init` needs to write `scenarios.json`, so it does not work under `docker compose` — the mount there is read-only. Use the `docker run` form above, or `local-proxy --init` on the host.
- The container stops gracefully: `docker stop` closes the HTTP server and lets in-flight requests finish before exiting.

## scenarios.json

```json
{
  "rules": [
    {
      "method": "GET",
      "match": "/v1/example",
      "enabled": true,
      "active_scenario": "success",
      "scenarios": {
        "success": { "status": 200, "json": { "message": "ok" } },
        "error": { "status": 500, "json": { "error": "Internal Error" } },
        "slow": { "status": 200, "delay": 2, "json": { "message": "slow" } },
        "fixture": { "status": 200, "file": "fixtures/example.json" }
      }
    },
    {
      "method": "GET",
      "match": "/v1/reports/monthly.pdf",
      "enabled": true,
      "active_scenario": "success",
      "scenarios": {
        "success": {
          "status": 200,
          "file": "fixtures/monthly.pdf",
          "contentType": "application/pdf",
          "headers": {
            "Content-Disposition": "attachment; filename=monthly.pdf"
          }
        }
      }
    }
  ]
}
```

## Scenario fields

| Field | Description | Default |
| --- | --- | --- |
| `status` | HTTP status code | `200` |
| `json` | Inline JSON response body | - |
| `file` | Fixture file path (relative to project root) | - |
| `contentType` | Override `Content-Type` header | auto-detected |
| `headers` | Map of additional response headers | - |
| `delay` | Delay in seconds before responding | - |

Each scenario must include at least one of `json` or `file`.

## Dynamic path parameters

The `match` field supports named path parameters using `:paramName` syntax and wildcard captures using `*splatName`. Patterns are matched with [path-to-regexp](https://github.com/pillarjs/path-to-regexp).

### Named parameters

A `:paramName` segment matches exactly one path segment, regardless of its value:

```json
{ "match": "/v1/users/:id" }
{ "match": "/v1/orgs/:orgId/repos/:repoId" }
```

### Wildcard captures

A `*splatName` segment matches one or more path segments:

```json
{ "match": "/v1/files/*path" }
```

This matches `/v1/files/report.pdf` as well as `/v1/files/2024/january/report.pdf`.

### Case sensitivity

Path matching is case-sensitive. `/api/users` and `/API/Users` are treated as different paths.

### Rule precedence

Rules are evaluated in order. Place more specific (literal) rules before param rules to give them priority:

```json
{ "match": "/v1/users/me" },
{ "match": "/v1/users/:id" }
```

### Param logging

Matched parameters are printed in the proxy log:

```text
[MOCKED] GET /api/v1/users/42         -> success {"id":"42"}
[MOCKED] GET /api/v1/users/42/posts/7 -> success {"id":"42","postId":"7"}
```

## Non-JSON responses

`file` scenarios support any content type. Use `contentType` and `headers` to mock binary downloads, PDFs, CSVs, and images:

```json
{ "status": 200, "file": "fixtures/report.pdf", "contentType": "application/pdf", "headers": { "Content-Disposition": "attachment; filename=report.pdf" } }
```

```json
{ "status": 200, "file": "fixtures/export.csv", "contentType": "text/csv", "headers": { "Content-Disposition": "attachment; filename=export.csv" } }
```

```json
{ "status": 200, "file": "fixtures/photo.png", "contentType": "image/png" }
```

When `contentType` is omitted, the type is auto-detected from the file extension. Files are served as raw buffers — binary content is never corrupted.

## CORS

Running local-proxy from a browser on a different origin (the typical dev setup: frontend on `localhost:3000`, proxy on `localhost:5050`) triggers CORS. Enable handling in one of two ways.

**CLI flag** — permissive defaults, ideal for quick dev:

```bash
local-proxy --target https://api.example.com --cors
```

**`cors` block in `scenarios.json`** — fine-grained control:

```json
{
  "cors": {
    "enabled": true,
    "origin": "auto",
    "credentials": true,
    "allowedHeaders": "auto",
    "allowedMethods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "exposedHeaders": ["X-Total-Count"],
    "maxAge": 86400
  },
  "rules": []
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | Enable CORS handling |
| `origin` | `"auto"` \| string \| string[] | `"auto"` | `"auto"` reflects the request `Origin`; array allowlists specific origins |
| `credentials` | boolean | `true` | Sets `Access-Control-Allow-Credentials: true` |
| `allowedHeaders` | `"auto"` \| string[] | `"auto"` | `"auto"` echoes the preflight `Access-Control-Request-Headers` |
| `allowedMethods` | string[] | `["GET","POST","PUT","PATCH","DELETE","OPTIONS"]` | Methods returned on preflight |
| `exposedHeaders` | string[] | - | Optional headers exposed to JS via `Access-Control-Expose-Headers` |
| `maxAge` | number | `86400` | Preflight cache seconds |

`--cors` forces `enabled: true` regardless of the scenarios file; other fields in the `cors` block still apply. When CORS is on, preflight `OPTIONS` requests are short-circuited with `204`, mocked responses receive CORS headers, and upstream CORS headers are stripped from proxied responses to avoid duplicates.

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

## License

[ISC](LICENSE.md)
