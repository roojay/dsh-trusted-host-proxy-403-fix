# dsh-trusted-host-proxy-403-fix

English | [中文](README.zh.md)

A standalone [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin bundle for the `web` profile. Version 0.3.0 is pinned to `@deepseek-ai/dsh@0.1.1-rc.2`.

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

This is the complete official `PRIVILEGED_METHODS` list in `@deepseek-ai/dsh-client-connection` 0.1.1-rc.2. All other `/api` routes keep the default `dsh-web-app` behavior.

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

## Settings persistence for trusted hosts

The 403 fix above unblocks the privileged RPCs, but DSH 0.1.1-rc.2 still treats
a non-loopback page as untrusted. Its shared settings mirror starts in the
terminal `unavailable` state, so Settings → Models reports `settings are
unavailable in this browser`; per-namespace settings scopes also use "memory"
persistence and silently drop choices on reload.

This package's browser half upgrades the authenticated trusted-host deployment
to host persistence:

- It promotes the shared `connection.isLoopback` capability for the client
  graph loaded from this same trusted-host plugin row. Future settings scopes
  are consequently created in host mode.
- It upgrades the shared settings describe mirror from memory to host mode and
  calls `load()` so an already-terminal `unavailable` mirror performs the
  privileged read and populates Settings → Models.
- It upgrades the controllers reachable through the `locale` and `theme`
  services in place (persistence is a plain instance field) and triggers a
  reload, so a saved preference applies on the first paint after the upgrade
  without waiting for the user to pick it again.

The browser half is a `dsh.client` entry shipped from the same row: no
additional configuration is needed. Its DSH package injections and peer
dependencies are all pinned to `0.1.1-rc.2`; re-check the official connection,
mirror, and scope implementations before upgrading DSH.

After installing, the Language (and Appearance, Composer Enter) preferences
are written to the settings document (e.g. `settings.yaml` under the harness
home) and survive page reloads and Web process restarts.

## Install

This package uses ESM and has no `prepare` script, so installing it from Git does not require `allowBuilds`.

```bash
dsh plugin --profile web add github:roojay/dsh-trusted-host-proxy-403-fix#v0.3.0
```

Install from npm:

```bash
dsh plugin --profile web add dsh-trusted-host-proxy-403-fix@0.3.0
```

Install from a GitHub Release tarball:

```bash
dsh plugin --profile web add https://github.com/roojay/dsh-trusted-host-proxy-403-fix/releases/download/v0.3.0/dsh-trusted-host-proxy-403-fix-0.3.0.tgz
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

A mismatched Origin must still be 403:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/settings.describe \
  -H 'Host: app.example.com' \
  -H 'Origin: https://evil.example' \
  -H 'content-type: application/json' \
  -d '{}'
# expect 403
```

After passing the authentication configured in front of DSH, open Settings → Models in the browser. The privileged method should no longer return 403.

Then confirm settings persistence (the 0.3.0 browser half):

1. Settings → Language: pick `zh` or `en` and save.
2. Check `$DSH_HOME/settings.yaml` contains `locale.preference` with that value.
3. Hard-refresh the page. The language choice must still be there.
4. Restart `dsh web` and open the page again. The choice must still be there.

## How it works

[`dsh-host-webserver`](https://github.com/deepseek-ai/deepseek-harness) checks exact routes before prefix routes. This plugin registers one exact `/api/<method>` route for every privileged method, so those requests bypass the empty `trustedHosts` check in the official `/api` handler.

The plugin is pinned to `@deepseek-ai/dsh@0.1.1-rc.2`. It depends on the official `connection` service and creates its Fetch handler with `createSharedFetchHandler`, so its privileged routes are removed whenever the official `/api` route is removed. `API_PATH` and `Config` come from official exports. The request security logic and privileged method list are copied locally because rc.2 does not export them. The request body limit matches the official 300 MiB default, and errors propagate to the official WebServer error handler.

## Develop

```bash
npm test
```

## License

MIT. The request validation logic is based on `@deepseek-ai/dsh-client-connection`.
