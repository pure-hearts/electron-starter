/**
 * Electron 窗口管理：BrowserWindow 由主进程创建，窗口内部加载 Vue 页面。
 * 管理主窗口、启动画面、子窗口、窗口状态保存和安全导航规则。
 */
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSetting, setSetting } from './modules/store'
import { rendererURL, markDeepLinkRendererUnready } from './modules/protocol'
import { log } from './modules/logger'
import { isQuitting } from './modules/lifecycle'
const here = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
let splash: BrowserWindow | null = null
const children = new Set<BrowserWindow>()
// Sandboxed preload must use bundled CommonJS, not ESM.
const preload = path.join(here, 'preload.cjs')
/** 统一的窗口安全配置：启用隔离和沙箱，禁止页面直接访问 Node.js。 */
function options(): Electron.BrowserWindowConstructorOptions {
  return {
    width: 1140, height: 760, minWidth: 820, minHeight: 540, show: false,
    backgroundColor: '#101827',
    webPreferences: {
      preload, sandbox: true, contextIsolation: true, nodeIntegration: false,
      webSecurity: true, webviewTag: false
    }
  }
}
export function getMainWindow() { return mainWindow }
/** 创建主窗口；如果已存在则复用，并恢复上次的可见位置和尺寸。 */
export function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return mainWindow }
  const win = new BrowserWindow(options())
  mainWindow = win
  let boundsTimer: ReturnType<typeof setTimeout> | undefined
  const persistBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return
    boundsTimer = setTimeout(() => {
      if (!win.isDestroyed()) setSetting('windowBounds', JSON.stringify(win.getBounds()))
    }, 400)
  }
  win.on('move', persistBounds)
  win.on('resize', persistBounds)
  const bounds = getSetting('windowBounds')
  if (typeof bounds === 'string') {
    try {
      const rect = JSON.parse(bounds) as Electron.Rectangle
      const visible = screen.getAllDisplays().some(d => {
        const b = d.workArea
        return rect.x < b.x+b.width && rect.x+rect.width > b.x && rect.y < b.y+b.height && rect.y+rect.height > b.y
      })
      if (visible && rect.width >= 820 && rect.height >= 540 && rect.width <= 10000 && rect.height <= 10000) win.setBounds(rect)
    } catch { /* ignore invalid legacy bounds */ }
  }
  const dev = process.env.VITE_DEV_SERVER_URL
  const target = dev ? dev : rendererURL('/')
  if (!dev) {
    splash = new BrowserWindow({ width: 350, height: 210, frame: false, resizable: false, show: true, alwaysOnTop: true, backgroundColor: '#101827' })
    void splash.loadURL(rendererURL('/splash.html'))
  }
  const show = () => {
    if (win.isDestroyed()) return
    win.show()
    splash?.close(); splash = null
  }
  win.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) markDeepLinkRendererUnready()
  })
  win.once('ready-to-show', show)
  win.webContents.once('did-fail-load', (_e, code, description) => { log.error('Window failed to load', code, description); show() })
  void win.loadURL(target).catch(err => { log.error('Renderer load failed', err); show() })
  win.on('close', event => {
    if (!isQuitting() && getSetting('closeToTray') === true) { event.preventDefault(); win.hide(); return }
    setSetting('windowBounds', JSON.stringify(win.getBounds()))
  })
  win.on('closed', () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    mainWindow = null
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternalURL(url)) event.preventDefault()
  })
  return win
}
function isInternalURL(url: string) {
  try { const u = new URL(url); return u.protocol === 'app:' && u.host === 'renderer' || process.env.VITE_DEV_SERVER_URL !== undefined && u.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin }
  catch { return false }
}
export function openChild(route: string) {
  const win = new BrowserWindow({ ...options(), width: 900, height: 650 })
  children.add(win)
  win.on('closed', () => { children.delete(win) })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => { if (!isInternalURL(url)) event.preventDefault() })
  const base = process.env.VITE_DEV_SERVER_URL || rendererURL('/')
  void win.loadURL(base + '#' + route).then(() => win.show())
  return win.id
}
/** 根据调用 IPC 的页面定位其窗口，执行最小化、最大化等原生操作。 */
export function windowAction(sender: Electron.WebContents, action: string) {
  const win = BrowserWindow.fromWebContents(sender)
  if (!win) throw new Error('Window unavailable')
  switch (action) {
    case 'minimize': win.minimize(); break
    case 'maximize': win.maximize(); break
    case 'restore': win.restore(); break
    case 'hide': win.hide(); break
    case 'show': win.show(); win.focus(); break
    case 'close': win.close(); break
    default: throw new Error('Unknown action')
  }
}
export function broadcast<E extends import('../shared/ipc').EventChannel>(name: E, payload: import('../shared/ipc').DesktopEvents[E]) {
  BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed() && !w.webContents.isDestroyed()) w.webContents.send(name, payload) })
}
export function focusMainWindow() { const w = createMainWindow(); if (w.isMinimized()) w.restore(); w.show(); w.focus() }
