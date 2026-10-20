import type { InvokeChannel, SettingKey } from './ipc'
/** Runtime validation is required even if TS types compile. */
export const SETTINGS = new Set<SettingKey>(['theme','locale','closeToTray','windowBounds'])
export const allowedChannels = new Set<InvokeChannel>([
  'app:version','app:quit','window:action','window:open','store:get','store:set','store:delete',
  'startup:get','startup:set','notification:show','download:start','download:cancel',
  'download:pause','download:resume','print:printers','print:execute','updater:check',
  'updater:install','hot:check','hot:confirm','log:write','log:export','protocol:scheme'
])
export function safeUrl(input: string): URL {
  if (typeof input !== 'string' || input.length > 4096) throw new Error('Invalid URL')
  const url = new URL(input)
  if (url.protocol !== 'https:') throw new Error('Only HTTPS downloads are allowed')
  if (url.username || url.password) throw new Error('Credentials in URLs are not permitted')
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' ||
    host === '0.0.0.0' || host.startsWith('127.') || host.startsWith('10.') ||
    host.startsWith('192.168.') || host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  ) throw new Error('Private network addresses are not permitted')
  return url
}
export function validate(channel: InvokeChannel, args: unknown[]): void {
  const str = (i: number, max = 512) => typeof args[i] === 'string' && (args[i] as string).length > 0 && (args[i] as string).length <= max
  const noArgs = ['app:version','app:quit','startup:get','print:printers','print:execute','updater:check','updater:install','hot:check','hot:confirm','log:export','protocol:scheme']
  if (noArgs.includes(channel) && args.length === 0) return
  if (channel === 'window:action' && args.length === 1 && ['minimize','maximize','restore','hide','show','close'].includes(args[0] as string)) return
  if (channel === 'window:open' && args.length === 1 && str(0) && /^\/[\w/-]*$/.test(args[0] as string)) return
  if ((channel === 'store:get' || channel === 'store:delete') && args.length === 1 && SETTINGS.has(args[0] as SettingKey)) return
  if (channel === 'store:set' && args.length === 2 && SETTINGS.has(args[0] as SettingKey)) {
    const [key, value] = args
    if (key === 'closeToTray' && typeof value === 'boolean') return
    if (key === 'locale' && (value === 'zh-CN' || value === 'en-US')) return
    if (key === 'theme' && (value === 'light' || value === 'dark' || value === 'system')) return
    if (key === 'windowBounds' && typeof value === 'string' && value.length <= 512) return
  }
  if (channel === 'startup:set' && args.length === 1 && typeof args[0] === 'boolean') return
  if (channel === 'notification:show' && args.length === 2 && str(0,128) && str(1,1000)) return
  if (channel === 'download:start' && args.length === 1 && str(0,4096)) { safeUrl(args[0] as string); return }
  if (['download:cancel','download:pause','download:resume'].includes(channel) && args.length === 1 && str(0,64)) return
  if (channel === 'log:write' && args.length === 2 && ['info','warn','error'].includes(args[0] as string) && str(1,2048)) return
  throw new Error('Invalid IPC arguments: ' + channel)
}
