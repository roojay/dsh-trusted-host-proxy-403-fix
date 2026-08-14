import assert from 'node:assert/strict'
import { apply, inject, name, Config } from '../src/index.js'
import { mountPrivilegedApi } from '../src/handler.js'
import { PRIVILEGED_METHODS } from '../src/privileged.js'
import {
  resetToFetchHandlerCalls,
  toFetchHandlerCalls
} from './fakes/dsh-host-apiproxy.js'

assert.deepEqual(inject, ['webServer', 'connection'])
assert.equal(name, 'dsh-trusted-host-proxy-403-fix')
assert.equal(Config.source, 'official-config')

{
  const routes = []
  const effects = []
  const apiCtx = {
    webServer: {
      register: function (route) {
        routes.push(route)
        return function () {
          const index = routes.indexOf(route)
          if (index !== -1) routes.splice(index, 1)
        }
      }
    },
    effect: function (factory, label) {
      const dispose = factory()
      effects.push({ label: label, dispose: dispose })
      return dispose
    }
  }

  mountPrivilegedApi(apiCtx, {
    apiPath: '/api',
    methods: PRIVILEGED_METHODS,
    fetchHandler: {
      fetch: async function () {
        return new Response('ok', { status: 200 })
      }
    },
    trustedHosts: ['app.example.com'],
    maxBytes: 1024,
    label: 'dsh-trusted-host-proxy-403-fix: '
  })

  assert.equal(routes.length, 15)
  assert.equal(effects.length, 15)
  for (let i = 0; i < PRIVILEGED_METHODS.length; i++) {
    const route = routes[i]
    assert.equal(route.kind, 'exact')
    assert.equal(route.path, '/api/' + PRIVILEGED_METHODS[i])
    assert.equal(typeof route.handler, 'function')
    assert.equal(
      effects[i].label,
      'dsh-trusted-host-proxy-403-fix: /api/' + PRIVILEGED_METHODS[i]
    )
  }

  for (let j = 0; j < effects.length; j++) {
    effects[j].dispose()
  }
  assert.equal(routes.length, 0)
}

{
  assert.throws(function () {
    apply({ inject: function () {} }, { trustedHosts: ['https://bad.example'] })
  })
}

{
  resetToFetchHandlerCalls()
  let apiProxyWaiter
  const routes = []
  const effects = []
  const sharedCalls = []
  const apiProxy = { id: 'live-proxy' }

  const ctx = {
    inject: function (deps, fn) {
      assert.deepEqual(deps, ['apiProxy'])
      apiProxyWaiter = fn
    }
  }

  apply(ctx, { trustedHosts: ['app.example.com'], maxRequestBodyBytes: 1024 })
  assert.equal(routes.length, 0)
  assert.equal(typeof apiProxyWaiter, 'function')
  assert.equal(toFetchHandlerCalls.length, 0)

  apiProxyWaiter({
    apiProxy: apiProxy,
    connection: {
      createSharedFetchHandler: function (channel, fallback) {
        sharedCalls.push({ channel: channel, fallback: fallback })
        return { kind: 'shared', channel: channel, fallback: fallback }
      }
    },
    webServer: {
      register: function (route) {
        routes.push(route)
        return function () {
          const index = routes.indexOf(route)
          if (index !== -1) routes.splice(index, 1)
        }
      }
    },
    effect: function (factory, label) {
      const dispose = factory()
      effects.push({ label: label, dispose: dispose })
      return dispose
    }
  })

  assert.equal(toFetchHandlerCalls.length, 1)
  assert.equal(toFetchHandlerCalls[0], apiProxy)
  assert.equal(sharedCalls.length, 1)
  assert.equal(sharedCalls[0].channel, '/api')
  assert.equal(sharedCalls[0].fallback.fromProxy, apiProxy)
  assert.equal(routes.length, 15)
  assert.equal(effects.length, 15)
  for (let i = 0; i < PRIVILEGED_METHODS.length; i++) {
    assert.equal(routes[i].kind, 'exact')
    assert.equal(routes[i].path, '/api/' + PRIVILEGED_METHODS[i])
  }

  for (let j = 0; j < effects.length; j++) {
    effects[j].dispose()
  }
  assert.equal(routes.length, 0)
}

console.log('apply.test.js ok')
