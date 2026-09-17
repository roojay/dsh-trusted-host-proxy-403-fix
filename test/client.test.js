import assert from 'node:assert/strict'
import {
  SettingsDescribeMirror,
  SettingsScopeBinder,
  SettingsScopeController
} from './fakes/dsh-client-ui-settings.js'

let captured
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      captured = entry
    }
  }
}

const bundleUrl = new URL('../src/client.js', import.meta.url).href
await import(bundleUrl)

assert.ok(captured, 'window.__ModuleLoader__.load was called')
assert.equal(captured.id, 'dsh-trusted-host-proxy-403-fix')

const pkg = JSON.parse(
  await (await import('node:fs/promises')).readFile(
    new URL('../package.json', import.meta.url),
    'utf8'
  )
)
const packageInject = pkg.dsh.client.inject
for (const id of [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings-general',
  '@deepseek-ai/dsh-api-remotes'
]) {
  assert.ok(packageInject.includes(id), 'missing package inject ' + id)
}
assert.equal(pkg.exports['./client'], './src/client.js')

function clientRequire(id) {
  if (id === 'react') {
    return {
      createElement(type, props, children) {
        return { type, props: { ...props, children } }
      }
    }
  }
  throw new Error('unexpected client require: ' + id)
}

function loadEntry() {
  return captured.factory(clientRequire)
}

function makeCtx(services) {
  return {
    get(name) {
      return services[name]
    }
  }
}

// A reverse-proxy page starts non-loopback with an unavailable shared mirror.
// Applying the plugin upgrades the connection, mirror, and scopes that already
// existed before this client entry ran.
{
  const entry = loadEntry()
  assert.deepEqual(entry.inject, [
    'connection',
    'settingsScope',
    'locale',
    'theme',
    'slots',
    'remote',
    'remote.settings'
  ])

  const connection = { isLoopback: false }
  const remote = { $host: { isLoopback: false } }
  const mirror = new SettingsDescribeMirror('memory')
  const localeHost = new SettingsScopeController('memory', mirror)
  const themeHost = new SettingsScopeController('memory', mirror)
  const slotRegistrations = []
  const localeRegistrations = []
  const slots = {
    inject(name, callback) {
      assert.equal(name, 'settings.action')
      return callback()
    },
    register(options, component) {
      slotRegistrations.push({ options, component })
      return () => {}
    }
  }
  const locale = {
    host: localeHost,
    register(namespace, dictionaries) {
      localeRegistrations.push({ namespace, dictionaries })
      return () => {}
    }
  }
  const ctx = makeCtx({
    connection,
    remote,
    settingsScope: new SettingsScopeBinder(mirror),
    locale,
    theme: { host: themeHost },
    slots
  })
  remote.settings = {
    describe: async () => ({ ok: true, value: { namespaces: [] } })
  }
  ctx.effect = function (setup) {
    return setup() || (() => {})
  }
  let injectCalls = 0
  ctx.inject = function (deps, fn) {
    injectCalls += 1
    if (deps[0] === 'remote') fn({ remote: remote })
  }
  entry.apply(ctx)

  assert.equal(connection.isLoopback, true)
  assert.equal(remote.$host.isLoopback, true)
  assert.equal(injectCalls, 1)
  remote.$host.isLoopback = false
  assert.equal(remote.$host.isLoopback, true, 'getter keeps Host loopback true')
  assert.equal(mirror.persistence, 'host')
  assert.equal(mirror.loadCalls, 1)
  assert.deepEqual(mirror.view, { namespaces: [] })
  assert.equal(localeHost.persistence, 'host')
  assert.equal(themeHost.persistence, 'host')
  assert.equal(localeHost.snapshot.mode, 'host')
  assert.equal(themeHost.snapshot.mode, 'host')
  assert.equal(localeHost.snapshot.status, 'ready')
  assert.equal(themeHost.snapshot.status, 'ready')
  assert.equal(mirror.listeners.size, 2)
  assert.equal(localeRegistrations.length, 1)
  assert.equal(localeRegistrations[0].namespace, 'trusted-host-config-viewer')
  assert.equal(slotRegistrations.length, 1)
  assert.deepEqual(slotRegistrations[0].options, {
    name: 'settings.action',
    id: 'open-document',
    order: 0,
    priority: -1,
    locale: 'trusted-host-config-viewer',
    inject: slotRegistrations[0].options.inject
  })
  const injected = slotRegistrations[0].options.inject()
  assert.equal(typeof injected.openViewer, 'function')
  const action = slotRegistrations[0].component({
    ...injected,
    t: (key) => key === 'viewConfig' ? '查看生效配置' : key
  })
  assert.equal(action.type, 'button')
  assert.equal(action.props.children, '查看生效配置')
}

// Scopes bound after apply() (the plugin-config cards) are constructed in
// memory mode on a non-loopback page. The bind() wrapper upgrades each new
// scope controller in place, so it derives and reaches "ready".
{
  const entry = loadEntry()
  const connection = { isLoopback: false }
  const remote = { $host: { isLoopback: false } }
  const mirror = new SettingsDescribeMirror('memory')
  const binder = new SettingsScopeBinder(mirror)
  const ctx = makeCtx({ connection, remote, settingsScope: binder })
  entry.apply(ctx)

  // A card binds its scope after the plugin applied.
  const cardScope = binder.bind({ namespace: 'shell' })
  assert.equal(cardScope.persistence, 'host')
  assert.equal(cardScope.snapshot.mode, 'host')
  assert.equal(cardScope.snapshot.status, 'ready')
  assert.equal(typeof cardScope.unsubscribe, 'function')
  assert.equal(mirror.listeners.size, 1)

  // A second bind is upgraded too; the wrapper is idempotent per controller.
  const otherScope = binder.bind({ namespace: 'agent-loop' })
  assert.equal(otherScope.persistence, 'host')
  assert.equal(otherScope.snapshot.status, 'ready')
  assert.equal(mirror.listeners.size, 2)

  // Re-applying does not double-wrap bind().
  entry.apply(ctx)
  const again = binder.bind({ namespace: 'web-search-deepseek' })
  assert.equal(again.persistence, 'host')
  assert.equal(again.snapshot.status, 'ready')
  assert.equal(mirror.listeners.size, 3)
}

// Re-applying is harmless and refreshes the currently held mirror/scopes.
{
  const entry = loadEntry()
  const connection = { isLoopback: true }
  const mirror = new SettingsDescribeMirror('host')
  const localeHost = new SettingsScopeController('host', mirror)
  const ctx = makeCtx({
    connection,
    settingsScope: new SettingsScopeBinder(mirror),
    locale: { host: localeHost }
  })
  entry.apply(ctx)
  entry.apply(ctx)
  assert.equal(connection.isLoopback, true)
  assert.equal(mirror.loadCalls, 2)
  assert.equal(localeHost.deriveCalls, 0)
}

// Missing optional surfaces fail soft; the connection upgrade still occurs.
{
  const entry = loadEntry()
  const connection = { isLoopback: false }
  entry.apply(makeCtx({ connection }))
  assert.equal(connection.isLoopback, true)
  entry.apply(makeCtx({}))
}

// The viewer projects only resolved namespace values and serializes the
// JSON-value domain to valid, deterministic YAML without evaluating content.
{
  const entry = loadEntry()
  const config = entry.__test.effectiveConfig({
    writable: true,
    hasDocument: true,
    namespaces: [
      { ns: 'theme', value: { mode: 'dark' }, revision: 2 },
      { ns: 'models', value: { enabled: true, names: ['a', 'b'] }, revision: 4 }
    ]
  })
  assert.deepEqual(config, {
    theme: { mode: 'dark' },
    models: { enabled: true, names: ['a', 'b'] }
  })
  assert.equal(entry.__test.toYaml(config), [
    'theme:',
    '  mode: "dark"',
    'models:',
    '  enabled: true',
    '  names:',
    '    - "a"',
    '    - "b"'
  ].join('\n'))
}

console.log('client.test.js: all assertions passed')
