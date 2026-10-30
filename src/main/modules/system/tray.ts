/** 系统托盘由主进程管理；关闭窗口不一定退出程序，托盘可提供恢复和退出入口。 */
import { Tray, Menu, nativeImage, app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { platform } from "../../platform";
import { focusMainWindow } from "../../window";
import { requestQuit } from "../core/lifecycle";

// 保持 Tray 对象的引用，否则可能被垃圾回收，导致系统托盘图标消失。
let tray: Tray | null = null;
let iconsWatcher: fs.FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getIconsDirectory(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "resources", "icons")
    : path.join(process.cwd(), "resources", "icons");
}

export function getIconPath(filename: string): string {
  return path.join(getIconsDirectory(), filename);
}

/** 动态根据当前操作系统及屏幕分辨率适配加载托盘 NativeImage 图标 */
export function loadTrayImage(): Electron.NativeImage {
  let trayImage: Electron.NativeImage;
  if (platform.isMac) {
    // macOS 优先使用 template 图标，自动适配系统深色/浅色菜单栏
    const templatePath = getIconPath("trayTemplate.png");
    const img = nativeImage.createFromPath(templatePath);
    if (!img.isEmpty()) {
      img.setTemplateImage(true);
      trayImage = img;
    } else {
      const fallback = nativeImage.createFromPath(getIconPath("icon.png"));
      trayImage = fallback.resize({ width: 18, height: 18 });
    }
  } else if (platform.isWindows) {
    // Windows 优先加载托盘专用的复合 ico，避免大尺寸应用主图标被失真缩放
    const trayIcoPath = getIconPath("tray.ico");
    let img = nativeImage.createFromPath(trayIcoPath);
    if (img.isEmpty()) {
      img = nativeImage.createFromPath(getIconPath("tray.png"));
    }
    if (img.isEmpty()) {
      img = nativeImage.createFromPath(getIconPath("icon.ico"));
    }
    trayImage = img;
  } else {
    // Linux 及其他平台使用通用彩色托盘 png
    const pngPath = getIconPath("tray.png");
    const img = nativeImage.createFromPath(pngPath);
    trayImage = img.isEmpty() ? nativeImage.createFromPath(getIconPath("icon.png")) : img;
  }
  return trayImage;
}

/** 开发模式同步更新 macOS Dock 栏图标，消除开发态显示默认 Electron 蓝色小恐龙图标 */
export function syncDockIcon(): void {
  if (platform.isMac && app.dock) {
    try {
      const iconPath = getIconPath("icon.png");
      if (fs.existsSync(iconPath)) {
        const dockImg = nativeImage.createFromPath(iconPath);
        if (!dockImg.isEmpty()) {
          app.dock.setIcon(dockImg);
        }
      }
    } catch {
      // 容错处理
    }
  }
}

/** 供外部或热重载调用的托盘图标刷新方法 */
export function reloadTrayIcon(): boolean {
  if (!tray) return false;
  try {
    const newImage = loadTrayImage();
    if (!newImage.isEmpty()) {
      tray.setImage(newImage);
      return true;
    }
  } catch (err) {
    console.warn("[tray] Failed to reload tray icon:", err);
  }
  return false;
}

/** 开发模式下监听 resources/icons 目录，图标重新生成时自动热刷新托盘和 Dock */
function initDevIconsWatcher(): void {
  if (app.isPackaged || iconsWatcher) return;
  try {
    const iconsDir = getIconsDirectory();
    if (!fs.existsSync(iconsDir)) return;
    iconsWatcher = fs.watch(iconsDir, (_eventType, filename) => {
      if (filename && /tray|icon/i.test(filename)) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          reloadTrayIcon();
          syncDockIcon();
        }, 200);
      }
    });
  } catch (err) {
    console.warn("[tray] Failed to start dev icons watcher:", err);
  }
}

export function createTray(): Tray {
  // macOS 开发态自动同步 Dock 图标
  syncDockIcon();

  // 若托盘已存在，刷新其图标后直接复用
  if (tray) {
    reloadTrayIcon();
    return tray;
  }

  const trayImage = loadTrayImage();
  tray = new Tray(trayImage);
  tray.setToolTip(app.getName());

  // Menu.buildFromTemplate 构建右键菜单，菜单事件调用主进程函数。
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开主窗口", click: focusMainWindow },
      {
        label: "偏好设置",
        click: () => {
          focusMainWindow();
        },
      },
      { type: "separator" },
      { label: "退出", click: requestQuit },
    ]),
  );

  // 双击托盘图标时唤醒主窗口；具体行为可能因操作系统而异。
  tray.on("double-click", focusMainWindow);

  // 挂载开发态热监听器
  initDevIconsWatcher();

  return tray;
}

/** 应用真正退出时销毁原生托盘图标及监听器，释放系统资源。 */
export function destroyTray(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (iconsWatcher) {
    try {
      iconsWatcher.close();
    } catch {
      // 忽略关闭异常
    }
    iconsWatcher = null;
  }
  tray?.destroy();
  tray = null;
}
