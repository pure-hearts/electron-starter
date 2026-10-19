import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcast } from '../window'
import { log } from './logger'
import { runtimeConfig } from './config'
let configured = false
export function initUpdater() {
  const url = runtimeConfig().appUpdateUrl
  if (!url || !url.startsWith('https://') || configured) return
  configured = true
  autoUpdater.setFeedURL({ provider: 'generic', url })
  autoUpdater.autoDownload = false
  autoUpdater.on('checking-for-update', () => broadcast('update:state', {kind:'full',status:'checking'}))
  autoUpdater.on('update-available', info => broadcast('update:state', {kind:'full',status:'available:' + info.version}))
  autoUpdater.on('update-not-available', () => broadcast('update:state', {kind:'full',status:'up-to-date'}))
  autoUpdater.on('download-progress', p => broadcast('update:state', {kind:'full',status:'downloading',percent:p.percent}))
  autoUpdater.on('update-downloaded', () => broadcast('update:state', {kind:'full',status:'ready'}))
  autoUpdater.on('error', e => {log.error('Update failed',e); broadcast('update:state',{kind:'full',status:'error',error:e.message})})
}
export async function checkUpdate() {
  if (!app.isPackaged) throw new Error('Full updates require an installed application')
  if (!configured) throw new Error('Full update URL is not configured in resources/app-config.json')
  const result = await autoUpdater.checkForUpdates()
  if (result && result.updateInfo.version !== app.getVersion()) {
    await autoUpdater.downloadUpdate()
  }
}
export function installUpdate() {
  if (!configured) throw new Error('Update source is not configured')
  autoUpdater.quitAndInstall()
}
