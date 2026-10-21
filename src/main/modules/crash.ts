/** 主进程统一监听 Renderer/子进程崩溃与未捕获异常，提供有限次数的恢复入口。 */
import { app, dialog, BrowserWindow } from 'electron'
import { log } from './logger'
import { RecoveryPolicy } from './recovery-policy'
// RecoveryPolicy 限制连续崩溃后不断重载所造成的循环。
const recovery = new RecoveryPolicy()
/** 安装 Electron 应用与 Node.js 进程异常监听器。 */
export function initCrashRecovery() {
  // Electron 报告某个网页渲染进程退出时，在主进程定位对应窗口。
  app.on('render-process-gone', (_event, contents, details) => {
    log.error('Renderer gone', details.reason, details.exitCode)
    // 只有还存在的 BrowserWindow 才能显示恢复对话框。
    const win = BrowserWindow.fromWebContents(contents)
    if (!win || win.isDestroyed()) return
    // 最近一段时间重启次数过多时禁止再次自动引导恢复。
    if (!recovery.canRecover()) {
      void dialog.showMessageBox(win, { type: 'error', message: '应用多次崩溃，请退出并查看日志。', buttons: ['确定'] })
      return
    }
    // 用户明确选择恢复后才重新加载页面，避免意外丢失未保存状态。
    void dialog.showMessageBox(win, { type: 'warning', message: '页面异常退出，是否重新加载？', buttons: ['恢复', '取消'] }).then(res => {
      if (res.response === 0 && !win.isDestroyed()) win.reload()
    })
  })
  // 记录 Electron 工具/子进程异常，便于排查系统环境问题。
  app.on('child-process-gone', (_e, details) => log.error('Child process gone', details.type, details.reason))
  // 捕获未处理的同步异常并记日志；这不保证进程还能安全继续运行。
  process.on('uncaughtException', error => log.error('Uncaught exception', error))
  // 捕获未处理的异步 Promise 拒绝，帮助定位业务异常。
  process.on('unhandledRejection', reason => log.error('Unhandled rejection', reason))
}
