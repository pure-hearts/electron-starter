/**
 * @file network-module.ts
 * @description 监听与管理系统网络连接状态，向渲染进程广播连接变更事件。
 */
import { net } from "electron";
import { broadcast } from "../../window";

let lastOnlineStatus = true;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 获取当前网络连通状态
 */
export function getNetworkStatus(): { isOnline: boolean } {
  try {
    const isOnline = net.isOnline();
    lastOnlineStatus = isOnline;
    return { isOnline };
  } catch {
    return { isOnline: true };
  }
}

/**
 * 启动周期性网络探测并检测状态跃迁
 */
export function initNetworkMonitor(): void {
  lastOnlineStatus = getNetworkStatus().isOnline;

  // 定期检测（每 5 秒），若状态发生变动则广播事件
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      try {
        const current = net.isOnline();
        if (current !== lastOnlineStatus) {
          lastOnlineStatus = current;
          broadcast("network:change", { isOnline: current });
        }
      } catch {
        // 忽略状态检查偶发错误
      }
    }, 5000);
  }
}

/**
 * 释放网络监听
 */
export function disposeNetworkMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
