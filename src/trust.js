// Host / Origin / Fetch-Metadata fence.
// Logic follows MIT-licensed @deepseek-ai/dsh-client-connection
// packages/client/connection/src/api-request-trust.ts (0.1.0-rc.6).

function header(headers, name) {
  if (headers && typeof headers.get === 'function') {
    const value = headers.get(name)
    return value == null ? undefined : value
  }
  if (!headers) return undefined
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority) {
  try {
    return new URL('http://' + authority)
  } catch (err) {
    return undefined
  }
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL('https://' + entry).port
  return port === '' ? entryUrl.hostname : entryUrl.hostname + ':' + port
}

export function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts[0] !== '127') return false
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return false
    if (Number(parts[i]) > 255) return false
  }
  return true
}

export function assertTrustedAuthority(entry) {
  const entryUrl = parseAuthority(entry)
  if (entryUrl !== undefined && canonicalAuthority(entry, entryUrl) === String(entry).toLowerCase()) {
    return
  }
  throw new Error(
    'dsh-trusted-host-proxy-403-fix: trustedHosts entry ' +
      JSON.stringify(entry) +
      ' is not a bare host[:port] authority'
  )
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  if (!trustedHosts || !trustedHosts.length) return false
  for (let i = 0; i < trustedHosts.length; i++) {
    const entry = trustedHosts[i]
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) continue
    if (canonicalAuthority(entry, entryUrl) === entryUrl.hostname) {
      if (entryUrl.hostname === hostUrl.hostname) return true
    } else if (entryUrl.host === hostUrl.host) {
      return true
    }
  }
  return false
}

export function isTrustedApiRequest(request, trustedHosts) {
  if (!request) return false
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) {
    return false
  }
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch (err) {
    return false
  }
}
