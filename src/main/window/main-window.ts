/**
 * 主窗口与启动画面（Splash）生命周期管理。
 */
import { BrowserWindow, screen } from "electron";
import { getSetting, setSetting } from "../modules/store";
import { rendererURL, markDeepLinkRendererUnready } from "../modules/protocol";
import { log } from "../modules/core/logger";
import { isQuitting } from "../modules/core/lifecycle";
import { safeWindowBounds } from "../modules/system/window-bounds-policy";
import { windowOptions, isInternalURL } from "./options";

let mainWindow: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;
// 屏幕监听器清理函数，dispose 时需要移除，避免 GC 残留与测试间干扰。
let removeDisplayListener: (() => void) | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** 销毁主窗口、Splash 与屏幕监听器。 */
export function disposeMainWindow(): void {
  if (removeDisplayListener) {
    removeDisplayListener();
    removeDisplayListener = null;
  }
  if (splash && !splash.isDestroyed()) {
    splash.destroy();
    splash = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
}

/** 创建主窗口；如果已存在则复用，并恢复上次的可见位置和尺寸。 */
export function createMainWindow(): BrowserWindow {
  // 已有主窗口时只恢复显示，不再次实例化 BrowserWindow。
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  // BrowserWindow 是操作系统窗口；创建时先隐藏，等内容可渲染后再显示。
  const win = new BrowserWindow(windowOptions());
  mainWindow = win;
  let boundsTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * resize / move 防抖保存：
   * 最大化或最小化状态下用 getNormalBounds() 获取恢复尺寸，不把全屏矩形写入配置。
   * 400ms 防抖，避免拖动期间每帧都写磁盘。
   */
  const persistBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      // 最大化时保存 normalBounds + maximized 标志；最小化时不覆盖已有配置。
      if (win.isMinimized()) return;
      const rect = win.isMaximized()
        ? { ...win.getNormalBounds(), maximized: true }
        : win.getBounds();
      setSetting("windowBounds", JSON.stringify(rect));
    }, 400);
  };

  win.on("move", persistBounds);
  win.on("resize", persistBounds);

  // 恢复上次窗口位置；同时读取 maximized 标志。
  const bounds = getSetting("windowBounds");
  if (typeof bounds === "string") {
    try {
      const saved = JSON.parse(bounds) as Record<string, unknown>;
      const rect = safeWindowBounds(
        saved,
        screen.getAllDisplays().map((d) => d.workArea),
      );
      if (rect) {
        win.setBounds(rect);
        // 上次退出时处于最大化状态，恢复最大化。
        if (saved.maximized === true) win.maximize();
      }
    } catch {
      /* ignore invalid legacy bounds */
    }
  }

  /**
   * 监听显示器变更事件：外接屏幕拔出后，把溢出的窗口收回可见工作区。
   * 仅注册一次；dispose 时移除，防止测试或重启后重复叠加监听器。
   */
  if (!removeDisplayListener) {
    const onDisplayRemoved = () => {
      const w = mainWindow;
      if (!w || w.isDestroyed() || w.isMaximized()) return;
      const displays = screen.getAllDisplays().map((d) => d.workArea);
      if (!displays.length) return;
      const cur = w.getBounds();
      // 先尝试精细对齐（有相交的工作区）
      const safe = safeWindowBounds(cur, displays);
      if (safe) {
        w.setBounds(safe);
        return;
      }
      // 窗口完全超出所有工作区，收回第一块工作区的左上角。
      const primary = displays[0];
      const fitWidth = Math.max(820, Math.min(cur.width, primary.width));
      const fitHeight = Math.max(540, Math.min(cur.height, primary.height));
      w.setBounds({
        x: Math.max(primary.x, Math.min(cur.x, primary.x + primary.width - fitWidth)),
        y: Math.max(primary.y, Math.min(cur.y, primary.y + primary.height - fitHeight)),
        width: fitWidth,
        height: fitHeight,
      });
    };
    screen.on("display-removed", onDisplayRemoved);
    removeDisplayListener = () => screen.removeListener("display-removed", onDisplayRemoved);
  }

  // 开发模式使用 Vite 服务器，生产模式使用应用内注册的 app:// 协议。
  const dev = process.env.VITE_DEV_SERVER_URL;
  const target = dev ? dev : rendererURL("/");
  let splashWin: BrowserWindow | null = null;
  if (!dev) {
    splashWin = new BrowserWindow({
      width: 350,
      height: 210,
      frame: false,
      resizable: false,
      show: true,
      alwaysOnTop: true,
      backgroundColor: "#101827",
    });
    splash = splashWin;
    // Splash 加载失败时受控销毁，不阻塞主窗口继续显示。
    splashWin.loadURL(rendererURL("/splash.html")).catch(() => {
      if (splashWin && !splashWin.isDestroyed()) splashWin.destroy();
      if (splash === splashWin) splash = null;
    });
  }

  /**
   * 主窗口准备好后关闭 splash 并显示自身。
   * 此闭包捕获本次创建的 splashWin；不依赖模块级 splash 变量，
   * 避免旧窗口的迟到 loadURL 失败回调误关新窗口的 splash。
   */
  const showMain = () => {
    if (win.isDestroyed()) return;
    win.show();
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    if (splash === splashWin) splash = null;
  };

  win.webContents.on("did-start-navigation", (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) markDeepLinkRendererUnready();
  });

  // ready-to-show 只监听一次，避免页面首次绘制前出现白屏或闪烁。
  win.once("ready-to-show", showMain);
  win.webContents.once("did-fail-load", (_e, code, description) => {
    log.error("Window failed to load", code, description);
    showMain();
  });
  void win.loadURL(target).catch((err) => {
    log.error("Renderer load failed", err);
    showMain();
  });

  // close 可被阻止：启用关闭到托盘时隐藏窗口，而不是销毁应用。
  win.on("close", (event) => {
    if (!isQuitting() && getSetting("closeToTray") === true) {
      event.preventDefault();
      win.hide();
      return;
    }
    // 关闭前取消防抖计时器，确保退出时不触发多余的 setSetting 调用。
    if (boundsTimer) {
      clearTimeout(boundsTimer);
      boundsTimer = undefined;
    }
    // 最大化/最小化时的坐标不是用户希望恢复的常规窗口尺寸。
    if (!win.isDestroyed() && !win.isMaximized() && !win.isMinimized())
      setSetting("windowBounds", JSON.stringify(win.getBounds()));
  });

  win.on("closed", () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    mainWindow = null;
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    if (splash === splashWin) splash = null;
  });

  // 默认拒绝网页 window.open 创建不受控窗口；新窗口须走专用 IPC。
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // 页面主动跳转到不受信任地址时阻止导航，避免外部网页继承桌面桥梁。
  win.webContents.on("will-navigate", (event, url) => {
    if (!isInternalURL(url)) event.preventDefault();
  });

  return win;
}
