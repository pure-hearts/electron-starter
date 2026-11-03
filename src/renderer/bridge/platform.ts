/**
 * @file platform.ts
 * @description 跨端运行环境探针：精确识别当前是运行在 Electron 桌面容器内还是纯 Web 浏览器中。
 * 结合编译期静态常量 __IS_WEB__，生产构建时支持完整的死代码消除（DCE）。
 * 同时提供与主进程一致的操作系统及细分版本检测能力。
 */

import { createPlatformInfo, type PlatformInfo } from "../../shared/platform";

// 1. 判断是否处于真正的 Electron 环境
// 优先使用构建时静态常量，在构建中消除对立平台代码；未定义常量时（如运行时/单测）采用动态对象检测回退
export const isElectron =
  typeof __IS_WEB__ !== "undefined"
    ? !__IS_WEB__
    : Boolean(
        typeof window !== "undefined" &&
        (window.process?.versions?.electron !== undefined || Boolean(window.$ipcBridge)),
      );

// 2. 纯 Web 浏览器环境标识
export const isWeb = !isElectron;

/**
 * 探测当前宿主操作系统
 */
function resolveRendererPlatform(): string {
  if (typeof navigator === "undefined") {
    return typeof process !== "undefined" ? process.platform : "web";
  }
  const ua = navigator.userAgent || "";
  const navPlatform = (navigator as unknown as { platform?: string }).platform || "";
  if (/Win/i.test(navPlatform) || /Windows/i.test(ua)) return "win32";
  if (/Mac/i.test(navPlatform) || /Macintosh/i.test(ua)) return "darwin";
  if (/Linux/i.test(navPlatform) || /Linux/i.test(ua)) return "linux";
  return "web";
}

/**
 * 探测 OS 版本（Web UA 解析，如 Windows NT 10.0）
 */
function resolveRendererOsRelease(): string {
  if (typeof navigator === "undefined") {
    return "";
  }
  const ua = navigator.userAgent || "";
  const winMatch = ua.match(/Windows NT ([\d.]+)/);
  if (winMatch) {
    return `${winMatch[1]}.0`;
  }
  return "";
}

/**
 * 渲染进程平台统一元数据对象
 */
export const platform: PlatformInfo = createPlatformInfo(
  resolveRendererPlatform(),
  resolveRendererOsRelease(),
  isElectron,
);

/**
 * Composition API: 获取当前运行平台与核心环境状态
 */
export function usePlatform() {
  return {
    /** 是否为桌面 Electron 环境 */
    isElectron,
    /** 是否为纯 Web 浏览器环境 */
    isWeb,
    /** 当前容器平台标识 ('electron' | 'web') */
    platform: (isElectron ? "electron" : "web") as "electron" | "web",
    /** 操作系统详细特征与细分版本 */
    os: platform,
  };
}

export type { PlatformInfo, WindowsVersionInfo, MacVersionInfo } from "../../shared/platform";
