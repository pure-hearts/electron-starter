/**
 * Electron 主进程入口。启动顺序：
 * 申请单实例锁 → 等待 app.whenReady → 设置安全策略 → 注册 IPC → 创建主窗口。
 * 此进程能访问操作系统和 Node.js，页面必须通过受控 Preload 桥梁调用能力。
 */
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import { createMainWindow, focusMainWindow } from './window'
import { registerDeepLink, processDeepLinkArgs } from './modules/protocol'
import { log } from './modules/logger'
import { destroyTray } from './modules/tray'
import { getSetting } from './modules/store'
import { markQuitting } from './modules/lifecycle'
import { platform } from './platform'
import { bootstrapMain } from './bootstrap'
// 自动化测试可隔离 userData 目录，避免覆盖真实用户的配置和缓存。
if (process.env.ELECTRON_STARTER_TEST_USERDATA) {
  fs.mkdirSync(process.env.ELECTRON_STARTER_TEST_USERDATA, { recursive: true })
  app.setPath('userData', process.env.ELECTRON_STARTER_TEST_USERDATA)
}
// 阻止同时运行多个实例；第二次启动的命令行参数转交给已存在的实例。
const single = app.requestSingleInstanceLock()
if (!single) {
  app.quit()
} else {
  // 第二次启动时不会再创建实例，而是唤醒主窗口并处理 Deep Link 参数。
  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    processDeepLinkArgs(argv)
  })
  registerDeepLink()
  app.whenReady().then(bootstrapMain).catch(err => { log.error('Startup failure', err); app.quit() })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); else focusMainWindow() })
  // macOS 默认允许关闭全部窗口后应用仍留在 Dock；其他系统通常退出。
  app.on('window-all-closed', () => {
    if (!platform.isMac && getSetting('closeToTray') !== true) app.quit()
  })
  app.on('before-quit', () => { markQuitting() })
  // 应用即将退出时销毁托盘，释放操作系统持有的图标与菜单资源。
  app.on('will-quit', destroyTray)
}
