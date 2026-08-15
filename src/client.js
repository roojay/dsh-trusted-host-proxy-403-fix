// Browser half of dsh-trusted-host-proxy-403-fix.
//
// The server half lets requests from --trusted-host authorities reach the
// privileged /api methods (settings.*, credentials.*, ...). The browser half
// fixes the OTHER half of the same deployment: outside the loopback the
// official SettingsScopeController runs in "memory" persistence mode and
// silently drops every settings write, which is why the Language (and
// Appearance, Composer Enter, ...) choices never survive a page reload when
// the UI is reached through a proxy host even though the server half already
// accepts the RPCs.
//
// This bundle upgrades those controllers to "host" persistence:
//   1. It patches SettingsScopeController.prototype.enqueue so the "memory"
//      short-circuit stops swallowing reads/writes. The settings RPCs are
//      loopback-only upstream; this plugin's server half is what makes them
//      reachable for trusted hosts, so the patch only changes behavior where
//      the server half is installed. Without it (or for an untrusted host)
//      the RPC fails with 403 and the official controllers keep their
//      fail-closed behavior (catch-and-ignore), exactly as before.
//   2. It upgrades the controllers it can reach through public services
//      (locale.host, theme.host) in place — persistence is a plain instance
//      field — and triggers load() so an already-saved preference applies on
//      the first paint without waiting for the user to pick it again.
window.__ModuleLoader__.load({
  id: 'dsh-trusted-host-proxy-403-fix',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    function patchEnqueue() {
      try {
        var uiSettings = require('@deepseek-ai/dsh-client-ui-settings')
        var Controller = uiSettings.SettingsScopeController
        if (!Controller || !Controller.prototype) return false
        if (typeof Controller.prototype.enqueue !== 'function') return false
        if (Controller.prototype.enqueue.__dshTrustedHostPatched) return true
        Controller.prototype.enqueue = function (operation) {
          // Same queued-operation chain as the official implementation, minus
          // the "memory" persistence short-circuit that drops every operation.
          if (this.disposed) return Promise.resolve()
          var self = this
          var task = this.tail.then(async function () {
            if (self.disposed) return
            await operation()
          })
          this.tail = task.catch(function () {})
          return task
        }
        Controller.prototype.enqueue.__dshTrustedHostPatched = true
        return true
      } catch (err) {
        // The ui-settings bundle is not reachable through the module table
        // (should not happen in the web profile): the per-service upgrade
        // below still works, so fail soft instead of breaking boot.
        return false
      }
    }

    function upgrade(service) {
      if (!service) return
      var host = service.host
      if (!host || typeof host.load !== 'function') return
      if (host.persistence === 'memory') host.persistence = 'host'
      host.load()
    }

    function apply(ctx) {
      patchEnqueue()
      upgrade(ctx.get('locale'))
      upgrade(ctx.get('theme'))
    }

    exports.apply = apply
    // Cordis service names. Package graph uses dsh.client.inject in package.json.
    exports.inject = ['locale', 'theme']
    return module.exports
  }
})
