---
"@bvbmz/local-proxy": patch
---

Fix `PORT`, `API_PREFIX` and `SCENARIOS` environment variables being ignored by the CLI.

`createConfig` already fell back to these variables, but the CLI declared plain
default values for the matching options, so the parsed options were never
undefined and the fallbacks were unreachable. Only `TARGET` worked, because
`--target` had no default. The options now declare `.env()`, so commander
resolves flag > environment > default.
