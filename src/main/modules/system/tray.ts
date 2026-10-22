/** 系统托盘由主进程管理；关闭窗口不一定退出程序，托盘可提供恢复和退出入口。 */
import { Tray, Menu, nativeImage, app } from "electron";
import path from "node:path";
import { platform } from "../../platform";
import { focusMainWindow } from "../../window";
import { requestQuit } from "../core/lifecycle";

// 保持 Tray 对象的引用，否则可能被垃圾回收，导致系统托盘图标消失。
let tray: Tray | null = null;

export function createTray() {
  // 多次初始化时复用同一个托盘图标，避免重复出现。
  if (tray) return tray;
  // Windows 通常使用 ICO 格式，其他平台使用 PNG。
  const icon = platform.isWindows ? "icon.ico" : "icon.png";
  const imagePath = path.join(process.resourcesPath, "resources", "icons", icon);
  const fallbackPath = path.join(process.resourcesPath, "resources", "icons", "icon.png");
  // nativeImage 将图片文件加载为 Electron 可用于系统托盘的图像。
  const image = nativeImage.createFromPath(imagePath);
  const trayImage = image.isEmpty() ? nativeImage.createFromPath(fallbackPath) : image;
  // macOS 菜单栏图标较小，因此单独缩放为 18×18。
  tray = new Tray(platform.isMac ? trayImage.resize({ width: 18, height: 18 }) : trayImage);
  tray.setToolTip(app.getName());
  // Menu.buildFromTemplate 构建右键菜单，菜单事件调用主进程函数。
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开主窗口", click: focusMainWindow },
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
