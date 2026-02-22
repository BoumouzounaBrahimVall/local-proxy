# Local Proxy

A local development proxy with scenario-based mocking. Mock specific API endpoints while forwarding everything else to a real backend.

## Features

- Mock specific endpoints with configurable scenarios
- Transparent proxy for unmatched requests
- Hot-reload scenarios without restart
- Delay simulation for slow responses
- File-based fixture responses
- TypeScript support with full type inference
- Zod validation for configuration

## Installation

```bash
# Global installation (npm)
npm install -g @bvbmz/local-proxy

# Global installation (pnpm)
pnpm add -g @bvbmz/local-proxy

# Global installation (yarn)
yarn global add @bvbmz/local-proxy

# Or use with npx (no install)
npx @bvbmz/local-proxy --target https://api.example.com
```

## CLI Usage

```bash
local-proxy [options]

Options:
  -t, --target <url>       Upstream API URL (required)
  -p, --port <number>      Port to listen on (default: 5050)
  -a, --api-prefix <path>  API path prefix (default: /api)
  -s, --scenarios <file>   Path to scenarios.json (default: ./scenarios.json)
  --init                   Create a scenarios.json template
  -V, --version            Show version
  -h, --help               Show help

Examples:
  local-proxy --target https://api.example.com
  local-proxy -t https://api.example.com -p 3000 -s ./mocks/scenarios.json
```

### Quick Start

```bash
# Create a scenarios.json template
local-proxy --init

# Start the proxy
local-proxy --target https://api.example.com
```

## Configuration

### Environment Variables

| Variable     | Description                    | Default               |
|--------------|--------------------------------|-----------------------|
| `PORT`       | Port the proxy listens on      | `5050`                |
| `TARGET`     | Upstream API base URL          | -                     |
| `API_PREFIX` | Path prefix for proxied routes | `/api`                |

### scenarios.json

```json
{
  "rules": [
    {
      "method": "POST",
      "match": "/v1/users",
      "enabled": true,
      "active_scenario": "success",
      "scenarios": {
        "success": {
          "status": 201,
          "json": { "id": 1, "name": "John" }
        },
        "error": {
          "status": 400,
          "json": { "error": "Validation failed" }
        },
        "slow": {
          "status": 200,
          "delay": 3,
          "json": { "id": 1 }
        },
        "fromFile": {
          "status": 200,
          "file": "fixtures/user.json"
        }
      }
    }
  ]
}
```

### Scenario Options

| Field    | Type   | Description                          |
|----------|--------|--------------------------------------|
| `status` | number | HTTP status code (default: 200)      |
| `json`   | object | JSON response body                   |
| `file`   | string | Path to fixture file (relative)      |
| `delay`  | number | Response delay in seconds            |

### Rule Options

| Field            | Type    | Description                          |
|------------------|---------|--------------------------------------|
| `method`         | string  | HTTP method (GET, POST, PUT, etc.)   |
| `match`          | string  | Path to match                        |
| `enabled`        | boolean | Whether rule is active               |
| `active_scenario`| string  | Name of the scenario to use          |
| `scenarios`      | object  | Map of scenario name to scenario     |

## Library Usage

Use programmatically in your own code:

```typescript
import { createApp, createConfig } from 'local-proxy';
import * as fs from 'fs';

const config = createConfig({
  target: 'https://api.example.com',
  port: 5050,
  apiPrefix: '/api',
  scenarios: './scenarios.json',
});

const app = createApp({
  ...config,
  logger: console,
  fs,
  basePath: process.cwd(),
});

app.listen(config.port, () => {
  console.log(`Proxy running on port ${config.port}`);
});
```

### Exported Functions

- `createApp(context)` - Create an Express app with mock and proxy middleware
- `createConfig(options)` - Create and validate configuration
- `parseCliOptions(raw)` - Parse and validate CLI options
- `createScenarioLoader(fs, basePath)` - Create a scenario loader
- `matchRule(rules, method, path)` - Find matching rule for a request

### Exported Types

- `AppConfig` - Runtime configuration
- `AppContext` - Full context with dependencies
- `CliOptions` - CLI options
- `Scenario` - Single scenario definition
- `Rule` - Mock rule definition
- `ScenariosConfig` - Full scenarios.json structure
- `Logger` - Logger interface
- `FileSystem` - File system interface

### Zod Schemas

All types are validated at runtime using Zod. Schemas are exported for custom validation:

```typescript
import { scenariosConfigSchema } from 'local-proxy';

const result = scenariosConfigSchema.safeParse(myConfig);
if (!result.success) {
  console.error(result.error.issues);
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev -- --target https://api.example.com

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build for production
pnpm build
```

## How It Works

```
Browser/App  →  Local Proxy (localhost:5050)  →  Remote API
                        │
                        ├─ Matched rule → Return mock fixture
                        └─ No match → Forward to TARGET
```

1. Request comes in to the proxy
2. Mock middleware checks if any enabled rule matches the method and path
3. If matched, returns the configured scenario response (with optional delay)
4. If not matched, proxy middleware forwards to the target server

## License

ISC
