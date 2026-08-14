export const toFetchHandlerCalls = []

export function toFetchHandler(apiProxy) {
  toFetchHandlerCalls.push(apiProxy)
  return {
    fetch: async function () {
      return new Response('ok', { status: 200 })
    },
    fromProxy: apiProxy
  }
}

export function resetToFetchHandlerCalls() {
  toFetchHandlerCalls.length = 0
}
