/** 仅供隔离的 CI 运行时验收，生产正常运行不启用。 */
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { BrowserWindow as ElectronWindow } from 'electron'
import { openChild } from '../window'
import { log } from '../modules/core/logger'
import { checkHotUpdate, activeRendererRoot } from '../modules/update/hot'
import { platform } from '../platform'

export function registerSmokeChecks(main: ElectronWindow): void {
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
  // 自动化 Smoke Test：启动真实 Electron 窗口，调用 Preload IPC 并验证子窗口。
  if (process.env.ELECTRON_STARTER_SMOKE === '1') {
    const timeout = setTimeout(() => { log.error('Smoke test timed out'); app.exit(1) }, 20000)
    main.webContents.once('did-finish-load', async () => {
      try {
        const version = await main.webContents.executeJavaScript(`window.$ipcBridge.invoke('app:version')`)
        const persisted = await main.webContents.executeJavaScript(`window.$ipcBridge.invoke('store:get','locale')`)
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
        const childVersion = await child.webContents.executeJavaScript("window.$ipcBridge.invoke('app:version')")
        if (childVersion !== version) throw new Error('Child preload IPC failed')
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Child window close timeout')), 5000)
          child.once('closed', () => { clearTimeout(timer); resolve() })
          child.close()
        })
        if (!child.isDestroyed()) throw new Error('Child window was not destroyed')
        // Exercise typed persistent writes and cleanup through the renderer bridge.
        const oldTheme = await main.webContents.executeJavaScript("window.$ipcBridge.invoke('store:get', 'theme')")
        await main.webContents.executeJavaScript("window.$ipcBridge.invoke('store:set', 'theme', 'dark')")
        const newTheme = await main.webContents.executeJavaScript("window.$ipcBridge.invoke('store:get', 'theme')")
        if (newTheme !== 'dark') throw new Error('Persistent setting write/read failed')
        await main.webContents.executeJavaScript("window.$ipcBridge.invoke('store:set', 'theme', " + JSON.stringify(oldTheme === 'dark' || oldTheme === 'system' ? oldTheme : 'light') + ")")
        if (app.isPackaged && platform.isLinux && process.env.XDG_CONFIG_HOME) {
          // Only change an isolated CI XDG directory, never the runner's real autostart.
          const before = await main.webContents.executeJavaScript("window.$ipcBridge.invoke('startup:get')")
          if (before !== false) throw new Error('Temporary XDG autostart was not empty')
          const enabled = await main.webContents.executeJavaScript("window.$ipcBridge.invoke('startup:set', true)")
          const current = await main.webContents.executeJavaScript("window.$ipcBridge.invoke('startup:get')")
          const startupFile = path.join(process.env.XDG_CONFIG_HOME, 'autostart', 'electron-starter.desktop')
          const entry = fs.readFileSync(startupFile, 'utf8')
          if (enabled !== true || current !== true || !entry.includes('Type=Application') || !entry.includes('Exec=')) {
            throw new Error('Linux packaged autostart enable failed')
          }
          const disabled = await main.webContents.executeJavaScript("window.$ipcBridge.invoke('startup:set', false)")
          if (disabled !== false || fs.existsSync(startupFile)) throw new Error('Linux packaged autostart removal failed')
        }
        clearTimeout(timeout)
        log.info('Electron smoke test passed', version)
        app.exit(0)
      } catch (error) { clearTimeout(timeout); log.error('Electron smoke failure', error); app.exit(1) }
    })
  }
}
