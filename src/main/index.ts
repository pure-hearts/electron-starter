/**
 * Electron 主进程入口。启动顺序：
 * 申请单实例锁 → 等待 app.whenReady → 设置安全策略 → 注册 IPC → 创建主窗口。
 * 此进程能访问操作系统和 Node.js，页面必须通过受控 Preload 桥梁调用能力。
 */
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
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
import { platform } from './platform'
import { configureSessionSecurity } from './session-security'
import { registerSmokeChecks } from './smoke'
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
  // Electron 初始化完成之后才能安全使用窗口、托盘等桌面模块。
  app.whenReady().then(() => {
    // 日志最先初始化，确保后续模块初始化失败时有诊断记录。
    initLogger()
    // 启动时检查上一次热更新是否中断，必要时恢复到安全资源版本。
    recoverPendingUpdate()
    // app:// 协议让正式构建能够通过受控 URL 加载应用内的页面资源。
    registerResourceProtocol()
    configureSessionSecurity()
    // 必须先注册消息处理器，再加载可能调用 window.$ipcBridge 的页面。
    registerIPC()
    initDownloads()
    // electron-updater 负责整包更新，不等同于 ZIP 渲染资源热更新。
    initUpdater()
    initCrashRecovery()
    createMenu()
    // 托盘独立于主窗口，启用关闭到托盘时应用可继续在后台运行。
    createTray()
    // 功能处理器均已准备好后，才创建加载 Vue 页面内容的主窗口。
    const main = createMainWindow()
    main.webContents.on('did-fail-load', (_event, code, desc) => log.error('Main window failed', code, desc))
    processDeepLinkArgs(process.argv)
    registerSmokeChecks(main)

  }).catch(err => { log.error('Startup failure', err); app.quit() })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); else focusMainWindow() })
  // macOS 默认允许关闭全部窗口后应用仍留在 Dock；其他系统通常退出。
  app.on('window-all-closed', () => {
    if (!platform.isMac && getSetting('closeToTray') !== true) app.quit()
  })
  app.on('before-quit', () => { markQuitting() })
  // 应用即将退出时销毁托盘，释放操作系统持有的图标与菜单资源。
  app.on('will-quit', destroyTray)
}
