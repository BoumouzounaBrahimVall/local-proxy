# Local Proxy

A local HTTP proxy that forwards requests to a remote API and supports mocking via scenario rules.

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   Copy the example env file and adjust as needed:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values (see [Environment variables](#environment-variables)).

## Environment variables

| Variable     | Description                    | Default |
| ------------| ------------------------------ | ------- |
| `PORT`      | Port the proxy listens on      | `5050`  |
| `TARGET`    | Upstream API base URL          | `https://example.com` |
| `API_PREFIX`| Path prefix for proxied routes | `/api` |

Values are read from a `.env` file in the project root (see `.env.example`). Omitted variables use the defaults above.

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

The proxy will log the local URL and upstream target on startup.

## Project structure

- `src/config.ts` — Loads and exposes env configuration
- `src/types.ts` — Shared types (Scenario, Rule, Config)
- `src/scenarios.ts` — Scenario loading and response helpers
- `src/middleware/` — Mock and proxy middleware
- `src/app.ts` — Express app setup
- `src/index.ts` — Entry point

Mock rules are defined in `scenarios.json` at the project root.
