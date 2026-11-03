/**
 * @file index.ts
 * @description 统一跨端 Bridge 调度入口：
 * 自动识别 Electron 桌面端原生 IPC 桥接对象与纯 Web 浏览器环境，
 * 保证开发与生产环境下双端 API 调用统一、类型安全。
 */

import type { DesktopBridge } from "@shared/ipc";
import { isElectron, isWeb, usePlatform } from "./platform";
import { createWebShimBridge } from "./web-shim";

let activeBridge: DesktopBridge;

/**
 * 为原生 Bridge 包装防御性切面：
 * 避免旧版本原生底包 Preload 未声明新事件白名单时同步抛错引发全屏白屏崩溃。
 */
function wrapSafeBridge(raw: DesktopBridge): DesktopBridge {
  return {
    ...raw,
    invoke: (channel, ...args) => raw.invoke(channel, ...args),
    on: (channel, callback) => {
      try {
        return raw.on(channel, callback);
      } catch (err) {
        console.warn(
          `[useIpcBridge] 当前宿主底包不支持事件监听 "${String(channel)}"，已安全降级为 No-op:`,
          err,
        );
        return () => {};
      }
    },
  };
}

/**
 * 初始化全局 Bridge 并保证 window.$ipcBridge 安全可用
 */
export function initBridge(): DesktopBridge {
  // 桌面端编译期优化：若编译期已知为桌面客户端环境且已挂载原生 Bridge，直接返回
  if (typeof __IS_WEB__ !== "undefined" && !__IS_WEB__) {
    if (typeof window !== "undefined" && window.$ipcBridge && !window.$ipcBridge.__isWebShim) {
      activeBridge = wrapSafeBridge(window.$ipcBridge);
      return activeBridge;
    }
  }

  if (typeof window !== "undefined") {
    if (window.$ipcBridge && !window.$ipcBridge.__isWebShim) {
      activeBridge = wrapSafeBridge(window.$ipcBridge);
    } else {
      activeBridge = createWebShimBridge();
      window.$ipcBridge = activeBridge;
    }
  } else {
    activeBridge = createWebShimBridge();
  }
  return activeBridge;
}

/** 获取当前环境可用的 Bridge 单例对象 */
export function getBridge(): DesktopBridge {
  if (!activeBridge) {
    return initBridge();
  }
  return activeBridge;
}

/** 默认导出的 Bridge 门面实例 */
export const bridge = new Proxy({} as DesktopBridge, {
  get(_target, prop) {
    const instance = getBridge();
    const val = Reflect.get(instance, prop);
    return typeof val === "function" ? val.bind(instance) : val;
  },
});

/**
 * Composition API: 获取统一强类型 IPC Bridge 实例
 * 支持解构调用：const { invoke, on } = useIpcBridge();
 */
export function useIpcBridge(): DesktopBridge {
  return bridge;
}

/** 兼容拼写别名与旧版 Hook 名称 */
export const useIpcBrige = useIpcBridge;

/**
 * Composition API: 获取统一 Bridge 实例
 */
export function useBridge(): DesktopBridge {
  return getBridge();
}

export { isElectron, isWeb, usePlatform };
