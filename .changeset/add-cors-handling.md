---
"@bvbmz/local-proxy": minor
---

Add CORS handling. Enable with the `--cors` CLI flag for permissive dev defaults, or configure a `cors` block in `scenarios.json` for fine-grained control (origin, credentials, allowedHeaders, allowedMethods, exposedHeaders, maxAge). Preflight `OPTIONS` requests are short-circuited with `204`, mocked responses receive CORS headers, and upstream CORS headers are stripped from proxied responses to avoid duplicates.
