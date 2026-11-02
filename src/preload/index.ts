/**
 * Preload 脚本在页面渲染前执行，运行于受限沙箱环境中。
 * 作为渲染进程与主进程之间的安全桥梁，核心原则：
 * 1. 最小权限暴露：严禁暴露 Node 原生模块或整个 ipcRenderer；
 * 2. 双向白名单：基于 shared/validation 进行强类型双向白名单过滤；
 * 3. 内存安全：事件监听返回精确的 dispose/unsubscribe 清理函数。
 */
import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopBridge,
  InvokeChannel,
  InvokeArgs,
  InvokeResult,
  EventChannel,
  DesktopEvents,
} from "../shared/ipc";
import { allowedChannels, allowedEvents } from "../shared/validation";

const bridge: DesktopBridge = {
  /**
   * 双向请求/响应通信：invoke('channel', ...args)
   * 仅放行在 allowedChannels 白名单中严格声明的请求通道。
   */
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>> {
    if (!allowedChannels.has(channel)) {
      return Promise.reject(new Error(`IPC channel denied: ${String(channel)}`));
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>;
  },

  /**
   * 单向主进程推送订阅：on('channel', (payload) => void)
   * 仅放行在 allowedEvents 白名单中声明的受控系统事件，交付前剥离 Electron 内部 event 对象。
   */
  on<E extends EventChannel>(
    channel: E,
    callback: (payload: DesktopEvents[E]) => void,
  ): () => void {
    if (!allowedEvents.has(channel)) {
      throw new Error(`Event channel denied: ${String(channel)}`);
    }
    if (typeof callback !== "function") {
      throw new TypeError("Event listener callback must be a function");
    }

    const listener = (_event: Electron.IpcRendererEvent, payload: DesktopEvents[E]) => {
      callback(payload);
    };

    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

// 借助 contextBridge 安全挂载到宿主全局对象 window.$ipcBridge 上
contextBridge.exposeInMainWorld("$ipcBridge", bridge);
