# dsh-trusted-host-proxy-403-fix

[English](README.md) | 中文

适用于 `web` profile 的独立 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。`0.3.0` 精确锁定 `@deepseek-ai/dsh@0.1.1-rc.2`。

`dsh web`（即 `dsh --profile web`）监听本机回环地址。可以多次传入 `--trusted-host`，添加 `/api` [浏览器请求安全检查](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/README.zh.md#api-%E6%B5%8F%E8%A7%88%E5%99%A8%E4%BF%A1%E4%BB%BB%E6%A0%85%E6%A0%8F)所接受的[受信任主机](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/README.zh.md)。请求中的 `Host` 与其中一项匹配时，非特权 API 方法即可正常访问。

Node.js 端的 `/api` 处理器会用空的 `trustedHosts` 列表再次检查**特权方法**，因此这些方法只能从回环地址访问。反向代理可以通过已配置的主机访问其他 API 方法，但下面 15 个方法仍会被拒绝。代理保留公网 `Host` 请求头时，设置 → 模型会报错：

```
transport failure for /api/settings.describe: HTTP 403
```

本插件为每个特权方法注册一条精确匹配的 `/api/<method>` 路由，并使用普通 `/api` 共用的 `trustedHosts` 列表检查请求。它保留官方 `connection` 插件行，也不提供身份认证。官方的主机检查只控制哪些主机名可以访问 API，不会验证用户身份；Web 传输层本身也没有内置认证。

## 受信任主机下的设置持久化

上面的 403 修复打通了特权 RPC，但 DSH `0.1.1-rc.2` 仍会把非回环页面视为不受信任。共享 settings mirror 会直接进入终态 `unavailable`，使设置 → 模型显示 `settings are unavailable in this browser`；各设置命名空间（语言、外观、Composer Enter 等）也运行在 "memory" 持久化模式，选择刷新后静默丢失。

本包浏览器半区会把已经过身份认证的 trusted-host 部署升级为 host 持久化：

- 它为同一个 trusted-host 插件行加载的客户端图提升 `connection.isLoopback` 能力，使后续 settings scope 直接以 host 模式创建。
- 它把共享 settings describe mirror 从 memory 升级为 host，并显式调用 `load()`，使已经进入 `unavailable` 终态的 mirror 重新执行特权读取并填充设置 → 模型。
- 它把通过 `locale` 与 `theme` 服务可达的控制器就地升级（persistence 是普通实例字段），并触发一次重新读取，使已保存的偏好升级后首屏即生效，无需用户重新选择。

浏览器半区是同一行里的 `dsh.client` 条目：无需额外配置。所有 DSH 包注入与 peer 依赖均精确锁定 `0.1.1-rc.2`；升级 DSH 前必须重新核对官方 connection、mirror 与 scope 实现。

安装后，语言（以及外观、Composer Enter）偏好会写入设置文档（如 harness 家目录下的 `settings.yaml`），页面刷新与 Web 进程重启后依然保留。

## 安装前

安装后，使用 `trustedHosts` 中任一主机名的请求都可以调用下列方法。这些方法能够读写设置和凭据、打开本机目录选择器、管理 Agent 预设，还能让运行 DSH 的主机向调用方指定的地址发送模型发现请求。

仅当这些主机已经受到身份认证或等效网络隔离保护时，才应把本插件装进 `web` profile。

1. `--trusted-host` 只添加客户端实际使用的主机。每项必须采用规范的 `host[:port]` 格式，不能包含协议、路径、用户信息或通配符。
2. 使用身份认证或网络隔离保护这些主机。不要只依赖本插件就将 `dsh web` 直接暴露到公网。官方 CLI 仍然拒绝 `--host 0.0.0.0`。
3. 对于浏览器请求，`Origin` 中的主机和端口必须与 `Host` 请求头一致。带有 `sec-fetch-site: cross-site` 或 `Origin: null` 的请求会被拒绝。
4. 不要将 `Host` 改写为回环地址，却保留公网 HTTPS Origin。两者不匹配时，其他 `/api` 请求也会返回 403。
5. 用户认证和权限控制不在本插件的功能范围内。

## 特权方法

以下是 `@deepseek-ai/dsh-client-connection` 0.1.1-rc.2 中完整的官方 `PRIVILEGED_METHODS` 列表。其他 `/api` 路由保持 `dsh-web-app` 的默认行为。

| 方法 | 用途 |
| --- | --- |
| `/api/settings.describe` | 读取所有已公开的设置命名空间 |
| `/api/settings.openDocument` | 打开设置文档 |
| `/api/settings.update` | 更新设置 |
| `/api/settings.replace` | 替换设置文档 |
| `/api/settings.mutate` | 修改设置 |
| `/api/credentials.describe` | 检查凭据是否已配置及其来源 |
| `/api/credentials.set` | 保存凭据 |
| `/api/credentials.unset` | 删除凭据 |
| `/api/llm.discoverModels` | 使用调用方提供的凭据，让运行 DSH 的主机发送模型发现请求 |
| `/api/host.pickDirectory` | 打开本机目录选择器 |
| `/api/host.openPath` | 在运行 DSH 的主机上打开路径 |
| `/api/agentPreset.read` | 读取 Agent 预设定义 |
| `/api/agentPreset.copy` | 复制 Agent 预设 |
| `/api/agentPreset.remove` | 删除 Agent 预设 |
| `/api/agentPreset.openDocument` | 打开 Agent 预设文档 |

以下方法不在该列表中，行为保持不变：`/api/llm.providers`、`/api/llm.models`、`/api/host.describe`、`/api/agentPreset.list`、`/api/agentPreset.select`、`session.create`、`/api/events.mux` 和 `/api/events.host`。

如果官方增删特权方法，需要发布新版插件。

## 安装

本插件使用 ESM，且没有 `prepare` 脚本，因此从 Git 安装进 profile 时不需要配置 `allowBuilds`。

```bash
dsh plugin --profile web add github:roojay/dsh-trusted-host-proxy-403-fix#v0.3.0
```

从 npm 安装：

```bash
dsh plugin --profile web add dsh-trusted-host-proxy-403-fix@0.3.0
```

从 GitHub Release 的 tarball 安装：

```bash
dsh plugin --profile web add https://github.com/roojay/dsh-trusted-host-proxy-403-fix/releases/download/v0.3.0/dsh-trusted-host-proxy-403-fix-0.3.0.tgz
```

从本地目录安装：

```bash
cd /absolute/path/to/dsh-trusted-host-proxy-403-fix
pnpm install --ignore-scripts
dsh plugin --profile web add "$PWD"
```

通过本地目录链接安装前必须先安装依赖，否则 DSH 启动 Web 进程时无法解析本插件的对等依赖。

`dsh web` 等同于 `dsh --profile web`。安装后请重启 Web 进程，并在启动时继续传入供外部访问的主机名：

```bash
dsh web --port 3080 --trusted-host app.example.com
```

不要在 `cordis.patch.yml` 中写死主机名。请将 `trustedHosts` 保持为 `!!js ctx.webRuntime.trustedHosts`。

从 `web` profile 移除本插件：

```bash
dsh plugin --profile web remove dsh-trusted-host-proxy-403-fix
```

## 验证

```bash
dsh --profile web --dump-config
```

合并后的配置中应包含 `# == dsh-trusted-host-proxy-403-fix` 段落，其中 `trusted-host-proxy-403-fix` 配置项的 `trustedHosts` 应读取自 `ctx.webRuntime.trustedHosts`。

通过回环地址发送请求，并使用与 `--trusted-host` 相同的主机名：

```bash
# 安装前：403 forbidden
# 安装后：200（RPC 响应可能是 invalid-request，但不能是 forbidden）
curl -sS -D- -o /tmp/dsh-body -X POST http://127.0.0.1:3080/api/settings.describe \
  -H 'Host: app.example.com' \
  -H 'Origin: https://app.example.com' \
  -H 'content-type: application/json' \
  -d '{}'
```

错误的 Origin 仍应 403：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/settings.describe \
  -H 'Host: app.example.com' \
  -H 'Origin: https://evil.example' \
  -H 'content-type: application/json' \
  -d '{}'
# 期望 403
```

通过 DSH 前置的身份认证后，在浏览器中打开设置 → 模型。此时特权方法不应再返回 403。

再确认设置能持久化（0.3.0 浏览器半区）：

1. 设置 → 语言：选 `zh` 或 `en` 并保存。
2. 查看 `$DSH_HOME/settings.yaml` 里有对应的 `locale.preference`。
3. 硬刷新页面，语言选择仍在。
4. 重启 `dsh web` 再打开，选择仍在。

## 工作原理

[`dsh-host-webserver`](https://github.com/deepseek-ai/deepseek-harness) 会先匹配精确路由，再匹配前缀路由。本插件为每个特权方法注册一条精确匹配的 `/api/<method>` 路由，使这些请求绕过官方 `/api` 处理器中空的 `trustedHosts` 检查。

本插件锁定 `@deepseek-ai/dsh@0.1.1-rc.2`。插件注入官方 `connection` 服务，特权路由会随该服务一起卸掉；`createSharedFetchHandler` 只负责接上官方 Fetch 分发。`API_PATH` 和 `Config` 直接使用官方导出。由于 rc.2 未导出请求安全检查和特权方法列表，本插件在本地保留了相应实现。请求体大小上限与官方默认值 300 MiB 一致，处理过程中的异常交由官方 WebServer 统一处理。

## 开发

```bash
npm test
```

## 许可证

MIT。请求校验逻辑参考 `@deepseek-ai/dsh-client-connection` 的实现。
