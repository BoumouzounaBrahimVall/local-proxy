# Local Proxy

A local HTTP proxy that sits between your frontend and a remote API gateway. It lets you **mock specific endpoints** with scenario-based responses while **transparently forwarding** everything else to the real backend.

## How it works

```
Browser / App
      │
      ▼
┌─────────────┐
│ Local Proxy │  localhost:5050
│             │
│  1. Mock    │  ← matches rules in scenarios.json → returns fixture
│  2. Proxy   │  ← everything else → forwards to TARGET
└─────────────┘
      │
      ▼
  Remote API
```

Every incoming request under `API_PREFIX` goes through two layers in order:

1. **Mock layer** — checks `scenarios.json` for a matching rule (method + path). If a rule is enabled and has an active scenario, the proxy responds locally without hitting the backend.
2. **Proxy layer** — if no mock matched, the request is forwarded as-is to the remote `TARGET`.

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values (see [Environment variables](#environment-variables)).

## Environment variables

| Variable     | Description                    | Default                                   |
| ------------ | ------------------------------ | ----------------------------------------- |
| `PORT`       | Port the proxy listens on      | `5050`                                    |
| `TARGET`     | Upstream API base URL          | `https://example.com`  |
| `API_PREFIX` | Path prefix for proxied routes | `/api`                              |

Values are read from `.env` in the project root. Omitted variables use the defaults above.

## Run

- **Development** (with ts-node):

  ```bash
  pnpm dev
  ```

- **Production** (compiled):

  ```bash
  pnpm build
  pnpm start
  ```

The proxy logs the local URL and upstream target on startup.

## Scenario configuration

Mock rules live in `scenarios.json` at the project root. Each rule defines:

| Field              | Type     | Description                                          |
| ------------------ | -------- | ---------------------------------------------------- |
| `method`           | string   | HTTP method to match (`GET`, `POST`, etc.)           |
| `match`            | string   | Path after `API_PREFIX` (e.g. `/v1/profile/lines/balance`) |
| `enabled`          | boolean  | Toggle the rule on/off without deleting it           |
| `active_scenario`  | string   | Key of the scenario to use for responses             |
| `scenarios`        | object   | Map of named scenarios (see below)                   |

Each **scenario** can have:

| Field    | Type   | Description                                      |
| -------- | ------ | ------------------------------------------------ |
| `status` | number | HTTP status code (default `200`)                 |
| `json`   | object | Inline JSON response body                        |
| `file`   | string | Path to a fixture file (relative to project root)|
| `delay`  | number | Artificial delay in **seconds** before responding|

### Example

```json
{
  "rules": [
    {
      "method": "POST",
      "match": "/v1/profile/lines/balance",
      "enabled": true,
      "active_scenario": "prepaid_no_bills",
      "scenarios": {
        "error500": {
          "status": 500,
          "json": { "message": "Internal Server Error" }
        },
        "slow": {
          "status": 200,
          "file": "fixtures/prepaid_no_bills.json",
          "delay": 3
        },
        "prepaid_no_bills": {
          "status": 200,
          "file": "fixtures/prepaid_no_bills.json"
        }
      }
    }
  ]
}
```

To switch scenarios, change `active_scenario` and restart (or the change takes effect on the next request since the file is re-read each time).

## Project structure

```
├── .env.example                   # Template for environment variables
├── .env                           # Local env config (git-ignored)
├── scenarios.json                 # Mock rules and scenarios
├── fixtures/                      # JSON fixture files referenced by scenarios
├── src/
│   ├── index.ts                   # Entry point — starts the server
│   ├── app.ts                     # Express app setup (mock → proxy)
│   ├── config.ts                  # Loads env variables via dotenv
│   ├── types.ts                   # Shared types (Scenario, Rule, Config)
│   ├── scenarios.ts               # Loads scenarios.json and builds responses
│   ├── reset.d.ts                 # ts-reset global type improvements
│   └── middleware/
│       ├── mockMiddleware.ts      # Intercepts requests matching mock rules
│       └── proxyMiddleware.ts     # Forwards unmatched requests to TARGET
└── tsconfig.json                  # Extends @tsconfig/strictest
```

## Known issues and gotchas

### Do not use `express.json()` before the proxy

Adding `express.json()` (or any body-parsing middleware) before the proxy layer **will cause `ECONNRESET` errors** on proxied requests. The body parser consumes the request stream; when `http-proxy` then tries to pipe the (now empty) stream to the upstream server, the connection resets.

The mock middleware only inspects `req.method` and `req.path` — it never reads the body — so body parsing is not needed.

### `secure: false` on the proxy

The proxy agent uses `secure: false` because the dev API gateway may present certificates that Node.js does not trust by default (corporate CA, self-signed, etc.). For production usage, set `secure: true` and provide the correct CA bundle.

### `keepAlive: false` on the HTTPS agent

Each proxied request creates a fresh TCP connection. This avoids `ECONNRESET` errors caused by the backend (or an intermediary gateway) closing idle connections that the proxy tries to reuse.
