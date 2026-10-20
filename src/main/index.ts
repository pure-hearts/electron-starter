import { app, session, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createMainWindow, focusMainWindow } from './window'
import { registerIPC } from './ipc'
import { registerResourceProtocol, registerDeepLink, processDeepLinkArgs } from './modules/protocol'
import { initCrashRecovery } from './modules/crash'
import { initLogger, log } from './modules/logger'
import { initDownloads } from './modules/download'
import { createMenu } from './modules/menu'
import { createTray, destroyTray } from './modules/tray'
import { initUpdater } from './modules/updater'
import { recoverPendingUpdate, checkHotUpdate, activeRendererRoot } from './modules/hot-update'
import { getSetting } from './modules/store'
import { markQuitting } from './modules/lifecycle'
if (process.env.ELECTRON_STARTER_TEST_USERDATA) {
  fs.mkdirSync(process.env.ELECTRON_STARTER_TEST_USERDATA, { recursive: true })
  app.setPath('userData', process.env.ELECTRON_STARTER_TEST_USERDATA)
}
const single = app.requestSingleInstanceLock()
if (!single) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    processDeepLinkArgs(argv)
  })
  registerDeepLink()
  app.whenReady().then(() => {
    initLogger()
    recoverPendingUpdate()
    registerResourceProtocol()
    if (!process.env.VITE_DEV_SERVER_URL) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (details.url.startsWith('app://renderer/')) {
          callback({ responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; object-src 'none'; frame-src 'none'; base-uri 'none'"]
          } })
        } else callback({ responseHeaders: details.responseHeaders })
      })
    }
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    registerIPC()
    initDownloads()
    initUpdater()
    initCrashRecovery()
    createMenu()
    createTray()
    const main = createMainWindow()
    main.webContents.on('did-fail-load', (_event, code, desc) => log.error('Main window failed', code, desc))
    processDeepLinkArgs(process.argv)
    // CI-only installed-app hot-update integration tests. No test server, credentials
    // or switches are enabled in ordinary application operation.
    if (process.env.ELECTRON_STARTER_HOT_SMOKE) {
      const mode = process.env.ELECTRON_STARTER_HOT_SMOKE
      const timeout = setTimeout(() => { log.error('Hot update smoke timed out'); app.exit(1) }, 20000)
      if (mode === 'abort') {
        clearTimeout(timeout)
        app.exit(0)
      } else {
        main.webContents.once('did-finish-load', async () => {
          try {
            if (mode === 'stage') {
              const result = await checkHotUpdate()
              if (result.status !== 'ready') throw new Error('Hot update not staged: ' + JSON.stringify(result))
            } else if (mode === 'active' || mode === 'rollback') {
              await new Promise(resolve => setTimeout(resolve, 3600))
              const pointer = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'renderer-updates', 'current.json'), 'utf8')) as { revision:number; phase:string }
              const expected = Number(process.env.ELECTRON_STARTER_EXPECT_REVISION)
              if (pointer.phase !== 'active' || pointer.revision !== expected || !activeRendererRoot().endsWith('rev-' + expected)) {
                throw new Error('Unexpected hot update state: ' + JSON.stringify(pointer))
              }
            } else throw new Error('Unknown hot smoke mode')
            clearTimeout(timeout)
            log.info('Installed hot-update smoke passed:', mode)
            app.exit(0)
          } catch (error) { clearTimeout(timeout); log.error('Hot smoke failed', error); app.exit(1) }
        })
      }
    }
    if (process.env.ELECTRON_STARTER_SMOKE === '1') {
      const timeout = setTimeout(() => { log.error('Smoke test timed out'); app.exit(1) }, 20000)
      main.webContents.once('did-finish-load', async () => {
        try {
          const version = await main.webContents.executeJavaScript(`window.desktop.invoke('app:version')`)
          const persisted = await main.webContents.executeJavaScript(`window.desktop.invoke('store:get','locale')`)
          if (version !== app.getVersion() || typeof persisted !== 'string') throw new Error('Preload / IPC smoke check failed')
          clearTimeout(timeout)
          log.info('Electron smoke test passed', version)
          app.exit(0)
        } catch (error) { clearTimeout(timeout); log.error('Electron smoke failure', error); app.exit(1) }
      })
    }
  }).catch(err => { log.error('Startup failure', err); app.quit() })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); else focusMainWindow() })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && getSetting('closeToTray') !== true) app.quit()
  })
  app.on('before-quit', () => { markQuitting() })
  app.on('will-quit', destroyTray)
}
