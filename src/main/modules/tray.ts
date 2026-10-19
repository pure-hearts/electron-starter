import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'node:path'
import { focusMainWindow } from '../window'
let tray: Tray | null = null
export function createTray() {
  if (tray) return tray
  const icon = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const imagePath = path.join(process.resourcesPath, 'resources', 'icons', icon)
  const fallbackPath = path.join(process.resourcesPath, 'resources', 'icons', 'icon.png')
  const image = nativeImage.createFromPath(imagePath)
  const trayImage = image.isEmpty() ? nativeImage.createFromPath(fallbackPath) : image
  tray = new Tray(trayImage)
  tray.setToolTip(app.getName())
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主窗口', click: focusMainWindow },
    { type: 'separator' },
    { label: '退出', click() { app.isQuitting = true; app.quit() } }
  ]))
  tray.on('double-click', focusMainWindow)
  return tray
}
export function destroyTray() { tray?.destroy(); tray = null }
