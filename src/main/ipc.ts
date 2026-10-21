/**
 * 主进程 IPC 路由：集中处理渲染进程通过 window.$ipcBridge.invoke 发起的请求。
 * registerIPC 先检查调用来源和参数，再把请求分发给对应业务模块。
 * 这里拥有系统权限，不能直接信任页面发来的数据。
 */
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { InvokeChannel } from '../shared/ipc'
import { allowedChannels, validate } from '../shared/validation'
import { systemHandlers } from './handlers/system'
import { transferHandlers } from './handlers/transfer'
import { serviceHandlers } from './handlers/services'
import type { Handler } from './handlers/types'
import { isTrustedIpcOrigin } from './handlers/ipc-origin'
// 把每个通道映射到具体主进程功能；Record 确保通道与处理函数对应。
/** 汇总业务域 Handler；satisfies 保证每个约定通道均有处理器。 */
const handlers = {
  ...systemHandlers,
  ...transferHandlers,
  ...serviceHandlers
} satisfies Record<InvokeChannel, Handler>
/** 校验发送者为可信应用页面的顶层 Frame，阻止外部页面与 iframe 冒用权限。 */
function assertSender(e: IpcMainInvokeEvent) {
  // senderFrame 表示消息来源 frame；只接受主框架，拒绝嵌入的 iframe。
  const frame = e.senderFrame
  if (!frame || frame !== e.sender.mainFrame) throw new Error('IPC only allowed from top-level application frame')
  // URL 用于检查页面是否来自受信任的 app://renderer 或开发服务器。
  if (!isTrustedIpcOrigin(frame.url, process.env.VITE_DEV_SERVER_URL))
    throw new Error('IPC sender is not trusted')
}
/** 用 ipcMain.handle 建立请求/响应通道，与 Preload 的 ipcRenderer.invoke 对应。 */
export function registerIPC() {
  for (const channel of allowedChannels) {
    // invoke 的 Promise 会收到该异步处理函数返回值或抛出的错误。
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertSender(event)
      // TS 类型不会校验运行时参数；因此主进程必须再次检查。
      validate(channel, args)
      // 只有两层校验全部通过，才执行可能访问操作系统的业务操作。
      return handlers[channel](event, args)
    })
  }
}
