import { describe, expect, it } from 'vite-plus/test'
import { isTrustedIpcOrigin } from '../src/main/ipc/origin'
describe('IPC sender origin', () => {
  it('接受应用页面与本地开发服务', () => {
    expect(isTrustedIpcOrigin('app://renderer/index.html')).toBe(true)
    expect(isTrustedIpcOrigin('http://localhost:5173/', 'http://localhost:5173/')).toBe(true)
  })
  it('拒绝伪装域、外部开发源及坏 URL', () => {
    for (const url of ['file:///tmp/x', 'http://localhost.evil.test/', 'https://evil.test/', 'invalid'])
      expect(isTrustedIpcOrigin(url, 'http://localhost:5173/')).toBe(false)
    expect(isTrustedIpcOrigin('https://evil.test/', 'https://evil.test/')).toBe(false)
  })
})
