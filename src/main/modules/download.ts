/** Electron 下载适配器：会话、系统路径与持久化留在此处，业务状态由 DownloadManager 管理。 */
import { app, session } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'
import Store from 'electron-store'
import type { DownloadItem, WebContents } from 'electron'
import { broadcast } from '../window'
import { DownloadManager } from './download-manager'
import { log } from './logger'
import { notifyBusiness } from './notification'

let downloadSettings: Store<{ concurrency: number }> | null = null
function currentDownloadSettings(): Store<{ concurrency: number }> {
  downloadSettings ??= new Store<{ concurrency: number }>({
    name: 'download-settings', defaults: { concurrency: 10 }, clearInvalidConfig: true
  })
  return downloadSettings
}
/** 对被手工编辑或旧版本写入的值做校正，并将恢复值写回避免每次启动重复遇到坏配置。 */
export function getDownloadConcurrency(): number {
  const store = currentDownloadSettings()
  const value: unknown = store.get('concurrency')
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 50) return value
  store.set('concurrency', 10)
  return 10
}
let manager: DownloadManager | null = null
let removeSessionListener: (() => void) | null = null
/** 配置写入成功之后才改变运行上限，避免磁盘失败造成 UI、队列与下次启动配置不一致。 */
export function setDownloadConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 50)
    throw new RangeError('Download concurrency must be between 1 and 50')
  currentDownloadSettings().set('concurrency', value)
  manager?.setConcurrency(value)
  return value
}
export function initDownloads(): void {
  if (manager) return
  const next = new DownloadManager({
    id: () => crypto.randomUUID(),
    destination: (id, filename) => {
      // basename 同时剥离两个平台的路径分隔符；下载文件名不能控制保存目录。
      const name = path.posix.basename(path.win32.basename(filename)) || 'download'
      return path.join(app.getPath('downloads'), id + '-' + name)
    },
    emit: state => {
      broadcast('download:state', state)
      if (state.state === 'completed' || state.state === 'failed') notifyBusiness({
        title: state.state === 'completed' ? '下载完成' : '下载失败',
        body: state.state === 'completed' ? '文件已保存到下载文件夹' : '请在下载列表查看状态并重试',
        kind: state.state === 'completed' ? 'success' : 'error', dedupeKey: 'download:' + state.id
      })
    },
    report: error => log.warn('Download operation failed', error)
  })
  // 初始化完全成功后才发布 manager；失败时不会留下假初始化标志。
  next.setConcurrency(getDownloadConcurrency())
  const target = session.defaultSession
  const onDownload = (_event: unknown, item: DownloadItem) => next.accept(item)
  target.on('will-download', onDownload)
  manager = next
  removeSessionListener = () => target.removeListener('will-download', onDownload)
}
function currentManager(): DownloadManager {
  if (!manager) throw new Error('Download manager is not initialized')
  return manager
}
export function startDownload(url: string, sender: WebContents): string { return currentManager().start(url, sender) }
export function controlDownload(id: string, action: 'cancel' | 'pause' | 'resume'): void { currentManager().control(id, action) }
export function retryDownload(id: string, sender: WebContents): string { return currentManager().retry(id, sender) }
/** Bootstrap 回滚和应用退出共享此入口，只移除本模块持有的监听器。 */
export function disposeDownloads(): void {
  const previous = manager
  manager = null
  removeSessionListener?.()
  removeSessionListener = null
  previous?.dispose()
}
