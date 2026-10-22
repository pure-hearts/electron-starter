/** 应用自定义资源协议 app:// 注册入口。 */
import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { activeRendererRoot } from '../update/hot'
import { resolveRendererAsset } from '../core/resource-path'
// 应在 app.whenReady 前注册 app 自定义资源协议为受信任标准协议。
protocol.registerSchemesAsPrivileged([{
  scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
}])
/** 创建生产构建页面地址；与用于外部唤起的 electron-starter:// 不同。 */
export function rendererURL(resource = '/') { return 'app://renderer' + (resource.startsWith('/') ? resource : '/' + resource) }
/** 注册 app:// 资源处理器，读取当前生效的渲染资源目录。 */
let resourceRegistered = false
export function registerResourceProtocol() {
  if (resourceRegistered) return
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
  resourceRegistered = true
}
/** 仅撤销本模块拥有的资源协议处理器，保留协议特权声明。 */
export function disposeResourceProtocol(): void {
  if (!resourceRegistered) return
  protocol.unhandle('app')
  resourceRegistered = false
}

export { DEEP_LINK_SCHEME, markDeepLinkRendererUnready, consumePendingDeepLinks, handleDeepLink, registerDeepLink, processDeepLinkArgs, disposeDeepLink } from './deep-link'
