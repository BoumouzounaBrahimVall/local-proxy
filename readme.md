<div align="center">
# local-proxy

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
    }
  ]
}
```

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

## License

ISC
