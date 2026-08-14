import assert from 'node:assert/strict'
import http from 'node:http'
import { handlePrivileged } from '../src/handler.js'

function listen(handler) {
  return new Promise(function (resolve) {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', function () {
      resolve(server)
    })
  })
}

function request(server, options) {
  const port = server.address().port
  return new Promise(function (resolve, reject) {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: port,
        path: options.path || '/api/settings.describe',
        method: options.method || 'POST',
        headers: options.headers || {}
      },
      function (res) {
        const chunks = []
        res.on('data', function (c) {
          chunks.push(c)
        })
        res.on('end', function () {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString()
          })
        })
      }
    )
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

const okHandler = {
  fetch: async function () {
    return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } })
  }
}

{
  const server = await listen(function (req, res) {
    return handlePrivileged(req, res, okHandler, ['app.example.com'], 1024)
  })
  const res = await request(server, {
    headers: {
      host: 'app.example.com',
      origin: 'https://evil.example.com',
      'content-type': 'application/json',
      'content-length': '2'
    },
    body: '{}'
  })
  assert.equal(res.status, 403)
  assert.equal(res.body, 'forbidden')
  server.close()
}

{
  const server = await listen(function (req, res) {
    return handlePrivileged(req, res, okHandler, ['app.example.com'], 1024)
  })
  const res = await request(server, {
    headers: {
      host: 'app.example.com',
      origin: 'https://app.example.com',
      'content-type': 'application/json',
      'content-length': '2'
    },
    body: '{}'
  })
  assert.equal(res.status, 200)
  assert.equal(res.body, 'ok')
  server.close()
}

{
  const server = await listen(function (req, res) {
    return handlePrivileged(req, res, okHandler, ['app.example.com'], 8)
  })
  const res = await request(server, {
    headers: {
      host: 'app.example.com',
      origin: 'https://app.example.com',
      'content-type': 'application/json',
      'content-length': '32'
    },
    body: '{"pad":"0123456789abcdef"}'
  })
  assert.equal(res.status, 413)
  server.close()
}

{
  let sawFetch = false
  let rejected = false
  const boom = {
    fetch: async function () {
      sawFetch = true
      throw new Error('upstream')
    }
  }
  const server = await listen(function (req, res) {
    return handlePrivileged(req, res, boom, ['app.example.com'], 1024).catch(function () {
      rejected = true
      if (!res.headersSent) {
        res.writeHead(500)
        res.end()
      } else if (!res.writableEnded) {
        res.destroy()
      }
    })
  })
  const res = await request(server, {
    headers: {
      host: 'app.example.com',
      origin: 'https://app.example.com',
      'content-type': 'application/json',
      'content-length': '2'
    },
    body: '{}'
  })
  assert.equal(sawFetch, true)
  assert.equal(rejected, true)
  assert.equal(res.status, 500)
  server.close()
}

{
  let settled = false
  const hang = {
    fetch: async function () {
      return new Response(
        new ReadableStream({
          start(controller) {
            const tick = function () {
              try {
                controller.enqueue(Buffer.alloc(16 * 1024, 97))
              } catch (err) {
                return
              }
              setTimeout(tick, 10)
            }
            tick()
          },
          cancel() {}
        }),
        { status: 200 }
      )
    }
  }
  const server = await listen(function (req, res) {
    handlePrivileged(req, res, hang, ['app.example.com'], 1024).then(
      function () {
        settled = true
      },
      function () {
        settled = true
      }
    )
  })
  await new Promise(function (resolve) {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path: '/api/settings.describe',
        method: 'POST',
        headers: {
          host: 'app.example.com',
          origin: 'https://app.example.com',
          'content-type': 'application/json',
          'content-length': '2'
        }
      },
      function (res) {
        res.destroy()
        resolve()
      }
    )
    req.on('error', function () {
      resolve()
    })
    req.write('{}')
    req.end()
  })
  const start = Date.now()
  while (!settled && Date.now() - start < 2000) {
    await new Promise(function (resolve) {
      setTimeout(resolve, 20)
    })
  }
  assert.equal(settled, true)
  server.close()
}

console.log('handler.test.js ok')
