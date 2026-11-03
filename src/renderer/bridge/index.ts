/**
 * @file index.ts
 * @description 统一 Desktop IPC Bridge 调度入口：
 * 接入 Electron 桌面端原生 Preload IPC 桥接对象，
 * 提供严格类型安全、防崩溃安全包装与统一调用门面。
 */

import type { DesktopBridge } from "@shared/ipc";
import { isElectron, isWeb, usePlatform } from "./platform";

let activeBridge: DesktopBridge | null = null;

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
 * 创建非 Electron 宿主环境下的哨兵 Bridge：
 * 当脱离桌面客户端直接运行（如纯前端调试或未正确加载 Preload）时，提供明确的报错与警告提示，
 * 代替维护庞大脆弱的双轨伪实现。
 */
function createUnavailableBridge(): DesktopBridge & { __isUnavailable: true } {
  return {
    __isUnavailable: true,
    invoke: (channel, ...args) => {
      const err = new Error(
        `[DesktopBridge] IPC 通道 "${String(channel)}" 调用失败: 当前环境未检测到 Electron 原生桥接对象 (window.$ipcBridge)`,
      );
      console.warn(err.message, { channel, args });
      return Promise.reject(err);
    },
    on: (channel) => {
      console.warn(
        `[DesktopBridge] 无法订阅事件 "${String(channel)}": 当前环境未检测到 Electron 原生桥接对象`,
      );
      return () => {};
    },
  };
}

/**
 * 初始化全局 Bridge 并保证 window.$ipcBridge 安全可用
 */
export function initBridge(): DesktopBridge {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    activeBridge = wrapSafeBridge(window.$ipcBridge);
    return activeBridge;
  }

  activeBridge = createUnavailableBridge();
  return activeBridge;
}

/** 获取当前环境可用的 Bridge 单例对象 */
export function getBridge(): DesktopBridge {
  if (
    typeof window !== "undefined" &&
    window.$ipcBridge &&
    (!activeBridge || (activeBridge as { __isUnavailable?: boolean }).__isUnavailable)
  ) {
    return initBridge();
  }
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
