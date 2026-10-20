import { app, net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { log } from './logger'
import { broadcast, focusMainWindow, getMainWindow } from '../window'
import { activeRendererRoot } from './hot-update'
import { DeepLinkInbox } from './deep-link-inbox'
export const DEEP_LINK_SCHEME = 'electron-starter'
const inbox = new DeepLinkInbox(DEEP_LINK_SCHEME)
let rendererSubscribed = false
export function markDeepLinkRendererUnready(): void { rendererSubscribed = false }
export function consumePendingDeepLinks(): string[] {
  rendererSubscribed = true
  return inbox.drain()
}
protocol.registerSchemesAsPrivileged([{
  scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
}])
export function rendererURL(resource = '/') { return 'app://renderer' + (resource.startsWith('/') ? resource : '/' + resource) }
export function registerResourceProtocol() {
  protocol.handle('app', req => {
    const u = new URL(req.url)
    if (u.hostname !== 'renderer') return new Response('Forbidden', { status: 403 })
    let decoded: string
    try { decoded = decodeURIComponent(u.pathname) } catch { return new Response('Bad request', { status: 400 }) }
    if (decoded.includes('\\') || decoded.includes('\0')) return new Response('Forbidden', { status: 403 })
    const root = activeRendererRoot()
    const target = path.resolve(root, '.' + decoded)
    if (target !== root && !target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 })
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root, 'index.html')
    return net.fetch(pathToFileURL(file).toString())
  })
}
function deepLinkFromArgs(args: string[]) { return args.find(x => x.startsWith(DEEP_LINK_SCHEME + '://')) }
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
export function registerDeepLink() {
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])])
  else app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
  app.on('open-url', (event, url) => { event.preventDefault(); handleDeepLink(url) })
}
export function processDeepLinkArgs(argv: string[]) {
  const url = deepLinkFromArgs(argv)
  if (url) handleDeepLink(url)
}
