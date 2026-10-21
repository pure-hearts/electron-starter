/** 主进程启动顺序集中在这里：先安全与 IPC，最后创建窗口。 */
import { createMainWindow } from './window'
import { registerIPC } from './ipc'
import { registerResourceProtocol, processDeepLinkArgs } from './modules/protocol'
import { initCrashRecovery } from './modules/crash'
import { initLogger, log } from './modules/logger'
import { initDownloads } from './modules/download'
import { createMenu } from './modules/menu'
import { createTray } from './modules/tray'
import { initUpdater } from './modules/updater'
import { recoverPendingUpdate } from './modules/hot-update'
import { configureSessionSecurity } from './session-security'
import { registerSmokeChecks } from './smoke'
// 防止重复调用导致系统托盘、更新事件和窗口重复注册。
let bootstrapped = false
export function bootstrapMain(): void {
  if (bootstrapped) return
  bootstrapped = true
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
}
