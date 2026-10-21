import { describe, expect, it } from 'vite-plus/test'
import { isTrustedWindowNavigation } from '../src/main/modules/window-navigation-policy'

describe('窗口导航边界', () => {
  it('允许打包应用内协议与 fragment 路由', () => {
    expect(isTrustedWindowNavigation('app://renderer/index.html#/playground')).toBe(true)
    expect(isTrustedWindowNavigation('app://other/index.html')).toBe(false)
  })
  it('拒绝外网、脚本、文件以及伪造 Origin', () => {
    for (const url of [
      'https://evil.example/', 'file:///tmp/demo', 'javascript:alert(1)',
      'http://localhost.evil.example:5173/', 'app://evil/index.html', 'not-a-url'
    ]) expect(isTrustedWindowNavigation(url, { devServerUrl: 'http://localhost:5173/' })).toBe(false)
  })
  it('开发模式仅开放配置的回环服务器 Origin', () => {
    const options = { devServerUrl: 'http://localhost:5173/' }
    expect(isTrustedWindowNavigation('http://localhost:5173/#/playground', options)).toBe(true)
    expect(isTrustedWindowNavigation('http://localhost:5174/', options)).toBe(false)
    expect(isTrustedWindowNavigation('https://example.com/', { devServerUrl: 'https://example.com/' })).toBe(false)
    expect(isTrustedWindowNavigation('http://localhost:5173/', { devServerUrl: 'file:///etc/passwd' })).toBe(false)
  })
})
