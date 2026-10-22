import { describe, expect, it } from 'vite-plus/test'
import { DeepLinkInbox } from '../src/main/modules/protocol/deep-link-inbox'

// 这一组是纯逻辑回归测试：不模拟系统级协议注册，也不声称已完成 Windows/macOS 真机验收。
describe('native deep-link input validation', () => {
  it('rejects non-string, empty and malformed input without changing the queue', () => {
    const inbox = new DeepLinkInbox('electron-starter')
    // 外部唤起参数是不可信输入，主进程必须能安全拒绝不符合格式的值。
    for (const input of [undefined, null, 123, {}, '', 'not-a-url', '://broken']) {
      expect(inbox.accept(input)).toBeNull()
    }
    expect(inbox.length).toBe(0)
    expect(inbox.drain()).toEqual([])
  })

  it('rejects oversized links and links containing URL credentials', () => {
    const inbox = new DeepLinkInbox('electron-starter')
    // 长度上限防止恶意参数无限占用内存；账号密码不能通过 Deep Link 传递。
    expect(inbox.accept('electron-starter://open/' + 'a'.repeat(2049))).toBeNull()
    expect(inbox.accept('electron-starter://user:password@open/settings')).toBeNull()
    expect(inbox.accept('electron-starter://user@open/settings')).toBeNull()
    expect(inbox.length).toBe(0)
  })

  it('keeps a valid link after invalid inputs and hands it off exactly once', () => {
    const inbox = new DeepLinkInbox('electron-starter')
    // 不合法的唤起不能破坏已经缓存的合法链接。
    expect(inbox.accept('electron-starter://open/settings')).toBe('electron-starter://open/settings')
    expect(inbox.accept('https://example.com/open/settings')).toBeNull()
    expect(inbox.accept('electron-starter://user:password@open/settings')).toBeNull()
    expect(inbox.length).toBe(1)
    expect(inbox.drain()).toEqual(['electron-starter://open/settings'])
    expect(inbox.length).toBe(0)
    expect(inbox.drain()).toEqual([])
  })
})
