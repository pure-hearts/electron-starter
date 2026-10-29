/**
 * 窗口模块门面：聚合主窗口、子窗口、广播与销毁函数。
 */
import { disposeMainWindow } from "./main-window";
import { disposeChildWindows } from "./child-window";

export { createMainWindow, getMainWindow } from "./main-window";
export { openChild } from "./child-window";
export { windowAction, broadcast, broadcastToAllWindows, focusMainWindow } from "./broadcast";

/**
 * 销毁所有窗口并释放屏幕监听器；幂等，可重复调用。
 * 测试的 afterEach、应用退出及错误恢复都应调用此函数，确保没有残留引用或监听器。
 */
export function disposeWindows(): void {
  disposeMainWindow();
  disposeChildWindows();
}
