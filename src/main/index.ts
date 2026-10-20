import { app, session, BrowserWindow } from 'electron'
import { createMainWindow, focusMainWindow } from './window'
import { registerIPC } from './ipc'
import { registerResourceProtocol, registerDeepLink, processDeepLinkArgs } from './modules/protocol'
import { initCrashRecovery } from './modules/crash'
import { initLogger, log } from './modules/logger'
import { initDownloads } from './modules/download'
import { createMenu } from './modules/menu'
import { createTray, destroyTray } from './modules/tray'
import { initUpdater } from './modules/updater'
import { recoverPendingUpdate } from './modules/hot-update'
import { getSetting } from './modules/store'
import { markQuitting } from './modules/lifecycle'
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
  }).catch(err => { log.error('Startup failure', err); app.quit() })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); else focusMainWindow() })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && getSetting('closeToTray') !== true) app.quit()
  })
  app.on('before-quit', () => { markQuitting() })
  app.on('will-quit', destroyTray)
}
