/**
 * @file platform.ts
 * @description 跨端运行环境探针：精确识别当前是运行在 Electron 桌面容器内还是纯 Web 浏览器中。
 */

// 1. 判断是否处于真正的 Electron 环境
// 判定标准：全局对象含有原始 Electron 注入标记且未被 Web Shim 垫片标记覆写
export const isElectron = Boolean(
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
