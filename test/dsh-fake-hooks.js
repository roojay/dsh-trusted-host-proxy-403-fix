const fakes = {
  '@deepseek-ai/dsh-client-connection': new URL(
    './fakes/dsh-client-connection.js',
    import.meta.url
  ).href,
  '@deepseek-ai/dsh-host-apiproxy': new URL(
    './fakes/dsh-host-apiproxy.js',
    import.meta.url
  ).href
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(fakes, specifier)) {
    return { url: fakes[specifier], shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
