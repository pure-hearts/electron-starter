/** 整包自动更新：使用 electron-updater 下载并安装新的 Electron 应用版本，而不是热替换 Vue 资源。 */
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcast } from '../window'
import { log } from './logger'
import { runtimeConfig } from './config'
import { UpdateGate } from './update-gate'
import { validateUpdateFeedUrl } from './update-feed-url'
// 防止重复绑定 autoUpdater 事件，重复绑定会触发多次页面状态通知。
let configured = false
// 更新门禁：检查中禁止并发请求，下载未完成禁止触发安装。
const gate = new UpdateGate()
/** 初始化 Feed 地址及更新事件监听；应用启动期间通常只调用一次。 */
export function initUpdater() {
  if (configured) return
  // 可以使用自定义 HTTPS Feed；未配置时使用 electron-builder 的发布元数据。
  const url = runtimeConfig().appUpdateUrl
  configured = true
  if (url) {
    // 先验证 Feed 格式，防止不可信更新源或带凭据地址被直接使用。
    validateUpdateFeedUrl(url)
    // generic Provider 用来读取用户配置的更新服务器元数据。
    autoUpdater.setFeedURL({ provider: 'generic', url })
  }
  // Otherwise use electron-builder's signed GitHub Releases provider metadata.
  autoUpdater.autoDownload = false
  autoUpdater.on('checking-for-update', () => broadcast('update:state', {kind:'full',status:'checking'}))
  autoUpdater.on('update-available', info => broadcast('update:state', {kind:'full',status:'available:' + info.version}))
  autoUpdater.on('update-not-available', () => { gate.complete(); broadcast('update:state', {kind:'full',status:'up-to-date'}) })
  autoUpdater.on('download-progress', p => broadcast('update:state', {kind:'full',status:'downloading',percent:p.percent}))
  autoUpdater.on('update-downloaded', () => { gate.markDownloaded(); broadcast('update:state', {kind:'full',status:'ready'}) })
  autoUpdater.on('error', e => {gate.invalidate(); log.error('Update failed',e); broadcast('update:state',{kind:'full',status:'error',error:e.message})})
}
/** 主动检查整包版本并启动下载；具体更新事件会推送给页面。 */
export async function checkUpdate() {
  if (!app.isPackaged) throw new Error('Full updates require an installed application')
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
  if (!configured || !app.isPackaged) throw new Error('Updates require an installed application')
  gate.assertInstallReady()
  autoUpdater.quitAndInstall()
}
