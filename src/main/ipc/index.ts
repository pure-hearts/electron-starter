/**
 * 主进程 IPC 路由：集中处理渲染进程通过 window.$ipcBridge.invoke 发起的请求。
 * registerIPC 先检查调用来源和参数，再把请求分发给对应业务模块。
 * 这里拥有系统权限，不能直接信任页面发来的数据。
 */
import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { InvokeChannel } from "../../shared/ipc";
import { allowedChannels, validate } from "../../shared/validation";
import { allHandlers } from "./handlers";
import { isTrustedIpcOrigin } from "./origin";
import { withTimeoutAndMetrics } from "./timeout";
import { log } from "../modules/core/logger";

// 把每个通道映射到具体主进程功能；Record 确保通道与处理函数对应。
/** 汇总业务域 Handler；satisfies 保证每个约定通道均有处理器。 */
const handlers = allHandlers as Record<
  InvokeChannel,
  (event: IpcMainInvokeEvent, args: unknown[]) => unknown
>;

/** 校验消息来源，防御恶意注入或伪造消息。 */
function assertSender(e: IpcMainInvokeEvent) {
  // senderFrame 表示消息来源 frame；只接受主框架，拒绝嵌入的 iframe。
  const frame = e.senderFrame;
  if (e.sender.isDestroyed() || !frame || frame !== e.sender.mainFrame) {
    throw new Error("IPC only allowed from top-level application frame");
  }
  // URL 用于检查页面是否来自受信任的 app://renderer 或开发服务器。
  if (!isTrustedIpcOrigin(frame.url, process.env.VITE_DEV_SERVER_URL)) {
    throw new Error("IPC sender is not trusted");
  }
}

/**
 * 保持原有 invoke 的返回值与 Promise rejection 协议，只替换不受控异常的消息。
 * Electron 会把 Error.message 传给页面，不能直接抛出文件系统/网络 SDK 的错误。
 */
async function dispatch(channel: InvokeChannel, event: IpcMainInvokeEvent, args: unknown[]) {
  try {
    assertSender(event);
  } catch {
    throw new Error("IPC_FORBIDDEN: 页面无权执行此操作");
  }
  try {
    validate(channel, args);
  } catch {
    throw new Error("IPC_INVALID_ARGUMENTS: 请求参数无效");
  }
  try {
    // 注入统一的超时熔断与执行耗时度量，杜绝渲染层无限等待
    return await withTimeoutAndMetrics(async () => await handlers[channel](event, args), channel);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("IPC_TIMEOUT:")) {
      log.error("IPC operation timed out", channel, error);
      throw error;
    }
    // 详细上下文仅记录在主进程；页面收到固定文案，不含路径、凭据或原始堆栈。
    log.error("IPC operation failed", channel, error);
    throw new Error("IPC_OPERATION_FAILED: 操作失败，请重试或查看诊断日志");
  }
}

/** 用 ipcMain.handle 建立请求/响应通道，与 Preload 的 ipcRenderer.invoke 对应。 */
let registeredChannels: InvokeChannel[] = [];

export function registerIPC() {
  if (registeredChannels.length) return;
  const installed: InvokeChannel[] = [];
  try {
    for (const channel of allowedChannels) {
      ipcMain.handle(channel, (event, ...args: unknown[]) => dispatch(channel, event, args));
      installed.push(channel);
    }
    registeredChannels = installed;
  } catch (error) {
    // 只撤销本次成功注册的处理器，不移除产生冲突的其他所有者的通道。
    for (const channel of installed) ipcMain.removeHandler(channel);
    throw error;
  }
}

/** 初始化回滚和退出时释放本模块拥有的通道；可重复调用。 */
export function unregisterIPC(): void {
  const previous = registeredChannels;
  registeredChannels = [];
  for (const channel of previous) ipcMain.removeHandler(channel);
}
