import { platform } from '../../platform'
/** electron-log 日志入口：在主进程写诊断日志，并限制渲染层日志内容。 */
import log from 'electron-log/main'
import { app } from 'electron'
import { redactLogMessage } from './log-redaction'
// 统一导出 logger，其他主进程模块共享相同的日志设置。
export { log }
/** 初始化文件日志；不自动镜像全部网页 console，减少无关与敏感内容。 */
export function initLogger() {
  // Electron 主进程启动后才初始化日志传输器。
  log.initialize({ spyRendererConsole: false })
  // 仅在显式设置环境变量时记录 debug，默认保留 info 及更高等级。
  log.transports.file.level = process.env.APP_LOG_LEVEL === 'debug' ? 'debug' : 'info'
  // 限制单个日志文件大小，减少长期运行占用的磁盘空间。
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.info('Application starting', app.getVersion(), platform.current)
}
/** 将网页日志标记为 renderer，先脱敏再截断长度后写入磁盘。 */
export function writeRendererLog(level: 'info'|'warn'|'error', message: string) {
  log[level]('[renderer]', redactLogMessage(message).slice(0, 2048))
}
