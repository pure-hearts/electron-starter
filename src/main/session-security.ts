/** 会话策略先于页面创建安装，退出时才释放；应用运行期间始终拒绝系统权限。 */
import { session } from "electron";
let configured = false;
export function configureSessionSecurity(): void {
  if (configured) return;
  configured = true;
  if (!process.env.VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith("app://renderer/")) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; object-src 'none'; frame-src 'none'; base-uri 'none'",
            ],
          },
        });
      } else callback({ responseHeaders: details.responseHeaders });
    });
  }
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  // request 与 check 是不同入口，必须同时拒绝，避免只阻止弹窗却允许权限查询。
  session.defaultSession.setPermissionCheckHandler(() => false);
}

export function disposeSessionSecurity(): void {
  if (!configured) return;
  configured = false;
  session.defaultSession.webRequest.onHeadersReceived(null);
  session.defaultSession.setPermissionRequestHandler(null);
  session.defaultSession.setPermissionCheckHandler(null);
}
