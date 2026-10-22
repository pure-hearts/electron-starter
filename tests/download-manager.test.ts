import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DownloadManager } from '../src/main/modules/download/manager'
import type { DownloadState } from '../src/shared/ipc'

class Item extends EventEmitter {
  cancelled = false
  paused = false
  getURLChain() { return ['https://example.com/file'] }
  getURL() { return this.getURLChain()[0] }
  getFilename() { return 'file.zip' }
  setSavePath(_path: string) {}
  getTotalBytes() { return 100 }
  getReceivedBytes() { return 30 }
  isPaused() { return this.paused }
  canResume() { return true }
  cancel() { this.cancelled = true; this.emit('done', {}, 'cancelled') }
  pause() { this.paused = true }
  resume() { this.paused = false }
}
function harness() {
  const states: DownloadState[] = []
  let sequence = 0
  const manager = new DownloadManager({
    id: () => String(++sequence), destination: (id, name) => '/downloads/' + id + '-' + name,
    emit: state => states.push(state), report: () => undefined
  })
  const sender = { isDestroyed: () => false, downloadURL: vi.fn() }
  return { manager, states, sender }
}
afterEach(() => { vi.useRealTimers() })
describe('下载适配器生命周期', () => {
  it('同步进度不能被 started 回退，重复终态和迟到回调不广播', () => {
    const h = harness(); const item = new Item()
    h.sender.downloadURL.mockImplementation(() => { h.manager.accept(item); item.emit('updated', {}, 'progressing') })
    h.manager.start('https://example.com/file', h.sender)
    const late = item.listeners('updated')[0]
    item.emit('done', {}, 'completed'); late({}, 'progressing'); item.emit('done', {}, 'interrupted')
    expect(h.states.map(s => s.state)).toEqual(['queued', 'started', 'progress', 'completed'])
    expect(item.listenerCount('updated')).toBe(0)
    expect(item.listenerCount('done')).toBe(0)
  })
  it('取消立即释放槽位和计时器，不依赖原生 done', async () => {
    vi.useFakeTimers()
    const h = harness(); h.manager.setConcurrency(1)
    const first = h.manager.start('https://example.com/file', h.sender)
    const item = new Item(); h.manager.accept(item)
    item.cancel = () => { item.cancelled = true }
    h.manager.start('https://example.com/next', h.sender)
    h.manager.control(first, 'cancel'); await Promise.resolve()
    expect(h.sender.downloadURL).toHaveBeenCalledTimes(2)
    expect(h.states.filter(s => s.id === first).map(s => s.state)).toEqual(['queued', 'started', 'cancelled'])
    expect(item.listenerCount('updated')).toBe(0)
    h.manager.dispose(); expect(vi.getTimerCount()).toBe(0)
  })
  it('启动超时后迟到同 URL 事件不能认领重试任务', () => {
    vi.useFakeTimers()
    const h = harness(); const id = h.manager.start('https://example.com/file', h.sender)
    vi.advanceTimersByTime(20_000)
    expect(h.states.at(-1)?.state).toBe('failed')
    expect(() => h.manager.retry(id, h.sender)).toThrow()
    const late = new Item(); h.manager.accept(late)
    expect(late.cancelled).toBe(true)
    expect(h.manager.retry(id, h.sender)).toBeTruthy()
    h.manager.dispose()
  })
  it('网络中断没有 done 时有限等待后失败，并可重试', () => {
    vi.useFakeTimers()
    const h = harness(); const id = h.manager.start('https://example.com/file', h.sender)
    const item = new Item(); h.manager.accept(item)
    item.emit('updated', {}, 'interrupted'); vi.advanceTimersByTime(30_000)
    expect(h.states.at(-1)).toMatchObject({ id, state: 'failed' })
    expect(item.cancelled).toBe(true)
    expect(item.listenerCount('updated')).toBe(0)
    expect(h.manager.retry(id, h.sender)).toBeTruthy()
    h.manager.dispose()
  })
  it('安全重定向拒绝只产生 failed，不被同步 cancelled 抢占', () => {
    const h = harness(); h.manager.start('https://example.com/file', h.sender)
    const item = new Item(); item.getURLChain = () => ['https://example.com/file', 'file:///private/secret']
    h.manager.accept(item)
    expect(h.states.map(s => s.state)).toEqual(['queued', 'started', 'failed'])
    expect(item.cancelled).toBe(true)
  })
  it('dispose 撤销全部任务，已排队微任务不能重新下载', async () => {
    vi.useFakeTimers()
    const h = harness(); const item = new Item()
    h.manager.start('https://example.com/file', h.sender); h.manager.accept(item)
    h.manager.start('https://example.com/other', h.sender)
    h.manager.dispose(); h.manager.dispose(); await Promise.resolve()
    expect(h.sender.downloadURL).toHaveBeenCalledTimes(1)
    expect(h.states.filter(s => s.state === 'cancelled')).toHaveLength(2)
    expect(item.listenerCount('done')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
