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
  '@deepseek-ai/dsh-client-ui-settings'
]) {
  assert.ok(packageInject.includes(id), 'missing package inject ' + id)
}
assert.equal(pkg.exports['./client'], './src/client.js')

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
  const entry = captured.factory()
  assert.deepEqual(entry.inject, [
    'connection',
    'settingsScope',
    'locale',
    'theme'
  ])

  const connection = { isLoopback: false }
  const mirror = new SettingsDescribeMirror('memory')
  const localeHost = new SettingsScopeController('memory', mirror)
  const themeHost = new SettingsScopeController('memory', mirror)
  entry.apply(makeCtx({
    connection,
    settingsScope: new SettingsScopeBinder(mirror),
    locale: { host: localeHost },
    theme: { host: themeHost }
  }))

  assert.equal(connection.isLoopback, true)
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
}

// Re-applying is harmless and refreshes the currently held mirror/scopes.
{
  const entry = captured.factory()
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
  const entry = captured.factory()
  const connection = { isLoopback: false }
  entry.apply(makeCtx({ connection }))
  assert.equal(connection.isLoopback, true)
  entry.apply(makeCtx({}))
}

console.log('client.test.js: all assertions passed')
