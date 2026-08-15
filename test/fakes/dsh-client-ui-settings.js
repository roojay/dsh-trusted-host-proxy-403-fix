// Minimal behavioral replica of the official SettingsScopeController
// (packages/client/ui/settings/src/client/settings-scope.ts, 0.1.0-rc.6)
// used by the browser-half tests. Only the persistence-relevant surface is
// modeled: the "memory" short-circuit in enqueue, the tail queue, the
// disposed gate, and a load() that records what it did.

export class SettingsScopeController {
  constructor(persistence) {
    this.persistence = persistence
    this.disposed = false
    this.tail = Promise.resolve()
    this.loadCalls = 0
    this.executed = []
  }

  enqueue(operation) {
    if (this.persistence === 'memory' || this.disposed) return Promise.resolve()
    const task = this.tail.then(async () => {
      if (this.disposed) return
      await operation()
    })
    this.tail = task.catch(() => {})
    return task
  }

  load() {
    this.loadCalls += 1
    return this.enqueue(async () => {
      this.executed.push('load')
    })
  }

  set(field, value) {
    return this.enqueue(async () => {
      this.executed.push('set:' + field + '=' + value)
    })
  }
}
