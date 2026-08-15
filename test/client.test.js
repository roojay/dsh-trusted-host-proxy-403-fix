import assert from 'node:assert/strict'
import { SettingsScopeController } from './fakes/dsh-client-ui-settings.js'

// Load the browser bundle exactly the way the shell does: the classic script
// calls window.__ModuleLoader__.load({ id, factory }) and the module table
// materializes it later through require(). The test captures the entry, then
// evaluates the factory with a controllable require().
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

{
  const pkg = JSON.parse(
    await (await import('node:fs/promises')).readFile(
      new URL('../package.json', import.meta.url),
      'utf8'
    )
  )
  const inject = pkg.dsh.client.inject
  assert.ok(inject.includes('@deepseek-ai/dsh-client-locale'))
  assert.ok(inject.includes('@deepseek-ai/dsh-client-ui-theme'))
  assert.ok(inject.includes('@deepseek-ai/dsh-client-ui-settings'))
  assert.equal(pkg.exports['./client'], './src/client.js')
}

function makeRequire(modules) {
  return function requireFn(spec) {
    const value = modules[spec]
    if (value === undefined) throw new Error('no such module: ' + spec)
    return value
  }
}

// --- fake cordis context ----------------------------------------------------

function makeService(host) {
  return { host }
}

function makeCtx(services) {
  return {
    get(name) {
      return services[name]
    }
  }
}

// --- scenario 1: full bundle available -------------------------------------

{
  const modules = {
    '@deepseek-ai/dsh-client-ui-settings': {
      SettingsScopeController
    }
  }
  const entry = captured.factory(makeRequire(modules))
  assert.deepEqual(entry.inject, ['locale', 'theme'])

  const localeHost = new SettingsScopeController('memory')
  const themeHost = new SettingsScopeController('memory')
  const ctx = makeCtx({
    locale: makeService(localeHost),
    theme: makeService(themeHost)
  })

  entry.apply(ctx)

  // Per-service upgrade: persistence flipped and load() actually ran the
  // queued operation (the enqueue patch removed the memory short-circuit).
  assert.equal(localeHost.persistence, 'host')
  assert.equal(themeHost.persistence, 'host')
  assert.ok(localeHost.loadCalls >= 1)
  assert.ok(themeHost.loadCalls >= 1)
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(localeHost.executed, ['load'])
  assert.deepEqual(themeHost.executed, ['load'])

  // Prototype patch covers controllers that were NOT reachable through a
  // service (ui-conversation, ui-settings-plugins, ...), including ones
  // constructed after apply ran.
  const lateHost = new SettingsScopeController('memory')
  await lateHost.set('preference', 'zh')
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(lateHost.executed, ['set:preference=zh'])
  assert.equal(lateHost.persistence, 'memory') // field untouched; enqueue no longer gates on it
}

// --- scenario 2: prototype patch is idempotent -----------------------------

{
  const modules = {
    '@deepseek-ai/dsh-client-ui-settings': {
      SettingsScopeController
    }
  }
  const entry = captured.factory(makeRequire(modules))
  const host = new SettingsScopeController('memory')
  entry.apply(makeCtx({ locale: makeService(host) }))
  // A second apply must not re-wrap the prototype; repeated upgrades only
  // trigger an extra (harmless) load.
  assert.equal(
    SettingsScopeController.prototype.enqueue.__dshTrustedHostPatched,
    true
  )
  entry.apply(makeCtx({ locale: makeService(host) }))
  await host.set('preference', 'en')
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(host.executed, ['load', 'load', 'set:preference=en'])
}

// --- scenario 3: disposed controllers stay inert ---------------------------

{
  const modules = {
    '@deepseek-ai/dsh-client-ui-settings': {
      SettingsScopeController
    }
  }
  const entry = captured.factory(makeRequire(modules))
  const host = new SettingsScopeController('memory')
  host.disposed = true
  entry.apply(makeCtx({ locale: makeService(host) }))
  const before = host.executed.length
  await host.set('preference', 'zh')
  await Promise.resolve()
  assert.equal(host.executed.length, before)
}

// --- scenario 4: ui-settings bundle unreachable (degraded) ------------------

{
  // No '@deepseek-ai/dsh-client-ui-settings' in the module table: apply must
  // not throw, and the direct per-service upgrade must still work because the
  // persistence field is flipped before load().
  const entry = captured.factory(makeRequire({}))
  const host = new SettingsScopeController('memory')
  entry.apply(makeCtx({ locale: makeService(host) }))
  assert.equal(host.persistence, 'host')
  assert.ok(host.loadCalls >= 1)
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(host.executed, ['load'])
}

// --- scenario 5: services without a host are ignored -----------------------

{
  const entry = captured.factory(makeRequire({}))
  entry.apply(makeCtx({ locale: {}, theme: undefined }))
  entry.apply(makeCtx({}))
}

// --- scenario 6: host-mode services are left untouched ---------------------

{
  const entry = captured.factory(makeRequire({}))
  const host = new SettingsScopeController('host')
  entry.apply(makeCtx({ locale: makeService(host) }))
  assert.equal(host.persistence, 'host')
  assert.ok(host.loadCalls >= 1)
}

console.log('client.test.js: all assertions passed')
