/** IPC 与窗口导航使用同一个来源策略，避免两处白名单逐渐分叉。 */
import { isTrustedWindowNavigation } from '../modules/system/window-navigation-policy'

export function isTrustedIpcOrigin(frameURL: string, viteURL?: string): boolean {
  return isTrustedWindowNavigation(frameURL, { devServerUrl: viteURL })
}
