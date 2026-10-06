---
name: local-proxy-mock
description: Mock one or more HTTP endpoints with @bvbmz/local-proxy while every other request goes to the real upstream. Works for any HTTP client - web front ends, mobile apps, and backend services calling other services. Use when the user wants to test against fake responses, switch between mock scenarios (success, empty, error, slow, edge cases), or says "mock this endpoint", "start the proxy", "switch to scenario X" or "stop the proxy".
---

# Local proxy mock

Run `@bvbmz/local-proxy` with `npx`. It answers the mocked endpoints from `scenarios.json` and forwards every other request to the real upstream. The client only needs its base URL changed to point at the proxy.

## 1. Collect the inputs

Fill each input from the conversation first, then from the codebase. Ask with `AskUserQuestion` only for what is still missing, in one batch.

| Input | Where to look before asking |
| --- | --- |
| Client type: web front end, mobile app, or backend service | The repo: `package.json` with React, Vue, Angular or Next means web. `pubspec.yaml`, Gradle or Xcode means mobile. A server framework means backend |
| Where the client runs: browser, device, emulator, local process, Docker container | The user's message, `docker-compose.yml`, run scripts |
| Upstream URL to forward to | The user's message, `.env*` files, config files, base URL constants |
| Endpoints to mock (method and path) | The API client, data source, repository or HTTP service of the feature |
| Path prefix the client adds to the base URL | Interceptors, client factories, gateway suffixes (`/api`, `/v1`, `/transverse`) |
| Response shape | DTOs, `fromJson` methods, TypeScript types, OpenAPI specs, recorded responses |
| Scenarios and their content | The user's list. Otherwise propose success, one variant per optional field, empty, error and slow |
| Default scenario | The first scenario in the user's list |
| Values that depend on the running client, such as an installed build number or a user id | The device, the local database, version files |

Write the full path the client sends, prefix included. A base URL of `<host>/transverse` and a request to `/v1/soft-update` give `match: "/transverse/v1/soft-update"`.

When the client calls several upstreams, start one proxy per upstream on its own port. Mock only the endpoints the user named.

## 2. Create the workspace

Put the files outside the repo, in `$TMPDIR/<ticket-or-feature>-proxy/`, so nothing gets committed:

- `scenarios.json`, with the format below
- `switch.sh`, copied from this skill's `switch.sh` and made executable
- `README.md`, with the start command, the base URL to use in the client and a table of the scenarios

```json
{
  "rules": [
    {
      "method": "GET",
      "match": "/v1/orders/:id",
      "enabled": true,
      "active_scenario": "success",
      "scenarios": {
        "success": { "status": 200, "json": { "id": "42", "state": "paid" } },
        "not-found": { "status": 404, "json": { "error": "Not found" } },
        "slow": { "status": 200, "delay": 5, "json": { "id": "42", "state": "paid" } },
        "error": { "status": 500, "json": { "error": "Internal Error" } }
      }
    }
  ]
}
```

A scenario takes `status`, and `json` or `file`. It can also take `delay` in seconds, `headers` and `contentType`. Use `file` for large bodies, binaries, PDFs or CSVs, with the path relative to the workspace. `match` accepts `:param` and `*splat` segments. The proxy checks the rules in order, so put literal paths before paths with parameters.

Build the JSON with a short script when scenarios share most of their fields. It avoids copy and paste mistakes. For media URLs inside a mock, use public URLs that return 200, and check them with `curl -sI`.

## 3. Start the proxy

```bash
cd "$DIR" && npx -y @bvbmz/local-proxy --target "$UPSTREAM" --api-prefix / --port "$PORT" --scenarios ./scenarios.json 2>&1 | tee proxy.log
```

Run it with `run_in_background: true`. The default port is 5050. Pick another one if `lsof -iTCP:<port> -sTCP:LISTEN` shows it is taken.

Always pass `--api-prefix /`. The default prefix `/api` gets added to the target when the proxy forwards a request. The startup line `Proxying to: <target>/api` shows the problem. Only keep a prefix when the client itself sends it and the upstream expects it too.

Add `--cors` when a browser calls the proxy from another origin. The section on web front ends says when.

If Docker suits the project better, run the image `brahimvall/local-proxy:latest` with `-e TARGET=... -v "$DIR":/workspace:ro -p <port>:5050`. Inside a container, the host machine is `host.docker.internal`.

## 4. Check it before handing over

1. Wait until the port listens: `lsof -iTCP:<port> -sTCP:LISTEN`.
2. Call the mocked path through the address the client will use, and check that the status and body match the default scenario.
3. Call an unmocked path through the proxy and the same path on the upstream directly. Both must return the same status.
4. Run `./switch.sh <another>`, call the endpoint again, then switch back to the default.
5. For a browser client with `--cors`, send an `OPTIONS` preflight with an `Origin` header and check the `Access-Control-Allow-*` headers.

## 5. Point the client at the proxy

Find where the client reads its base URL, then give the user the value to set. Prefer configuration over code: an env variable, a config file or a dev server setting.

### Web front end

- **Env variable.** Set the API base URL variable to `http://localhost:<port>`, for example `VITE_API_URL`, `NEXT_PUBLIC_API_URL`, `REACT_APP_API_URL` or `environment.ts` in Angular. Put it in a local file such as `.env.local` that git ignores, and restart the dev server so it reads the new value.
- **Dev server proxy.** If the app calls relative paths, point the dev server proxy at the proxy instead: `server.proxy` in Vite, `rewrites` in Next, `proxy.conf.json` in Angular, `devServer.proxy` in webpack. The browser then stays on one origin and needs no CORS.
- **CORS.** When the browser calls the proxy directly from another origin, start the proxy with `--cors`. Requests with cookies also need `credentials` enabled, which `--cors` does.
- **Mixed content.** A page served over HTTPS cannot call `http://`. Run the front end over HTTP locally, or use the dev server proxy.

### Mobile app

- On a physical device on the same Wi-Fi, use `http://<LAN IP>:<port>`. Get the IP with `ipconfig getifaddr en0` on macOS or `hostname -I` on Linux.
- On the Android emulator, use `http://10.0.2.2:<port>`. On the iOS simulator, use `http://localhost:<port>`.
- On an Android device over USB, run `adb reverse tcp:<port> tcp:<port>` and use `http://localhost:<port>`.
- Android blocks plain HTTP unless the build allows it, through `android:usesCleartextTraffic="true"` or a `network_security_config.xml`. Check the manifest of the flavor or build type that will run.
- iOS App Transport Security needs an `NSAllowsArbitraryLoads` or `NSExceptionDomains` entry for plain HTTP.
- When the base URL comes from the backend or remote config instead of the build, a temporary code change is often the only way. See the section on temporary code changes.
- If the app caches the response, tell the user how to get a fresh one, for example by killing and relaunching the app.

### Backend service calling another service

- Set the downstream URL setting of the service to `http://localhost:<port>`. Look in `.env`, `application.yml`, `appsettings.json`, `settings.py`, `config/*.ts` or the client constructor.
- If the service runs in Docker and the proxy runs on the host, use `http://host.docker.internal:<port>`. On Linux, add `extra_hosts: ["host.docker.internal:host-gateway"]`. If both run in Docker Compose, run the proxy image as a service and use its service name as the host.
- If the client pins TLS or only accepts `https`, find the setting that allows plain HTTP in local runs, or ask the user before changing code.
- Auth headers and tokens pass through the proxy unchanged to the upstream. The mocked responses ignore them.
- Restart the service so it reads the new setting.

### Temporary code changes

If the user asks for a code change to use the proxy, keep it as small as possible. Add a comment `TEMP local proxy, revert before commit` to each edit, and give the user the `git checkout -- <files>` command to revert. If a file also has wanted changes in the index, say that `git checkout --` restores the staged version.

## 6. Switch scenarios

When the user says "switch to <name>", run `"$DIR/switch.sh" <name>` and confirm with one `curl`. With several rules, pass the rule's `match` as the second argument. The proxy reads the file again on every request, so it needs no restart. When the user asks for a new scenario or endpoint, add it to `scenarios.json`, then switch to it if they ask.

## 7. Stop

```bash
kill $(lsof -tiTCP:<port> -sTCP:LISTEN)
```

For Docker, run `docker stop <container>`. Confirm the port is free. Remind the user of any setting or temporary code change that still points at the proxy.

## Rules

- Never commit the workspace, local env files or temporary code changes. When the user asks to commit, leave those out, and say which ones.
- Report the real result of each check. If a check fails, show the output.
