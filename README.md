# dsh-trusted-host-proxy-403-fix

English | [中文](README.zh.md)

A standalone [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin bundle for the `web` profile. Compatible with `@deepseek-ai/dsh@0.1.0-rc.6`.

`dsh web` (`dsh --profile web`) listens on the loopback interface. You can repeat `--trusted-host` to add [trusted host entries](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/README.md) that pass the `/api` [browser request security checks](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/README.md#api-browser-trust-fence). Requests to non-privileged API methods then succeed when their `Host` matches one of those entries.

The Node.js `/api` handler applies a second check to the **privileged method set** with an empty `trustedHosts` list, which restricts these methods to loopback. As a result, a reverse proxy can reach other API methods through a configured host, while these 15 methods remain unavailable. When the proxy preserves the public `Host` header, Settings → Models fails with:

```
transport failure for /api/settings.describe: HTTP 403
```

This plugin registers an exact `/api/<method>` route for each privileged method and validates those requests against the same `trustedHosts` list as the rest of `/api`. It keeps the official `connection` plugin in place and does not provide authentication. The official host checks control which hostnames may reach the API; they do not verify user identity. The Web transport has no built-in authentication.

## Before you install

After installation, requests using any host listed in `trustedHosts` can call the methods below. These methods can read and change settings and credentials, open native directory dialogs, manage agent presets, and make the DSH host send a model discovery request to a URL supplied by the caller.

Install this plugin only when those hosts are already protected by authentication or equivalent network isolation.

1. Add only the hosts that clients use to `--trusted-host`. Each entry must be a canonical `host[:port]` value without a scheme, path, user information, or wildcard.
2. Protect those hosts with authentication or network isolation. Do not expose `dsh web` directly to the public internet with this plugin as the only protection. The official CLI still rejects `--host 0.0.0.0`.
3. For browser requests, the host and port in `Origin` must match the `Host` header. Requests with `sec-fetch-site: cross-site` or `Origin: null` are rejected.
4. Do not rewrite `Host` to a loopback address while keeping the public HTTPS origin. That mismatch also causes the rest of `/api` to return 403.
5. User authentication and authorization remain outside this plugin.

## Privileged methods

This is the complete official `PRIVILEGED_METHODS` list in `@deepseek-ai/dsh-client-connection` 0.1.0-rc.6. All other `/api` routes keep the default `dsh-web-app` behavior.

| Method | Purpose |
| --- | --- |
| `/api/settings.describe` | Read all exposed settings namespaces |
| `/api/settings.openDocument` | Open the settings document |
| `/api/settings.update` | Update settings |
| `/api/settings.replace` | Replace a settings document |
| `/api/settings.mutate` | Modify settings |
| `/api/credentials.describe` | Check whether a credential is configured and where it comes from |
| `/api/credentials.set` | Save a credential |
| `/api/credentials.unset` | Remove a credential |
| `/api/llm.discoverModels` | Send a model discovery request from the DSH host using credentials supplied by the caller |
| `/api/host.pickDirectory` | Open the native directory picker |
| `/api/host.openPath` | Open a path on the DSH host |
| `/api/agentPreset.read` | Read an agent preset definition |
| `/api/agentPreset.copy` | Copy an agent preset |
| `/api/agentPreset.remove` | Remove an agent preset |
| `/api/agentPreset.openDocument` | Open an agent preset document |

The following methods are not part of this list and remain unchanged: `/api/llm.providers`, `/api/llm.models`, `/api/host.describe`, `/api/agentPreset.list`, `/api/agentPreset.select`, `session.create`, `/api/events.mux`, and `/api/events.host`.

Release an updated plugin version if the official privileged method list changes.

## Install

This package uses ESM and has no `prepare` script, so installing it from Git does not require `allowBuilds`.

```bash
dsh plugin --profile web add github:roojay/dsh-trusted-host-proxy-403-fix#v0.1.0
```

Install from npm:

```bash
dsh plugin --profile web add dsh-trusted-host-proxy-403-fix@0.1.0
```

Install from a GitHub Release tarball:

```bash
dsh plugin --profile web add https://github.com/roojay/dsh-trusted-host-proxy-403-fix/releases/download/v0.1.0/dsh-trusted-host-proxy-403-fix-0.1.0.tgz
```

Install from a local directory:

```bash
cd /absolute/path/to/dsh-trusted-host-proxy-403-fix
pnpm install --ignore-scripts
dsh plugin --profile web add "$PWD"
```

The dependency installation is required for a local-directory link. Without it, DSH cannot resolve the plugin's peer dependencies when the Web process starts.

`dsh web` is equivalent to `dsh --profile web`. Restart the Web process after installation and continue passing the public host when starting it:

```bash
dsh web --port 3080 --trusted-host app.example.com
```

Do not hard-code a host in `cordis.patch.yml`. Keep `trustedHosts` set to `!!js ctx.webRuntime.trustedHosts`.

Remove the plugin:

```bash
dsh plugin --profile web remove dsh-trusted-host-proxy-403-fix
```

## Verify

```bash
dsh --profile web --dump-config
```

The merged configuration should contain a `# == dsh-trusted-host-proxy-403-fix` section. Its `trusted-host-proxy-403-fix` entry should read `trustedHosts` from `ctx.webRuntime.trustedHosts`.

Send a request to the loopback address using the same host passed to `--trusted-host`:

```bash
# before: 403 forbidden
# after:  200 (the RPC response may be invalid-request, but it must not be forbidden)
curl -sS -D- -o /tmp/dsh-body -X POST http://127.0.0.1:3080/api/settings.describe \
  -H 'Host: app.example.com' \
  -H 'Origin: https://app.example.com' \
  -H 'content-type: application/json' \
  -d '{}'
```

After passing the authentication configured in front of DSH, open Settings → Models in the browser. The privileged method should no longer return 403.

## How it works

[`dsh-host-webserver`](https://github.com/deepseek-ai/deepseek-harness) checks exact routes before prefix routes. This plugin registers one exact `/api/<method>` route for every privileged method, so those requests bypass the empty `trustedHosts` check in the official `/api` handler.

The plugin is pinned to `@deepseek-ai/dsh@0.1.0-rc.6`. It depends on the official `connection` service and creates its Fetch handler with `createSharedFetchHandler`, so its privileged routes are removed whenever the official `/api` route is removed. `API_PATH` and `Config` come from official exports. The request security logic and privileged method list are copied locally because rc.6 does not export them. The request body limit matches the official 160 MiB default, and errors propagate to the official WebServer error handler.

## Develop

```bash
npm test
```

## License

MIT. The request validation logic is based on `@deepseek-ai/dsh-client-connection`.
