/** Electron 应用级生命周期统一在此注册，避免主入口承担窗口与系统事件细节。 */
import { app, BrowserWindow } from 'electron'
import { createMainWindow, focusMainWindow } from './window'
import { processDeepLinkArgs } from './modules/protocol'
import { destroyTray } from './modules/tray'
import { getSetting } from './modules/store'
import { markQuitting } from './modules/lifecycle'
import { platform } from './platform'

/** 必须在成功取得单实例锁之后注册，确保只有主实例接收唤醒事件。 */
export function registerAppLifecycle(): void {
  // 新启动的第二实例把命令行中的 Deep Link 转交主窗口。
  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    processDeepLinkArgs(argv)
  })
  // macOS Dock 激活时恢复已存在窗口；窗口已销毁则重新创建。
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else focusMainWindow()
  })
  // 非 macOS 且未启用关闭到托盘时，关闭最后一个窗口应退出应用。
  app.on('window-all-closed', () => {
    if (!platform.isMac && getSetting('closeToTray') !== true) app.quit()
  })
  // 窗口 close 事件依赖退出标记，须在真正退出时标识并释放托盘。
  app.on('before-quit', markQuitting)
  app.on('will-quit', destroyTray)
}
