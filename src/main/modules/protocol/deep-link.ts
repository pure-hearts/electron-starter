/** 外部唤起 Deep Link：系统协议注册、入队与广播。 */
import { app } from "electron";
import path from "node:path";
import { log } from "../core/logger";
import { runtimeConfig } from "../core/config";
import { broadcast, focusMainWindow, getMainWindow } from "../../window";
import { DeepLinkInbox } from "./deep-link-inbox";

// 外部软件通过自定义协议 (如 electron-starter://...) 唤起已安装应用。
export const DEEP_LINK_SCHEME = runtimeConfig().deepLinkScheme;
const inbox = new DeepLinkInbox(DEEP_LINK_SCHEME);
// 用于判断页面是否已开始接收实时 Deep Link 事件。
let rendererSubscribed = false;
export function markDeepLinkRendererUnready(): void {
  rendererSubscribed = false;
}
/** 页面订阅完成后领取历史积压链接，并清空队列防止重复处理。 */
export function consumePendingDeepLinks(): string[] {
  rendererSubscribed = true;
  return inbox.drain();
}
function deepLinkFromArgs(args: string[]) {
  return args.find((x) => x.startsWith(DEEP_LINK_SCHEME + "://"));
}
/** 处理系统传入的链接；冷启动时先入队，窗口可用且订阅后再广播。 */
export function handleDeepLink(input: string) {
  const url = inbox.accept(input);
  if (!url) {
    log.warn("Rejected invalid Deep Link");
    return;
  }
  // macOS may deliver open-url before app.whenReady: do not create a window yet.
  if (app.isReady()) {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      focusMainWindow();
      if (rendererSubscribed) {
        // A subscribed renderer already receives live pushes. Drain exactly once.
        for (const pending of inbox.drain()) broadcast("protocol:open", pending);
      }
    }
  }
}
/** 注册操作系统协议关联，并监听 macOS 的 open-url 事件。 */
const onOpenUrl = (event: Electron.Event, url: string) => {
  event.preventDefault();
  handleDeepLink(url);
};
let deepLinkRegistered = false;
export function registerDeepLink() {
  if (deepLinkRegistered) return;
  // 开发模式需要附加脚本入口参数；打包后则只注册可执行文件。
  if (process.defaultApp && process.argv[1])
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  else app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  app.on("open-url", onOpenUrl);
  deepLinkRegistered = true;
}
/** Windows/Linux 等平台常把协议 URL 放在启动命令行参数中。 */
export function processDeepLinkArgs(argv: string[]) {
  const url = deepLinkFromArgs(argv);
  if (url) handleDeepLink(url);
}
/** 退出时取消本进程监听，不删除用户操作系统中的协议关联。 */
export function disposeDeepLink(): void {
  app.removeListener("open-url", onOpenUrl);
  deepLinkRegistered = false;
  rendererSubscribed = false;
  inbox.drain();
}
