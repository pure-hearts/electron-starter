import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcast } from '../window'
import { log } from './logger'
import { runtimeConfig } from './config'
import { UpdateGate } from './update-gate'
import { validateUpdateFeedUrl } from './update-feed-url'
let configured = false
const gate = new UpdateGate()
export function initUpdater() {
  if (configured) return
  const url = runtimeConfig().appUpdateUrl
  configured = true
  if (url) {
    validateUpdateFeedUrl(url)
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
export function installUpdate() {
  if (!configured || !app.isPackaged) throw new Error('Updates require an installed application')
  gate.assertInstallReady()
  autoUpdater.quitAndInstall()
}
