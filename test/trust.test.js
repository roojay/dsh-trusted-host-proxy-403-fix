import assert from 'node:assert/strict'
import { PRIVILEGED_METHODS } from '../src/privileged.js'
import {
  assertTrustedAuthority,
  isLoopbackHostname,
  isTrustedApiRequest
} from '../src/trust.js'

function req(headers) {
  return { headers: headers }
}

assert.equal(isLoopbackHostname('localhost'), true)
assert.equal(isLoopbackHostname('127.0.0.1'), true)
assert.equal(isLoopbackHostname('[::1]'), true)
assert.equal(isLoopbackHostname('dsh.example.com'), false)
assert.equal(isLoopbackHostname('128.0.0.1'), false)

assertTrustedAuthority('dsh.example.com')
assertTrustedAuthority('dsh.example.com:443')
assert.throws(function () {
  assertTrustedAuthority('https://dsh.example.com')
})
assert.throws(function () {
  assertTrustedAuthority('dsh.example.com/path')
})
assert.throws(function () {
  assertTrustedAuthority('user@dsh.example.com')
})

assert.equal(
  isTrustedApiRequest(req({ host: '127.0.0.1:3080' }), []),
  true
)
assert.equal(
  isTrustedApiRequest(req({ host: 'dsh.example.com' }), []),
  false
)
assert.equal(
  isTrustedApiRequest(req({ host: 'dsh.example.com' }), ['dsh.example.com']),
  true
)
assert.equal(
  isTrustedApiRequest(
    req({
      host: 'dsh.example.com',
      origin: 'https://dsh.example.com'
    }),
    ['dsh.example.com']
  ),
  true
)
assert.equal(
  isTrustedApiRequest(
    req({
      host: 'dsh.example.com',
      origin: 'https://evil.example.com'
    }),
    ['dsh.example.com']
  ),
  false
)
assert.equal(
  isTrustedApiRequest(
    req({
      host: '127.0.0.1:3080',
      origin: 'https://dsh.example.com'
    }),
    ['dsh.example.com']
  ),
  false
)
assert.equal(
  isTrustedApiRequest(
    req({
      host: 'dsh.example.com',
      'sec-fetch-site': 'cross-site'
    }),
    ['dsh.example.com']
  ),
  false
)
assert.equal(
  isTrustedApiRequest(
    req({
      host: 'dsh.example.com',
      origin: 'null'
    }),
    ['dsh.example.com']
  ),
  false
)
assert.ok(PRIVILEGED_METHODS.indexOf('settings.describe') !== -1)
assert.ok(PRIVILEGED_METHODS.indexOf('credentials.set') !== -1)

console.log('trust.test.js ok')
