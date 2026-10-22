/** 整包自动更新：使用 electron-updater 下载并安装新的 Electron 应用版本，而不是热替换 Vue 资源。 */
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcast } from '../../../window'
import { log } from '../../core/logger'
import { runtimeConfig } from '../../core/config'
import { UpdateGate } from './gate'
import { validateUpdateFeedUrl } from './feed-url'
import { notifyBusiness } from '../../notification'
// 防止重复绑定 autoUpdater 事件，重复绑定会触发多次页面状态通知。
let configured = false
// 更新门禁：检查中禁止并发请求，下载未完成禁止触发安装。
const gate = new UpdateGate()
/** 初始化 Feed 地址及更新事件监听；应用启动期间通常只调用一次。 */
export function initUpdater() {
  if (configured) return
  // 可以使用自定义 HTTPS Feed；未配置时使用 electron-builder 的发布元数据。
  const url = runtimeConfig().appUpdateUrl
  if (url) {
    // 先验证 Feed 格式，防止不可信更新源或带凭据地址被直接使用。
    validateUpdateFeedUrl(url)
    // generic Provider 用来读取用户配置的更新服务器元数据。
    autoUpdater.setFeedURL({ provider: 'generic', url })
  }
  // 未指定地址时使用打包元数据；签名校验由平台 updater 和发布配置负责。
  autoUpdater.autoDownload = false
  // 默认值为 true；必须关闭，普通退出绝不能绕过用户的安装确认。
  autoUpdater.autoInstallOnAppQuit = false
  listen('checking-for-update', () => broadcast('update:state', {kind:'full',status:'checking'}))
  listen('update-available', (info: { version: string }) => broadcast('update:state', {kind:'full',status:'available:' + info.version}))
  listen('update-not-available', () => { gate.complete(); broadcast('update:state', {kind:'full',status:'up-to-date'}) })
  listen('download-progress', (p: { percent: number }) => broadcast('update:state', {kind:'full',status:'downloading',percent:p.percent}))
  listen('update-downloaded', () => {
    if (!gate.isChecking) return
    gate.markDownloaded()
    broadcast('update:state', {kind:'full',status:'ready'})
    notifyBusiness({ title: '更新已就绪', body: '请在应用中确认安装更新。', kind: 'success', dedupeKey: 'full-update-ready' })
  })
  listen('error', (e: Error) => {gate.invalidate(); log.error('Update failed',e); broadcast('update:state',{kind:'full',status:'error',error:'更新失败，请稍后重试。'})})
  configured = true
}
/** 主动检查整包版本并启动下载；具体更新事件会推送给页面。 */
export async function checkUpdate() {
  if (!app.isPackaged) {
    log.info('Full update check skipped: application is not packaged')
    broadcast('update:state', { kind: 'full', status: 'disabled', error: '开发环境不支持整包更新，请在打包安装后的应用中运行。' })
    return
  }
  if (!configured) throw new Error('Updater was not initialized')
  if (!gate.start()) throw new Error('An update check is already in progress')
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo.version !== app.getVersion()) {
      await autoUpdater.downloadUpdate()
    } else {
      gate.complete()
    }
  } catch (error) {
    gate.invalidate()
    throw error
  }
}
/** 仅允许在更新包准备就绪后触发退出并安装。 */
export function installUpdate() {
  if (!app.isPackaged) {
    log.info('Full update install skipped: application is not packaged')
    broadcast('update:state', { kind: 'full', status: 'disabled', error: '开发环境不支持整包更新安装。' })
    return
  }
  if (!configured) throw new Error('Updater was not initialized')
  gate.assertInstallReady()
  // 在调用原生安装器之前消费就绪状态，防止双击重复退出安装。
  gate.invalidate()
  autoUpdater.quitAndInstall()
}

// 仅保存本模块的监听器；释放时不能 removeAllListeners 破坏 updater 的内部处理器。
const subscriptions: Array<() => void> = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listen(event: Parameters<typeof autoUpdater.on>[0], listener: (...args: any[]) => void) {
  // electron-updater 的 on/removeListener 泛型约束与运行时实现不匹配，用 any 绕过。
  autoUpdater.on(event, listener as Parameters<typeof autoUpdater.on>[1])
  subscriptions.push(() => autoUpdater.removeListener(event, listener as Parameters<typeof autoUpdater.on>[1]))
}
/** 退出或启动回滚时释放本模块资源，并拒绝迟到的安装请求。 */
export function disposeUpdater(): void {
  for (const remove of subscriptions.splice(0)) remove()
  configured = false
  gate.invalidate()
}
