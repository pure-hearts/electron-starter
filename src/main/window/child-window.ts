/** 子窗口创建与生命周期管理。 */
import { BrowserWindow } from 'electron'
import { rendererURL } from '../modules/protocol'
import { log } from '../modules/core/logger'
import { windowOptions, isInternalURL } from './options'

// Set 保存所有子窗口，关闭时清理引用，避免内存残留。
const children = new Set<BrowserWindow>()

/** 创建独立子窗口，沿用与主窗口相同的沙箱/导航安全策略。 */
export function openChild(route: string): number {
  const win = new BrowserWindow({ ...windowOptions(), width: 900, height: 650 })
  children.add(win)
  win.on('closed', () => { children.delete(win) })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => { if (!isInternalURL(url)) event.preventDefault() })

  const base = process.env.VITE_DEV_SERVER_URL || rendererURL('/')
  void win.loadURL(base + '#' + route)
    .then(() => { if (!win.isDestroyed()) win.show() })
    .catch(error => { log.error('Child window failed to load', error); if (!win.isDestroyed()) win.close() })

  return win.id
}

/** 销毁全部子窗口。 */
export function disposeChildWindows(): void {
  for (const child of children) {
    if (!child.isDestroyed()) child.destroy()
  }
  children.clear()
}
