import { app, dialog, BrowserWindow } from 'electron'
import { log } from './logger'
const crashTimes: number[] = []
export function initCrashRecovery() {
  app.on('render-process-gone', (_event, contents, details) => {
    log.error('Renderer gone', details.reason, details.exitCode)
    const win = BrowserWindow.fromWebContents(contents)
    if (!win || win.isDestroyed()) return
    const now = Date.now()
    crashTimes.push(now)
    while (crashTimes.length && crashTimes[0] < now - 60_000) crashTimes.shift()
    if (crashTimes.length > 2) {
      void dialog.showMessageBox(win, { type: 'error', message: '应用多次崩溃，请退出并查看日志。', buttons: ['确定'] })
      return
    }
    void dialog.showMessageBox(win, { type: 'warning', message: '页面异常退出，是否重新加载？', buttons: ['恢复', '取消'] }).then(res => {
      if (res.response === 0 && !win.isDestroyed()) win.reload()
    })
  })
  app.on('child-process-gone', (_e, details) => log.error('Child process gone', details.type, details.reason))
  process.on('uncaughtException', error => log.error('Uncaught exception', error))
  process.on('unhandledRejection', reason => log.error('Unhandled rejection', reason))
}
