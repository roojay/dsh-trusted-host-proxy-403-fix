// Browser half of dsh-trusted-host-proxy-403-fix.
//
// DSH 0.1.5-rc.2 centralizes settings reads in a SettingsDescribeMirror and
// deliberately leaves that mirror unavailable when connection.isLoopback is
// false. This package's server half already admits privileged RPCs only for
// authorities explicitly listed in --trusted-host, with the official
// Host/Origin request fence applied before bypassing the cookie 401. The
// browser half therefore
// upgrades that authenticated reverse-proxy deployment to the same host-backed
// settings mode as a loopback page.
window.__ModuleLoader__.load({
  id: 'dsh-trusted-host-proxy-403-fix',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    var VIEWER_NS = 'trusted-host-config-viewer'
    var viewerLocales = {
      zh: {
        viewConfig: '查看生效配置',
        title: '当前生效配置',
        note: '展示当前 DSH 进程的脱敏生效值；密钥和令牌不会返回到浏览器。',
        yaml: 'YAML',
        json: 'JSON',
        refresh: '刷新',
        copy: '复制',
        copied: '已复制',
        close: '关闭',
        loading: '正在读取生效配置……',
        empty: '当前没有可展示的配置。',
        error: '读取生效配置失败'
      },
      en: {
        viewConfig: 'View effective config',
        title: 'Effective configuration',
        note: 'Shows redacted values used by the current DSH process. Secrets and tokens are never returned to the browser.',
        yaml: 'YAML',
        json: 'JSON',
        refresh: 'Refresh',
        copy: 'Copy',
        copied: 'Copied',
        close: 'Close',
        loading: 'Loading effective configuration…',
        empty: 'There is no configuration to display.',
        error: 'Could not load effective configuration'
      }
    }

    function isContainer(value) {
      return value !== null && typeof value === 'object'
    }

    function yamlKey(value) {
      return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) &&
        !/^(?:null|true|false|yes|no|on|off)$/i.test(value)
        ? value
        : JSON.stringify(value)
    }

    function yamlScalar(value) {
      if (value === null) return 'null'
      if (typeof value === 'boolean' || typeof value === 'number') return String(value)
      return JSON.stringify(String(value))
    }

    function toYaml(value, depth) {
      var level = depth || 0
      var indent = '  '.repeat(level)
      if (Array.isArray(value)) {
        if (value.length === 0) return indent + '[]'
        return value.map(function (item) {
          if (isContainer(item)) return indent + '-\n' + toYaml(item, level + 1)
          return indent + '- ' + yamlScalar(item)
        }).join('\n')
      }
      if (isContainer(value)) {
        var entries = Object.entries(value)
        if (entries.length === 0) return indent + '{}'
        return entries.map(function (entry) {
          var key = yamlKey(entry[0])
          var item = entry[1]
          if (isContainer(item)) return indent + key + ':\n' + toYaml(item, level + 1)
          return indent + key + ': ' + yamlScalar(item)
        }).join('\n')
      }
      return indent + yamlScalar(value)
    }

    function effectiveConfig(view) {
      var config = {}
      var namespaces = view && Array.isArray(view.namespaces) ? view.namespaces : []
      namespaces.forEach(function (namespace) {
        if (!namespace || typeof namespace.ns !== 'string') return
        Object.defineProperty(config, namespace.ns, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: namespace.value
        })
      })
      return config
    }

    function messageOf(error) {
      if (error && typeof error.message === 'string') return error.message
      return String(error)
    }

    function addViewerStyles() {
      if (typeof document === 'undefined') return
      var id = 'dsh-trusted-host-config-viewer'
      if (document.querySelector('style[data-plugin-css="' + id + '"]')) return
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-trusted-host-proxy-403-fix'
      tag.dataset.pluginCss = id
      tag.textContent = [
        '.dshTrustedConfigAction{box-sizing:border-box;cursor:pointer;height:32px;color:var(--dsw-alias-label-primary,#20242c);background:transparent;border:1px solid var(--dsw-alias-border-primary,#d8dde6);border-radius:9px;padding:0 12px;font:inherit;font-size:13px;white-space:nowrap}',
        '.dshTrustedConfigAction:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f4f7)}',
        '.dshTrustedConfigDialog{box-sizing:border-box;width:min(900px,calc(100vw - 24px));height:min(760px,calc(100vh - 24px));max-width:none;max-height:none;color:var(--dsw-alias-label-primary,#20242c);background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border-primary,#d8dde6);border-radius:20px;padding:0;box-shadow:0 20px 60px #0004}',
        '.dshTrustedConfigDialog::backdrop{background:#0008;backdrop-filter:blur(3px)}',
        '.dshTrustedConfigLayout{box-sizing:border-box;height:100%;display:flex;flex-direction:column;padding:18px;gap:12px}',
        '.dshTrustedConfigHeader{display:flex;align-items:flex-start;gap:12px}',
        '.dshTrustedConfigHeading{flex:1;min-width:0}',
        '.dshTrustedConfigTitle{margin:0;font-size:18px;line-height:26px}',
        '.dshTrustedConfigNote{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#697386);font-size:12px;line-height:18px}',
        '.dshTrustedConfigTools{display:flex;flex-wrap:wrap;gap:8px}',
        '.dshTrustedConfigButton{cursor:pointer;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-primary,#d8dde6);border-radius:8px;padding:6px 10px;font:inherit;font-size:12px}',
        '.dshTrustedConfigButton[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover,#eef1f5);font-weight:600}',
        '.dshTrustedConfigContent{box-sizing:border-box;flex:1;min-height:0;margin:0;color:var(--dsw-alias-label-primary,#20242c);background:var(--dsw-alias-bg-layer-1,#f6f7f9);border:1px solid var(--dsw-alias-border-primary,#d8dde6);border-radius:12px;padding:14px;overflow:auto;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;tab-size:2;direction:ltr;text-align:left}',
        '.dshTrustedConfigStatus{min-height:18px;color:var(--dsw-alias-label-secondary,#697386);font-size:12px}',
        '.dshTrustedConfigStatus[data-error=true]{color:var(--dsw-alias-label-danger,#c73737)}',
        '@media(max-width:600px){.dshTrustedConfigDialog{width:100vw;height:100dvh;border:0;border-radius:0}.dshTrustedConfigLayout{padding:14px}.dshTrustedConfigHeader{flex-direction:column}.dshTrustedConfigTools{width:100%}}'
      ].join('')
      document.head.appendChild(tag)
    }

    function element(tagName, className, text) {
      var node = document.createElement(tagName)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    }

    function copyText(text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text)
      }
      var input = document.createElement('textarea')
      input.value = text
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
      return Promise.resolve()
    }

    function openConfigViewer(remote, t) {
      if (typeof document === 'undefined' || !remote || !remote.settings) return
      addViewerStyles()

      var existing = document.getElementById('dsh-trusted-config-dialog')
      if (existing) {
        if (!existing.open && typeof existing.showModal === 'function') existing.showModal()
        existing.focus()
        return
      }

      var dialog = element('dialog', 'dshTrustedConfigDialog')
      var layout = element('div', 'dshTrustedConfigLayout')
      var header = element('div', 'dshTrustedConfigHeader')
      var heading = element('div', 'dshTrustedConfigHeading')
      var title = element('h2', 'dshTrustedConfigTitle', t('title'))
      var note = element('p', 'dshTrustedConfigNote', t('note'))
      var tools = element('div', 'dshTrustedConfigTools')
      var yamlButton = element('button', 'dshTrustedConfigButton', t('yaml'))
      var jsonButton = element('button', 'dshTrustedConfigButton', t('json'))
      var refreshButton = element('button', 'dshTrustedConfigButton', t('refresh'))
      var copyButton = element('button', 'dshTrustedConfigButton', t('copy'))
      var closeButton = element('button', 'dshTrustedConfigButton', t('close'))
      var content = element('pre', 'dshTrustedConfigContent', t('loading'))
      var status = element('div', 'dshTrustedConfigStatus')
      var formats = { yaml: '', json: '' }
      var format = 'yaml'

      dialog.id = 'dsh-trusted-config-dialog'
      dialog.setAttribute('aria-labelledby', 'dsh-trusted-config-title')
      title.id = 'dsh-trusted-config-title'
      copyButton.disabled = true
      ;[yamlButton, jsonButton, refreshButton, copyButton, closeButton].forEach(function (button) {
        button.type = 'button'
      })

      function render() {
        content.textContent = formats[format] || t('empty')
        yamlButton.setAttribute('aria-pressed', String(format === 'yaml'))
        jsonButton.setAttribute('aria-pressed', String(format === 'json'))
      }

      async function load() {
        refreshButton.disabled = true
        status.dataset.error = 'false'
        status.textContent = t('loading')
        try {
          var result = await remote.settings.describe()
          if (!result || !result.ok) {
            throw new Error(result && result.error ? result.error.message : t('error'))
          }
          var config = effectiveConfig(result.value)
          formats.yaml = toYaml(config) + '\n'
          formats.json = JSON.stringify(config, null, 2) + '\n'
          status.textContent = ''
          copyButton.disabled = false
          render()
        } catch (error) {
          status.dataset.error = 'true'
          status.textContent = t('error') + ': ' + messageOf(error)
          content.textContent = ''
          copyButton.disabled = true
        } finally {
          refreshButton.disabled = false
        }
      }

      yamlButton.addEventListener('click', function () { format = 'yaml'; render() })
      jsonButton.addEventListener('click', function () { format = 'json'; render() })
      refreshButton.addEventListener('click', load)
      copyButton.addEventListener('click', async function () {
        try {
          await copyText(formats[format])
          status.dataset.error = 'false'
          status.textContent = t('copied')
        } catch (error) {
          status.dataset.error = 'true'
          status.textContent = t('error') + ': ' + messageOf(error)
        }
      })
      closeButton.addEventListener('click', function () { dialog.close() })
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close()
      })
      dialog.addEventListener('close', function () { dialog.remove() }, { once: true })

      heading.append(title, note)
      tools.append(yamlButton, jsonButton, refreshButton, copyButton, closeButton)
      header.append(heading, tools)
      layout.append(header, content, status)
      dialog.appendChild(layout)
      document.body.appendChild(dialog)
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      load()
    }

    function ConfigViewerAction(props) {
      return React.createElement('button', {
        type: 'button',
        className: 'dshTrustedConfigAction',
        onClick: function () { props.openViewer(props.t) }
      }, props.t('viewConfig'))
    }

    function installConfigViewer(ctx) {
      var slots = ctx.get('slots')
      var locale = ctx.get('locale')
      var remote = ctx.get('remote')
      if (!slots || !locale || !remote || !remote.settings ||
        typeof remote.settings.describe !== 'function') return

      addViewerStyles()
      ctx.effect(function () {
        return locale.register(VIEWER_NS, viewerLocales)
      }, 'trusted-host-config-viewer: dictionaries')
      slots.inject('settings.action', function () {
        return slots.register({
          name: 'settings.action',
          id: 'open-document',
          order: 0,
          priority: -1,
          locale: VIEWER_NS,
          inject: function () {
            return {
              openViewer: function (t) { openConfigViewer(remote, t) }
            }
          }
        }, ConfigViewerAction)
      })
    }

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

    // Same upgrade as upgradeController, applied directly to a scope controller
    // (the object SettingsScopeBinder.bind returns): its persistence is frozen
    // at construction, so a non-loopback page never subscribes to the mirror and
    // derive() — the only path to "ready" — never runs.
    function upgradeScopeController(controller) {
      if (!controller || controller.persistence !== 'memory') return
      controller.persistence = 'host'
      if (controller.store && typeof controller.store.update === 'function') {
        controller.store.update(function (draft) {
          draft.mode = 'host'
          if (draft.status === 'unavailable') draft.status = 'loading'
        })
      }
      if (
        controller.unsubscribe === undefined &&
        controller.mirror &&
        typeof controller.mirror.subscribe === 'function' &&
        typeof controller.derive === 'function'
      ) {
        controller.unsubscribe = controller.mirror.subscribe(function () {
          controller.derive()
        })
      }
      if (typeof controller.derive === 'function') controller.derive()
    }

    // Plan A: wrap the binder's bind() so every scope created after this plugin
    // applies is upgraded in place. dsh-client-ui-settings-plugins (the four
    // plugin-configuration cards) applies after this plugin, so its binds are
    // caught here; later namespaces are covered automatically. The guard keeps
    // a hot-reload re-apply from stacking wrappers.
    function interceptBind(settingsScope) {
      if (!settingsScope || typeof settingsScope.bind !== 'function') return
      if (settingsScope.__bindUpgradedBy403Fix) return
      var rawBind = settingsScope.bind
      settingsScope.__bindUpgradedBy403Fix = true
      settingsScope.bind = function (spec) {
        var controller = rawBind.call(this, spec)
        upgradeScopeController(controller)
        return controller
      }
    }

    function markHostLoopback(remote) {
      if (!remote || !remote.$host) return
      var host = remote.$host
      // 0.1.2 ui-settings-general reads $host.isLoopback once at apply to
      // build SettingsDocumentStore. A getter keeps the flag true even if a
      // later official write tries to restore the non-loopback snapshot.
      try {
        Object.defineProperty(host, 'isLoopback', {
          configurable: true,
          enumerable: true,
          get: function () { return true },
          set: function () {}
        })
      } catch (err) {
        try { host.isLoopback = true } catch (err2) {}
      }
    }

    function apply(ctx) {
      var connection = ctx.get('connection')
      if (connection) connection.isLoopback = true
      // 0.1.2 settings/credentials read ctx.remote.$host.isLoopback, not
      // connection.isLoopback. Keep both in sync for reverse-proxy Access.
      markHostLoopback(ctx.get('remote'))
      if (typeof ctx.inject === 'function') {
        ctx.inject(['remote'], function (scope) {
          markHostLoopback(scope && scope.remote)
        })
      }

      // These scopes are created before this plugin applies. Future scopes see
      // connection.isLoopback=true and are constructed in host mode directly.
      upgradeController(ctx.get('locale'))
      upgradeController(ctx.get('theme'))
      // Subscribe existing scopes before the mirror publishes its first view.
      var settingsScope = ctx.get('settingsScope')
      upgradeMirror(settingsScope)
      // Scopes bound after this point (the plugin-configuration cards) are
      // upgraded on bind, since they freeze persistence="memory" at construction.
      interceptBind(settingsScope)
      installConfigViewer(ctx)
    }

    exports.apply = apply
    exports.inject = [
      'connection',
      'settingsScope',
      'locale',
      'theme',
      'slots',
      'remote',
      'remote.settings'
    ]
    exports.__test = { effectiveConfig: effectiveConfig, toYaml: toYaml }
    return module.exports
  }
})
