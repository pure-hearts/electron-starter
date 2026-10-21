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
import { isTrustedWindowNavigation } from './modules/window-navigation-policy'
// ESM 中没有 __dirname，需通过 import.meta.url 推算当前打包代码所在目录。
const here = path.dirname(fileURLToPath(import.meta.url))
// 缓存窗口引用，避免重复创建；窗口销毁后会置为 null。
let mainWindow: BrowserWindow | null = null
let splash: BrowserWindow | null = null
// Set 保存所有子窗口，关闭时清理引用，避免内存残留。
const children = new Set<BrowserWindow>()
// Sandboxed preload must use bundled CommonJS, not ESM.
const preload = path.join(here, 'preload.cjs')
/** 统一的窗口安全配置：启用隔离和沙箱，禁止页面直接访问 Node.js。 */
function options(): Electron.BrowserWindowConstructorOptions {
  return {
    width: 1140, height: 760, minWidth: 820, minHeight: 540, show: false,
    backgroundColor: '#101827',
    webPreferences: {
      // Preload 建立 IPC 桥梁；沙箱和上下文隔离降低页面访问系统资源的风险。
      preload, sandbox: true, contextIsolation: true, nodeIntegration: false,
      webSecurity: true, webviewTag: false
    }
  }
}
export function getMainWindow() { return mainWindow }
/** 创建主窗口；如果已存在则复用，并恢复上次的可见位置和尺寸。 */
export function createMainWindow() {
  // 已有主窗口时只恢复显示，不再次实例化 BrowserWindow。
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return mainWindow }
  // BrowserWindow 是操作系统窗口；创建时先隐藏，等内容可渲染后再显示。
  const win = new BrowserWindow(options())
  mainWindow = win
  let boundsTimer: ReturnType<typeof setTimeout> | undefined
  // move/resize 事件非常频繁；400ms 防抖，避免每次拖动都向磁盘写设置。
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
      // 显示器可能被拔掉，只有旧窗口位置与当前任一工作区相交才恢复坐标。
      const visible = screen.getAllDisplays().some(d => {
        const b = d.workArea
        return rect.x < b.x+b.width && rect.x+rect.width > b.x && rect.y < b.y+b.height && rect.y+rect.height > b.y
      })
      if (visible && rect.width >= 820 && rect.height >= 540 && rect.width <= 10000 && rect.height <= 10000) win.setBounds(rect)
    } catch { /* ignore invalid legacy bounds */ }
  }
  // 开发模式使用 Vite 服务器，生产模式使用应用内注册的 app:// 协议。
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
  // ready-to-show 只监听一次，避免页面首次绘制前出现白屏或闪烁。
  win.once('ready-to-show', show)
  win.webContents.once('did-fail-load', (_e, code, description) => { log.error('Window failed to load', code, description); show() })
  void win.loadURL(target).catch(err => { log.error('Renderer load failed', err); show() })
  // close 可被阻止：启用关闭到托盘时隐藏窗口，而不是销毁应用。
  win.on('close', event => {
    if (!isQuitting() && getSetting('closeToTray') === true) { event.preventDefault(); win.hide(); return }
    setSetting('windowBounds', JSON.stringify(win.getBounds()))
  })
  win.on('closed', () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    mainWindow = null
  })
  // 默认拒绝网页 window.open 创建不受控窗口；新窗口须走专用 IPC。
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // 页面主动跳转到不受信任地址时阻止导航，避免外部网页继承桌面桥梁。
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternalURL(url)) event.preventDefault()
  })
  return win
}
/** 主、子窗口共享纯函数导航策略，减少策略漂移。 */
function isInternalURL(url: string): boolean {
  return isTrustedWindowNavigation(url, { devServerUrl: process.env.VITE_DEV_SERVER_URL })
}

/** 创建独立子窗口，沿用与主窗口相同的沙箱/导航安全策略。 */
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
/** webContents.send 属于主进程向所有存活渲染窗口推送的单向 IPC。 */
export function broadcast<E extends import('../shared/ipc').EventChannel>(name: E, payload: import('../shared/ipc').DesktopEvents[E]) {
  BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed() && !w.webContents.isDestroyed()) w.webContents.send(name, payload) })
}
export function focusMainWindow() { const w = createMainWindow(); if (w.isMinimized()) w.restore(); w.show(); w.focus() }
