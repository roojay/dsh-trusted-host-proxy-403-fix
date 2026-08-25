import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRIVILEGED_METHODS } from '../src/privileged.js'

const FROZEN = [
  'agentPreset.read',
  'agentPreset.copy',
  'agentPreset.openDocument',
  'agentPreset.remove',
  'host.pickDirectory',
  'host.openPath',
  'settings.describe',
  'settings.openDocument',
  'settings.update',
  'settings.replace',
  'settings.mutate',
  'credentials.describe',
  'credentials.set',
  'credentials.unset',
  'llm.discoverModels'
]

assert.deepEqual([...PRIVILEGED_METHODS], FROZEN)
assert.equal(PRIVILEGED_METHODS.length, 15)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const readmeZh = readFileSync(join(root, 'README.zh.md'), 'utf8')
for (let i = 0; i < FROZEN.length; i++) {
  const pathRe = new RegExp('/api/' + FROZEN[i].replace('.', '\\.'))
  assert.match(readme, pathRe)
  assert.match(readmeZh, pathRe)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '^4.0.1')
for (const name of [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-host-apiproxy',
  '@deepseek-ai/dsh-host-webserver'
]) {
  assert.equal(pkg.peerDependencies[name], '0.1.1-rc.2')
}
assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], undefined)
assert.ok(pkg.files.includes('src'))
assert.ok(!pkg.files.includes('official.js'))
assert.ok(!pkg.files.includes('bridge.js'))
assert.ok(!pkg.files.includes('dispatch.js'))
assert.match(readmeZh, /插件/)
assert.doesNotMatch(readmeZh, /组合包/)

console.log('privileged.test.js ok')
