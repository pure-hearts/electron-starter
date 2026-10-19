import log from 'electron-log/main'
import { app } from 'electron'
export { log }
export function initLogger() {
  log.initialize({ spyRendererConsole: false })
  log.transports.file.level = process.env.APP_LOG_LEVEL === 'debug' ? 'debug' : 'info'
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.info('Application starting', app.getVersion(), process.platform)
}
export function writeRendererLog(level: 'info'|'warn'|'error', message: string) {
  log[level]('[renderer]', message.slice(0, 2048))
}
