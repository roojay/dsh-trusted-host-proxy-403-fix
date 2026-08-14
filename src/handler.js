import { isTrustedApiRequest } from './trust.js'

function closed(res, abort) {
  return Boolean((abort && abort.signal.aborted) || res.destroyed || res.writableEnded)
}

function waitWritable(res) {
  return new Promise(function (resolve) {
    if (res.destroyed || res.writableEnded) {
      resolve()
      return
    }
    function done() {
      res.off('drain', done)
      res.off('close', done)
      resolve()
    }
    res.once('drain', done)
    res.once('close', done)
  })
}

async function cancelBody(body) {
  if (!body || typeof body.cancel !== 'function') return
  try {
    await body.cancel()
  } catch (err) {}
}

async function transfer(req, res, apiHandler, maxRequestBodyBytes) {
  if (closed(res)) return

  const abort = new AbortController()
  function onClose() {
    if (!res.writableEnded) abort.abort()
  }
  res.on('close', onClose)

  try {
    const declaredLength = req.headers['content-length']
    if (declaredLength !== undefined && Number(declaredLength) > maxRequestBodyBytes) {
      if (!res.headersSent && !closed(res, abort)) {
        res.writeHead(413, { connection: 'close' })
        res.end()
      }
      req.destroy()
      return
    }

    const chunks = []
    let received = 0
    for await (const chunk of req) {
      if (closed(res, abort)) return
      received += chunk.byteLength
      if (received > maxRequestBodyBytes) {
        if (!res.headersSent && !closed(res, abort)) {
          res.writeHead(413, { connection: 'close' })
          res.end()
        }
        req.destroy()
        return
      }
      chunks.push(chunk)
    }

    if (closed(res, abort)) return

    const request = new Request(new URL(req.url || '/', 'http://dsh.internal'), {
      method: req.method || 'GET',
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(function (entry) {
          return typeof entry[1] === 'string'
        })
      ),
      ...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}),
      signal: abort.signal
    })

    const response = await apiHandler.fetch(request)
    if (closed(res, abort)) {
      await cancelBody(response.body)
      return
    }

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    if (response.body === null) {
      res.end()
      return
    }

    try {
      for await (const chunk of response.body) {
        if (closed(res, abort)) {
          await cancelBody(response.body)
          return
        }
        if (!res.write(chunk)) {
          await waitWritable(res)
          if (closed(res, abort)) {
            await cancelBody(response.body)
            return
          }
        }
      }
    } catch (err) {
      if (closed(res, abort)) return
      throw err
    }

    if (!res.writableEnded) res.end()
  } finally {
    res.off('close', onClose)
  }
}

export async function handlePrivileged(req, res, fetchHandler, trustedHosts, maxBytes) {
  if (!isTrustedApiRequest(req, trustedHosts)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  await transfer(req, res, fetchHandler, maxBytes)
}

export function mountPrivilegedApi(apiCtx, options) {
  const apiPath = options.apiPath
  const methods = options.methods
  const fetchHandler = options.fetchHandler
  const trustedHosts = options.trustedHosts
  const maxBytes = options.maxBytes
  const label = options.label
  for (let i = 0; i < methods.length; i++) {
    const method = methods[i]
    apiCtx.effect(function () {
      return apiCtx.webServer.register({
        kind: 'exact',
        path: apiPath + '/' + method,
        handler: function (req, res) {
          return handlePrivileged(req, res, fetchHandler, trustedHosts, maxBytes)
        }
      })
    }, label + apiPath + '/' + method)
  }
}
