/** Shared IPC channel names, payloads, and subscription events. */
export interface DesktopInvoke {
  'app:version': { args: []; result: string }
  'app:quit': { args: []; result: void }
  'app:restart': { args: []; result: void }
  'window:action': { args: [action: 'minimize' | 'maximize' | 'restore' | 'hide' | 'show' | 'close']; result: void }
  'window:open': { args: [route: string]; result: number }
  'store:get': { args: [key: SettingKey]; result: string | boolean | null }
  'store:set': { args: [key: SettingKey, value: string | boolean]; result: void }
  'store:delete': { args: [key: SettingKey]; result: void }
  'startup:get': { args: []; result: boolean }
  'startup:set': { args: [enabled: boolean]; result: boolean }
  'notification:show': { args: [title: string, body: string]; result: void }
  'download:start': { args: [url: string]; result: string }
  'download:cancel': { args: [id: string]; result: void }
  'download:pause': { args: [id: string]; result: void }
  'download:resume': { args: [id: string]; result: void }
  'download:retry': { args: [failedId: string]; result: string }
  'print:printers': { args: []; result: { name: string; displayName: string }[] }
  'print:execute': { args: []; result: { success: boolean; failureReason?: string } }
  'updater:check': { args: []; result: void }
  'updater:install': { args: []; result: void }
  'hot:check': { args: []; result: HotUpdateResult }
  'hot:confirm': { args: []; result: void }
  'log:write': { args: [level: 'info' | 'warn' | 'error', message: string]; result: void }
  'log:export': { args: []; result: string | null }
  'protocol:scheme': { args: []; result: string }
  'protocol:pending': { args: []; result: string[] }
}
export type SettingKey = 'theme' | 'locale' | 'closeToTray' | 'windowBounds'
export type InvokeChannel = keyof DesktopInvoke
export type InvokeArgs<C extends InvokeChannel> = DesktopInvoke[C]['args']
export type InvokeResult<C extends InvokeChannel> = DesktopInvoke[C]['result']
export interface DownloadState { id: string; url: string; state: 'queued' | 'started' | 'progress' | 'paused' | 'completed' | 'cancelled' | 'failed'; percent?: number; path?: string; error?: string }
export interface UpdateState { kind: 'full' | 'hot'; status: string; percent?: number; error?: string }
export interface HotUpdateResult { status: 'disabled' | 'up-to-date' | 'ready' | 'error'; message?: string }
export interface DesktopEvents {
  'download:state': DownloadState
  'update:state': UpdateState
  'protocol:open': string
  'notification:clicked': string
}
export type EventChannel = keyof DesktopEvents
export interface DesktopBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>
  on<E extends EventChannel>(channel: E, callback: (payload: DesktopEvents[E]) => void): () => void
}
