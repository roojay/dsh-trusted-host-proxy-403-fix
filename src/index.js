import { API_PATH, Config } from '@deepseek-ai/dsh-client-connection'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import { mountPrivilegedApi } from './handler.js'
import { PRIVILEGED_METHODS } from './privileged.js'
import { assertTrustedAuthority } from './trust.js'

export const name = 'dsh-trusted-host-proxy-403-fix'
export const inject = ['webServer', 'connection']
export { Config }

const DEFAULT_MAX_REQUEST_BODY_BYTES = 300 * 1024 * 1024

export function apply(ctx, config) {
  const trustedHosts = config && config.trustedHosts ? config.trustedHosts : []
  const maxBytes =
    config && config.maxRequestBodyBytes
      ? config.maxRequestBodyBytes
      : DEFAULT_MAX_REQUEST_BODY_BYTES

  for (let i = 0; i < trustedHosts.length; i++) {
    assertTrustedAuthority(trustedHosts[i])
  }

  ctx.inject(['apiProxy'], function (apiCtx) {
    mountPrivilegedApi(apiCtx, {
      apiPath: API_PATH,
      methods: PRIVILEGED_METHODS,
      fetchHandler: apiCtx.connection.createSharedFetchHandler(
        API_PATH,
        toFetchHandler(apiCtx.apiProxy)
      ),
      trustedHosts: trustedHosts,
      maxBytes: maxBytes,
      label: name + ': '
    })
  })
}
