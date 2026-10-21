/** 应用自定义资源协议 app:// 和外部唤起 Deep Link 的入口。两者用途不同。 */
import { app, net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { log } from './logger'
import { broadcast, focusMainWindow, getMainWindow } from '../window'
import { activeRendererRoot } from './hot-update'
import { DeepLinkInbox } from './deep-link-inbox'
import { resolveRendererAsset } from './resource-path'
// 外部软件通过 electron-starter://... 唤起已安装应用。
export const DEEP_LINK_SCHEME = 'electron-starter'
const inbox = new DeepLinkInbox(DEEP_LINK_SCHEME)
// 用于判断页面是否已开始接收实时 Deep Link 事件。
let rendererSubscribed = false
export function markDeepLinkRendererUnready(): void { rendererSubscribed = false }
/** 页面订阅完成后领取历史积压链接，并清空队列防止重复处理。 */
export function consumePendingDeepLinks(): string[] {
  rendererSubscribed = true
  return inbox.drain()
}
// 应在 app.whenReady 前注册 app 自定义资源协议为受信任标准协议。
protocol.registerSchemesAsPrivileged([{
  scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
}])
/** 创建生产构建页面地址；与用于外部唤起的 electron-starter:// 不同。 */
export function rendererURL(resource = '/') { return 'app://renderer' + (resource.startsWith('/') ? resource : '/' + resource) }
/** 注册 app:// 资源处理器，读取当前生效的渲染资源目录。 */
export function registerResourceProtocol() {
  protocol.handle('app', req => {
    const u = new URL(req.url)
    // 拒绝不是 renderer 主机名的请求，避免把该协议当作通用文件读取入口。
    if (u.hostname !== 'renderer') return new Response('Forbidden', { status: 403 })
    // resolveRendererAsset 负责验证规范化路径、遍历攻击和符号链接逃逸。
    const resolved = resolveRendererAsset(activeRendererRoot(), u.pathname)
    if (!resolved) return new Response('Not Found', { status: 404 })
    // 将通过校验的真实文件路径转为 file: URL，再交给 Electron 网络层读取。
    return net.fetch(pathToFileURL(resolved).toString())
  })
}
function deepLinkFromArgs(args: string[]) { return args.find(x => x.startsWith(DEEP_LINK_SCHEME + '://')) }
/** 处理系统传入的链接；冷启动时先入队，窗口可用且订阅后再广播。 */
export function handleDeepLink(input: string) {
  const url = inbox.accept(input)
  if (!url) { log.warn('Rejected invalid Deep Link'); return }
  // macOS may deliver open-url before app.whenReady: do not create a window yet.
  if (app.isReady()) {
    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      focusMainWindow()
      if (rendererSubscribed) {
        // A subscribed renderer already receives live pushes. Drain exactly once.
        for (const pending of inbox.drain()) broadcast('protocol:open', pending)
      }
    }
  }
}
/** 注册操作系统协议关联，并监听 macOS 的 open-url 事件。 */
export function registerDeepLink() {
  // 开发模式需要附加脚本入口参数；打包后则只注册可执行文件。
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])])
  else app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
  app.on('open-url', (event, url) => { event.preventDefault(); handleDeepLink(url) })
}
/** Windows/Linux 等平台常把协议 URL 放在启动命令行参数中。 */
export function processDeepLinkArgs(argv: string[]) {
  const url = deepLinkFromArgs(argv)
  if (url) handleDeepLink(url)
}
