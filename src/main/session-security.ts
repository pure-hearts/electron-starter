/** 仅对正式协议页面追加 CSP，并拒绝页面未授权的系统权限。 */
import { session } from 'electron'
export function configureSessionSecurity(): void {
      if (!process.env.VITE_DEV_SERVER_URL) {
        // 向生产页面注入 CSP，限制脚本、资源和网络连接的加载来源。
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          if (details.url.startsWith('app://renderer/')) {
            callback({ responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; object-src 'none'; frame-src 'none'; base-uri 'none'"]
            } })
          } else callback({ responseHeaders: details.responseHeaders })
        })
      }
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  
}
