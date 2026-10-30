/** 系统托盘由主进程管理；关闭窗口不一定退出程序，托盘可提供恢复和退出入口。 */
import { Tray, Menu, nativeImage, app } from "electron";
import path from "node:path";
import { platform } from "../../platform";
import { focusMainWindow } from "../../window";
import { requestQuit } from "../core/lifecycle";

// 保持 Tray 对象的引用，否则可能被垃圾回收，导致系统托盘图标消失。
let tray: Tray | null = null;

function getIconPath(filename: string): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "resources", "icons")
    : path.join(process.cwd(), "resources", "icons");
  return path.join(base, filename);
}

export function createTray() {
  // 多次初始化时复用同一个托盘图标，避免重复出现。
  if (tray) return tray;

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
    const icoPath = getIconPath("icon.ico");
    const img = nativeImage.createFromPath(icoPath);
    trayImage = img.isEmpty() ? nativeImage.createFromPath(getIconPath("tray.png")) : img;
  } else {
    const pngPath = getIconPath("tray.png");
    const img = nativeImage.createFromPath(pngPath);
    trayImage = img.isEmpty() ? nativeImage.createFromPath(getIconPath("icon.png")) : img;
  }

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
  return tray;
}

/** 应用真正退出时销毁原生托盘图标，释放系统资源。 */
export function destroyTray() {
  tray?.destroy();
  tray = null;
}
