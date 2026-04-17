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
| `-h, --help` | Show help | - |
| `-V, --version` | Show version | - |

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

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

## License

ISC
