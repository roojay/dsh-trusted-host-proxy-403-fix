// Minimal behavioral replicas of the 0.1.1-rc.2 settings client pieces used
// by the browser-half tests.

export class SettingsScopeController {
  constructor(persistence, mirror) {
    this.persistence = persistence
    this.mirror = mirror
    this.unsubscribe = undefined
    this.deriveCalls = 0
    this.snapshot = {
      status: persistence === 'host' ? 'loading' : 'unavailable',
      mode: persistence
    }
    this.store = {
      update: (mutate) => mutate(this.snapshot)
    }
  }

  derive() {
    this.deriveCalls += 1
    if (this.mirror.view !== undefined) this.snapshot.status = 'ready'
  }
}

export class SettingsDescribeMirror {
  constructor(persistence) {
    this.persistence = persistence
    this.loadCalls = 0
    this.view = undefined
    this.listeners = new Set()
  }

  load() {
    this.loadCalls += 1
    if (this.persistence === 'host') this.view = { namespaces: [] }
    for (const listener of this.listeners) listener()
    return Promise.resolve()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export class SettingsScopeBinder {
  constructor(mirror) {
    this.mirror = mirror
  }

  describe() {
    return this.mirror
  }
}
