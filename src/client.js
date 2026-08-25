// Browser half of dsh-trusted-host-proxy-403-fix.
//
// DSH 0.1.1-rc.2 centralizes settings reads in a SettingsDescribeMirror and
// deliberately leaves that mirror unavailable when connection.isLoopback is
// false. This package's server half already admits privileged RPCs only for
// authorities explicitly listed in --trusted-host, with the official
// Host/Origin request fence in front of them. The browser half therefore
// upgrades that authenticated reverse-proxy deployment to the same host-backed
// settings mode as a loopback page.
window.__ModuleLoader__.load({
  id: 'dsh-trusted-host-proxy-403-fix',
  factory: function () {
    var module = { exports: {} }
    var exports = module.exports

    function upgradeController(service) {
      if (!service) return
      var host = service.host
      if (!host || host.persistence !== 'memory') return
      host.persistence = 'host'
      if (host.store && typeof host.store.update === 'function') {
        host.store.update(function (draft) {
          draft.mode = 'host'
          if (draft.status === 'unavailable') draft.status = 'loading'
        })
      }
      if (
        host.unsubscribe === undefined &&
        host.mirror &&
        typeof host.mirror.subscribe === 'function' &&
        typeof host.derive === 'function'
      ) {
        host.unsubscribe = host.mirror.subscribe(function () {
          host.derive()
        })
      }
      if (typeof host.derive === 'function') host.derive()
    }

    function upgradeMirror(settingsScope) {
      if (!settingsScope || typeof settingsScope.describe !== 'function') return
      var mirror = settingsScope.describe()
      if (!mirror || typeof mirror.load !== 'function') return
      if (mirror.persistence === 'memory') mirror.persistence = 'host'
      // load(), rather than ensure(), also recovers a mirror whose initial
      // non-loopback state is the terminal "unavailable" state.
      mirror.load()
    }

    function apply(ctx) {
      var connection = ctx.get('connection')
      if (connection) connection.isLoopback = true

      // These scopes are created before this plugin applies. Future scopes see
      // connection.isLoopback=true and are constructed in host mode directly.
      upgradeController(ctx.get('locale'))
      upgradeController(ctx.get('theme'))
      // Subscribe existing scopes before the mirror publishes its first view.
      upgradeMirror(ctx.get('settingsScope'))
    }

    exports.apply = apply
    exports.inject = ['connection', 'settingsScope', 'locale', 'theme']
    return module.exports
  }
})
