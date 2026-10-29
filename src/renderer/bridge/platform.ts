/**
 * @file platform.ts
 * @description 跨端运行环境探针：精确识别当前是运行在 Electron 桌面容器内还是纯 Web 浏览器中。
 * 结合编译期静态常量 __IS_WEB__，生产构建时支持完整的死代码消除（DCE）。
 */

// 1. 判断是否处于真正的 Electron 环境
// 优先使用构建时静态常量，在构建中消除对立平台代码；未定义常量时（如运行时/单测）采用动态对象检测回退
export const isElectron =
  typeof __IS_WEB__ !== "undefined"
    ? !__IS_WEB__
    : Boolean(
        typeof window !== "undefined" &&
        (window.process?.versions?.electron !== undefined ||
          (window.$ipcBridge && !window.$ipcBridge.__isWebShim)),
      );

// 2. 纯 Web 浏览器环境标识
export const isWeb = !isElectron;

/**
 * Composition API: 获取当前运行平台与核心环境状态
 */
export function usePlatform() {
  return {
    /** 是否为桌面 Electron 环境 */
    isElectron,
    /** 是否为纯 Web 浏览器环境 */
    isWeb,
    /** 当前平台标识 */
    platform: (isElectron ? "electron" : "web") as "electron" | "web",
  };
}
