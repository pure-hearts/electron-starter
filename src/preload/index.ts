/**
 * Preload 在页面脚本执行前加载，是渲染进程和主进程之间的安全桥梁。
 * 本文件的主要任务是：暴露最小接口、检查通道白名单、管理事件订阅。
 */
// contextBridge 用于把受控对象暴露给网页；ipcRenderer 负责向主进程发送 IPC 消息。
import { contextBridge, ipcRenderer } from 'electron'
// 导入双方共享的 TypeScript 协议类型，确保通道名称、参数和返回值都有类型提示。
import type { DesktopBridge, InvokeChannel, InvokeArgs, InvokeResult, EventChannel, DesktopEvents } from '../shared/ipc'
// 请求通道白名单：拒绝页面调用未经明确注册的 Electron 功能。
import { allowedChannels } from '../shared/validation'

// 事件白名单：仅允许页面订阅下载进度、更新状态、协议唤起和通知点击等事件。
const eventNames = new Set<EventChannel>(['download:state','update:state','protocol:open','notification:clicked','notification:activated'])

// bridge 是唯一提供给页面的桌面 API，而不是暴露整个 ipcRenderer。
const bridge: DesktopBridge = {
  /**
   * 请求/响应通信：例如 invoke('app:version') 会返回 Promise<string>。
   * C 为通道类型；InvokeArgs<C> 和 InvokeResult<C> 随通道自动推导。
   */
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>> {
    // 未列入白名单时立即拒绝，避免意外开放主进程操作。
    if (!allowedChannels.has(channel)) return Promise.reject(new Error('IPC channel denied'))
    // ipcRenderer.invoke 会与主进程中的 ipcMain.handle(channel, ...) 配对。
    // 类型断言只帮助 TypeScript 编译；主进程还必须独立校验来源和参数。
    return ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>
  },
  /**
   * 单向事件订阅：主进程 webContents.send(channel, payload) 会触发 callback。
   * 返回取消订阅函数，页面不需要监听时调用它，防止重复监听和内存泄漏。
   */
  on<E extends EventChannel>(channel: E, callback: (payload: DesktopEvents[E]) => void): () => void {
    // 不允许页面监听任意内部事件，只能监听这里公开的事件名称。
    if (!eventNames.has(channel)) throw new Error('Event channel denied')
    // Electron 原始事件对象不传给网页；只交付明确声明的数据 payload。
    const listener = (_event: Electron.IpcRendererEvent, payload: DesktopEvents[E]) => callback(payload)
    // 注册监听器，后续主进程推送此通道时便会触发回调。
    ipcRenderer.on(channel, listener)
    // 返回清理函数，避免 Vue 组件重复挂载后积累多个事件监听器。
    return () => ipcRenderer.removeListener(channel, listener)
  }
}
// contextIsolation 开启时，网页不能直接读取 Preload 变量；这里显式暴露 window.$ipcBridge。
contextBridge.exposeInMainWorld('$ipcBridge', bridge)
