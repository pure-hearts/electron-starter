/** 窗口导航安全策略：纯函数，不依赖 Electron，便于独立测试。 */
export interface WindowNavigationConfig {
  devServerUrl?: string;
}

/**
 * 只允许应用自身的 app://renderer 页面，或当前明确声明的开发服务器 Origin。
 * URL() 会规范化主机名；拒绝不合法 URL、外部协议及误配的开发服务器。
 */
export function isTrustedWindowNavigation(
  target: string,
  config: WindowNavigationConfig = {},
): boolean {
  try {
    const url = new URL(target);
    // 打包应用的自定义协议只能是 renderer 主机，不能放行外部 app:// 地址。
    if (
      url.protocol === "app:" &&
      url.hostname === "renderer" &&
      !url.port &&
      !url.username &&
      !url.password
    )
      return true;
    if (!config.devServerUrl) return false;
    const dev = new URL(config.devServerUrl);
    // 开发模式仅支持 loopback HTTP / HTTPS，避免配置被意外指向不可信站点。
    if (!["http:", "https:"].includes(dev.protocol)) return false;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(dev.hostname)) return false;
    return url.origin === dev.origin && !url.username && !url.password;
  } catch {
    return false;
  }
}
