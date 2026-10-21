/**
 * Preload 运行在隔离的预加载环境，负责连接网页和 Electron 主进程。
 * invoke 发起请求并等待结果，on 订阅主进程推送的事件。
 * 页面只接触 window.desktop，不直接获取 ipcRenderer。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge, InvokeChannel, InvokeArgs, InvokeResult, EventChannel, DesktopEvents } from '../shared/ipc'
import { allowedChannels } from '../shared/validation'
const eventNames = new Set<EventChannel>(['download:state','update:state','protocol:open','notification:clicked'])
const bridge: DesktopBridge = {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>> {
    if (!allowedChannels.has(channel)) return Promise.reject(new Error('IPC channel denied'))
    return ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>
  },
  on<E extends EventChannel>(channel: E, callback: (payload: DesktopEvents[E]) => void): () => void {
    if (!eventNames.has(channel)) throw new Error('Event channel denied')
    const listener = (_event: Electron.IpcRendererEvent, payload: DesktopEvents[E]) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}
contextBridge.exposeInMainWorld('desktop', bridge)
