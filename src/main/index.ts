/**
 * Electron 主进程入口。启动顺序：
 * 申请单实例锁 → 等待 app.whenReady → 设置安全策略 → 注册 IPC → 创建主窗口。
 * 此进程能访问操作系统和 Node.js，页面必须通过受控 Preload 桥梁调用能力。
 */
import { app, session, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createMainWindow, focusMainWindow, openChild } from './window'
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
// 阻止同时运行多个实例；第二次启动的命令行参数转交给已存在的实例。
const single = app.requestSingleInstanceLock()
if (!single) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    processDeepLinkArgs(argv)
  })
  registerDeepLink()
  // Electron 初始化完成之后才能安全使用窗口、托盘等桌面模块。
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
    // 必须先注册消息处理器，再加载可能调用 window.desktop 的页面。
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
          // Exercise a real child BrowserWindow with sandboxed preload and IPC.
          const childId = openChild('/playground')
          const child = BrowserWindow.fromId(childId)
          if (!child) throw new Error('Child window was not created')
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Child window navigation timeout')), 8000)
            child.webContents.once('did-finish-load', () => { clearTimeout(timer); resolve() })
            child.webContents.once('did-fail-load', (_event, code) => {
              clearTimeout(timer)
              reject(new Error('Child window navigation failed: ' + code))
            })
          })
          const childVersion = await child.webContents.executeJavaScript("window.desktop.invoke('app:version')")
          if (childVersion !== version) throw new Error('Child preload IPC failed')
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Child window close timeout')), 5000)
            child.once('closed', () => { clearTimeout(timer); resolve() })
            child.close()
          })
          if (!child.isDestroyed()) throw new Error('Child window was not destroyed')
          // Exercise typed persistent writes and cleanup through the renderer bridge.
          const oldTheme = await main.webContents.executeJavaScript("window.desktop.invoke('store:get', 'theme')")
          await main.webContents.executeJavaScript("window.desktop.invoke('store:set', 'theme', 'dark')")
          const newTheme = await main.webContents.executeJavaScript("window.desktop.invoke('store:get', 'theme')")
          if (newTheme !== 'dark') throw new Error('Persistent setting write/read failed')
          await main.webContents.executeJavaScript("window.desktop.invoke('store:set', 'theme', " + JSON.stringify(oldTheme === 'dark' || oldTheme === 'system' ? oldTheme : 'light') + ")")
          if (app.isPackaged && process.platform === 'linux' && process.env.XDG_CONFIG_HOME) {
            // Only change an isolated CI XDG directory, never the runner's real autostart.
            const before = await main.webContents.executeJavaScript("window.desktop.invoke('startup:get')")
            if (before !== false) throw new Error('Temporary XDG autostart was not empty')
            const enabled = await main.webContents.executeJavaScript("window.desktop.invoke('startup:set', true)")
            const current = await main.webContents.executeJavaScript("window.desktop.invoke('startup:get')")
            const startupFile = path.join(process.env.XDG_CONFIG_HOME, 'autostart', 'electron-starter.desktop')
            const entry = fs.readFileSync(startupFile, 'utf8')
            if (enabled !== true || current !== true || !entry.includes('Type=Application') || !entry.includes('Exec=')) {
              throw new Error('Linux packaged autostart enable failed')
            }
            const disabled = await main.webContents.executeJavaScript("window.desktop.invoke('startup:set', false)")
            if (disabled !== false || fs.existsSync(startupFile)) throw new Error('Linux packaged autostart removal failed')
          }
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
