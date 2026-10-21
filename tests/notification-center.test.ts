import { describe, expect, it } from 'vite-plus/test'
import { NotificationCenter, type NativeNotice } from '../src/main/modules/notification-center'
import { validate } from '../src/shared/validation'

// 用最小模拟原生适配器验证主进程逻辑，无需启动桌面图形环境。
function harness() {
  let time = 10000
  const notices: Array<{ handlers: Record<string, () => void>; shown: boolean; closed: boolean }> = []
  const activations: unknown[] = []
  const settled: unknown[] = []
  const center = new NotificationCenter({
    supported: () => true,
    create: () => {
      const state = { handlers: {} as Record<string, () => void>, shown: false, closed: false }
      notices.push(state)
      return {
        show: () => { state.shown = true },
        close: () => { state.closed = true; state.handlers.close?.() },
        on: (event, fn) => { state.handlers[event] = fn }
      } satisfies NativeNotice
    },
    activated: data => { activations.push(data) },
    settled: data => { settled.push(data) }
  }, () => time)
  return { center, notices, activations, settled, advance: (ms: number) => { time += ms } }
}
describe('通知中心', () => {
  it('通知具有唯一 ID，点击包含来源窗口并兼容原生生命周期', () => {
    const h = harness()
    const a = h.center.send({ title: '完成', body: '下载完成', kind: 'success', action: '/downloads' }, 8)
    expect(a.accepted).toBe(true)
    expect(a.id.length).toBeGreaterThan(10)
    expect(h.notices[0].shown).toBe(true)
    h.notices[0].handlers.click()
    expect(h.activations).toEqual([{ id: a.id, kind: 'success', action: '/downloads', sourceWindowId: 8 }])
    expect(h.center.close(a.id)).toBe(true)
    expect(h.notices[0].closed).toBe(true)
    expect(h.center.close(a.id)).toBe(false)
  })
  it('短时间内去重，并限流后可继续发送', () => {
    const h = harness()
    expect(h.center.send({ title: '任务', body: 'A', dedupeKey: 'one' }).accepted).toBe(true)
    expect(h.center.send({ title: '任务', body: 'A', dedupeKey: 'one' }).reason).toBe('duplicate')
    for (let i = 0; i < 9; i++) expect(h.center.send({ title: '任务', body: String(i) }).accepted).toBe(true)
    expect(h.center.send({ title: '过多', body: '重复' }).reason).toBe('rate-limited')
    h.advance(10001)
    expect(h.center.send({ title: '恢复', body: '正常' }).accepted).toBe(true)
  })
  it('通知 IPC 拒绝任意命令、恶意 URL 和未知字段', () => {
    expect(() => validate('notification:send', [{ title: 'Hi', body: 'OK', action: '/downloads' }])).not.toThrow()
    expect(() => validate('notification:capabilities', [])).not.toThrow()
    for (const bad of [
      { title: 'Hi', body: 'OK', action: 'https://evil.example' },
      { title: 'Hi', body: 'OK', action: '/../bad' },
      { title: 'Hi', body: 'OK', arbitraryCommand: 'rm' },
      { title: '', body: 'OK' }
    ]) expect(() => validate('notification:send', [bad])).toThrow()
  })
})

describe('通知结束状态', () => {
  it('主动关闭时只派发一次，迟到的原生 close 不重复通知', () => {
    const h = harness()
    const receipt = h.center.send({ title: '提示', body: '正文' })
    expect(h.center.close(receipt.id)).toBe(true)
    h.notices[0].handlers.close()
    h.notices[0].handlers.failed()
    expect(h.settled).toEqual([{ id: receipt.id, reason: 'closed' }])
    expect(h.center.activeCount).toBe(0)
  })
  it('原生 failed 状态清除记录并准确通知', () => {
    const h = harness()
    const receipt = h.center.send({ title: '失败', body: '正文' })
    h.notices[0].handlers.failed()
    expect(h.settled).toEqual([{ id: receipt.id, reason: 'failed' }])
    expect(h.center.close(receipt.id)).toBe(false)
  })
})

describe('通知终态后的点击保护', () => {
  it('通知关闭后迟到的 click 不再唤醒窗口', () => {
    const h = harness()
    const receipt = h.center.send({ title: '测试', body: '说明' })
    h.center.close(receipt.id)
    h.notices[0].handlers.click()
    expect(h.activations).toEqual([])
  })
})
