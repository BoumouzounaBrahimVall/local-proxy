---
"@bvbmz/local-proxy": minor
---

Add Docker support: a multi-stage `Dockerfile`, a `compose.yml` wired to the
`TARGET`/`PORT`/`API_PREFIX`/`SCENARIOS` environment variables, and a
`.dockerignore`.

Each release now also publishes a multi-architecture image to Docker Hub
(`brahimvall/local-proxy`), tagged with the package version and `latest`.

The proxy also now closes its HTTP server on `SIGTERM`/`SIGINT`. Running as
PID 1 no default signal disposition applies, so the container was previously
SIGKILLed on `docker stop` with requests still in flight.
