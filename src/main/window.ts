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
import { safeWindowBounds } from './modules/window-bounds-policy'
// ESM 中没有 __dirname，需通过 import.meta.url 推算当前打包代码所在目录。
const here = path.dirname(fileURLToPath(import.meta.url))
// 缓存窗口引用，避免重复创建；窗口销毁后会置为 null。
let mainWindow: BrowserWindow | null = null
let splash: BrowserWindow | null = null
// Set 保存所有子窗口，关闭时清理引用，避免内存残留。
const children = new Set<BrowserWindow>()
// 屏幕监听器清理函数，disposeWindows 时需要移除，避免 GC 残留与测试间干扰。
let removeDisplayListener: (() => void) | null = null
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
/**
 * 销毁所有窗口并释放屏幕监听器；幂等，可重复调用。
 * 测试的 afterEach、应用退出及错误恢复都应调用此函数，确保没有残留引用或监听器。
 */
export function disposeWindows(): void {
  // 先移除 screen 事件，避免 display-removed 触发时尝试操作已销毁的窗口。
  if (removeDisplayListener) { removeDisplayListener(); removeDisplayListener = null }
  // 销毁所有子窗口
  for (const child of children) { if (!child.isDestroyed()) child.destroy() }
  children.clear()
  // 销毁 splash
  if (splash && !splash.isDestroyed()) { splash.destroy(); splash = null }
  // 销毁主窗口
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.destroy(); mainWindow = null }
}
/** 创建主窗口；如果已存在则复用，并恢复上次的可见位置和尺寸。 */
export function createMainWindow() {
  // 已有主窗口时只恢复显示，不再次实例化 BrowserWindow。
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return mainWindow }
  // BrowserWindow 是操作系统窗口；创建时先隐藏，等内容可渲染后再显示。
  const win = new BrowserWindow(options())
  mainWindow = win
  let boundsTimer: ReturnType<typeof setTimeout> | undefined
  /**
   * resize / move 防抖保存：
   * 最大化或最小化状态下用 getNormalBounds() 获取恢复尺寸，不把全屏矩形写入配置。
   * 400ms 防抖，避免拖动期间每帧都写磁盘。
   */
  const persistBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      // 最大化时保存 normalBounds + maximized 标志；最小化时不覆盖已有配置。
      if (win.isMinimized()) return
      const rect = win.isMaximized()
        ? { ...win.getNormalBounds(), maximized: true }
        : win.getBounds()
      setSetting('windowBounds', JSON.stringify(rect))
    }, 400)
  }
  win.on('move', persistBounds)
  win.on('resize', persistBounds)
  // 恢复上次窗口位置；同时读取 maximized 标志。
  const bounds = getSetting('windowBounds')
  if (typeof bounds === 'string') {
    try {
      const saved = JSON.parse(bounds) as Record<string, unknown>
      const rect = safeWindowBounds(saved, screen.getAllDisplays().map(d => d.workArea))
      if (rect) {
        win.setBounds(rect)
        // 上次退出时处于最大化状态，恢复最大化。
        if (saved.maximized === true) win.maximize()
      }
    } catch { /* ignore invalid legacy bounds */ }
  }
  /**
   * 监听显示器变更事件：外接屏幕拔出后，把溢出的窗口收回可见工作区。
   * 仅注册一次；disposeWindows 时移除，防止测试或重启后重复叠加监听器。
   *
   * 与 safeWindowBounds 不同，此处要把完全不可见的窗口也强制拉回最近的工作区，
   * 因此先尝试 safeWindowBounds（有相交时做精细对齐），若无相交则取第一块工作区兜底。
   */
  if (!removeDisplayListener) {
    const onDisplayRemoved = () => {
      const w = mainWindow
      if (!w || w.isDestroyed() || w.isMaximized()) return
      const displays = screen.getAllDisplays().map(d => d.workArea)
      if (!displays.length) return
      const cur = w.getBounds()
      // 先尝试精细对齐（有相交的工作区）
      const safe = safeWindowBounds(cur, displays)
      if (safe) { w.setBounds(safe); return }
      // 窗口完全超出所有工作区，收回第一块工作区的左上角。
      const primary = displays[0]
      const fitWidth = Math.max(820, Math.min(cur.width, primary.width))
      const fitHeight = Math.max(540, Math.min(cur.height, primary.height))
      w.setBounds({
        x: Math.max(primary.x, Math.min(cur.x, primary.x + primary.width - fitWidth)),
        y: Math.max(primary.y, Math.min(cur.y, primary.y + primary.height - fitHeight)),
        width: fitWidth, height: fitHeight,
      })
    }
    screen.on('display-removed', onDisplayRemoved)
    removeDisplayListener = () => screen.removeListener('display-removed', onDisplayRemoved)
  }
  // 开发模式使用 Vite 服务器，生产模式使用应用内注册的 app:// 协议。
  const dev = process.env.VITE_DEV_SERVER_URL
  const target = dev ? dev : rendererURL('/')
  let splashWin: BrowserWindow | null = null
  if (!dev) {
    splashWin = new BrowserWindow({ width: 350, height: 210, frame: false, resizable: false, show: true, alwaysOnTop: true, backgroundColor: '#101827' })
    splash = splashWin
    // Splash 加载失败时受控销毁，不阻塞主窗口继续显示。
    splashWin.loadURL(rendererURL('/splash.html')).catch(() => {
      if (splashWin && !splashWin.isDestroyed()) { splashWin.destroy() }
      if (splash === splashWin) splash = null
    })
  }
  /**
   * 主窗口准备好后关闭 splash 并显示自身。
   * 此闭包捕获本次创建的 splashWin；不依赖模块级 splash 变量，
   * 避免旧窗口的迟到 loadURL 失败回调误关新窗口的 splash。
   */
  const showMain = () => {
    if (win.isDestroyed()) return
    win.show()
    if (splashWin && !splashWin.isDestroyed()) { splashWin.close() }
    if (splash === splashWin) splash = null
  }
  win.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) markDeepLinkRendererUnready()
  })
  // ready-to-show 只监听一次，避免页面首次绘制前出现白屏或闪烁。
  win.once('ready-to-show', showMain)
  win.webContents.once('did-fail-load', (_e, code, description) => { log.error('Window failed to load', code, description); showMain() })
  void win.loadURL(target).catch(err => { log.error('Renderer load failed', err); showMain() })
  // close 可被阻止：启用关闭到托盘时隐藏窗口，而不是销毁应用。
  win.on('close', event => {
    if (!isQuitting() && getSetting('closeToTray') === true) { event.preventDefault(); win.hide(); return }
    // 关闭前取消防抖计时器，确保退出时不触发多余的 setSetting 调用。
    if (boundsTimer) { clearTimeout(boundsTimer); boundsTimer = undefined }
    // 最大化/最小化时的坐标不是用户希望恢复的常规窗口尺寸。
    if (!win.isDestroyed() && !win.isMaximized() && !win.isMinimized())
      setSetting('windowBounds', JSON.stringify(win.getBounds()))
  })
  win.on('closed', () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    mainWindow = null
    if (splashWin && !splashWin.isDestroyed()) splashWin.close()
    if (splash === splashWin) splash = null
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
  void win.loadURL(base + '#' + route)
    .then(() => { if (!win.isDestroyed()) win.show() })
    .catch(error => { log.error('Child window failed to load', error); if (!win.isDestroyed()) win.close() })
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
