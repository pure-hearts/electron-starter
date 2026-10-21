import { describe, expect, it } from 'vite-plus/test'
import { DownloadQueue } from '../src/main/modules/download-queue'

describe('single-flight FIFO download queue', () => {
  it('runs tasks in insertion order and allows duplicate URLs', async () => {
    const calls: string[] = []
    const q = new DownloadQueue(() => { throw new Error('Unexpected failure') }, 1)
    expect(q.enqueue({ id: '1', url: 'https://example.com/a', begin: () => { calls.push('1') } })).toBe(false)
    expect(q.enqueue({ id: '2', url: 'https://example.com/a', begin: () => { calls.push('2') } })).toBe(true)
    expect(q.claim('https://example.com/a')).toBe('1')
    expect(calls).toEqual(['1'])
    q.finish('1')
    await Promise.resolve()
    expect(q.claim('https://example.com/a')).toBe('2')
    expect(calls).toEqual(['1', '2'])
    q.finish('2')
    expect(q.activeId).toBe(null)
  })
  it('removes queued tasks without interfering with active downloads', () => {
    const calls: string[] = []
    const q = new DownloadQueue(() => undefined, 1)
    q.enqueue({ id: 'a', url: 'https://example.com/a', begin: () => calls.push('a') })
    q.enqueue({ id: 'b', url: 'https://example.com/b', begin: () => calls.push('b') })
    expect(q.cancelQueued('b')?.url).toBe('https://example.com/b')
    expect(q.cancelQueued('a')).toBeNull()
    q.finish('a')
    expect(calls).toEqual(['a'])
  })
  it('continues after a sender cannot initiate a download', async () => {
    const failed: string[] = []
    const q = new DownloadQueue((task) => { failed.push(task.id) }, 1)
    q.enqueue({ id: 'busy', url: 'https://example.com/a', begin: () => undefined })
    q.enqueue({ id: 'bad', url: 'https://example.com/b', begin: () => { throw new Error('window closed') } })
    q.enqueue({ id: 'next', url: 'https://example.com/c', begin: () => undefined })
    q.finish('busy')
    await Promise.resolve()
    expect(failed).toEqual(['bad'])
    await Promise.resolve()
    expect(q.activeId).toBe('next')
  })
  it('ignores spurious completion and unrelated download URLs', () => {
    const q = new DownloadQueue(() => undefined, 1)
    q.enqueue({ id: 'a', url: 'https://example.com/a', begin: () => undefined })
    expect(q.claim('https://evil.example')).toBeNull()
    q.finish('not-current')
    expect(q.activeId).toBe('a')
  })
})

describe('并行下载调度', () => {
  it('最多三个同时传输，且同 URL 的开始事件不会串号', async () => {
    const starts: string[] = []
    const q = new DownloadQueue(() => { throw new Error('不应失败') }, 3)
    for (let n = 1; n <= 4; n++) {
      q.enqueue({ id: String(n), url: 'https://example.com/same', begin: () => starts.push(String(n)) })
    }
    expect(starts).toEqual(['1'])
    expect(q.claim('https://example.com/same')).toBe('1')
    await Promise.resolve()
    expect(starts).toEqual(['1', '2'])
    expect(q.claim('https://example.com/same')).toBe('2')
    await Promise.resolve()
    expect(starts).toEqual(['1', '2', '3'])
    expect(q.claim('https://example.com/same')).toBe('3')
    await Promise.resolve()
    // 三个任务已经占满槽位，第四个需要等待其中一个结束。
    expect(starts).toHaveLength(3)
    q.finish('2')
    await Promise.resolve()
    expect(starts).toEqual(['1', '2', '3', '4'])
    expect(q.claim('https://example.com/same')).toBe('4')
    q.finish('1'); q.finish('3'); q.finish('4')
  })
  it('忽略无关 URL，并可取消队列里的任意任务', async () => {
    const starts: string[] = []
    const q = new DownloadQueue(() => undefined, 2)
    for (const id of ['a','b','c']) q.enqueue({ id, url: 'https://example.com/' + id, begin: () => starts.push(id) })
    expect(q.claim('https://example.com/unrelated')).toBeNull()
    expect(q.cancelQueued('c')?.id).toBe('c')
    expect(q.claim('https://example.com/a')).toBe('a')
    await Promise.resolve()
    expect(starts).toEqual(['a','b'])
    q.finish('a')
    expect(q.claim('https://example.com/b')).toBe('b')
  })
})

describe('下载并发上限动态配置', () => {
  it('默认允许十个任务并发传输，第十一个排队', async () => {
    const starts: string[] = []
    const queue = new DownloadQueue(() => { throw new Error('unexpected error') })
    for (let n = 1; n <= 11; n++)
      queue.enqueue({ id: String(n), url: 'https://example.com/' + n, begin: () => starts.push(String(n)) })
    for (let n = 1; n <= 10; n++) {
      expect(queue.claim('https://example.com/' + n)).toBe(String(n))
      await Promise.resolve()
    }
    expect(starts).toHaveLength(10)
    queue.finish('1')
    await Promise.resolve()
    expect(starts).toHaveLength(11)
  })
  it('调高时补充任务，调低时不终止正在传输的任务', async () => {
    const starts: string[] = []
    const q = new DownloadQueue(() => undefined, 1)
    for (let i = 1; i <= 3; i++)
      q.enqueue({ id: String(i), url: 'https://example.com/' + i, begin: () => starts.push(String(i)) })
    expect(q.claim('https://example.com/1')).toBe('1')
    q.setConcurrency(2)
    await Promise.resolve()
    expect(starts).toEqual(['1', '2'])
    expect(q.claim('https://example.com/2')).toBe('2')
    q.setConcurrency(1)
    q.finish('1')
    await Promise.resolve()
    expect(starts).toHaveLength(2)
    q.finish('2')
    await Promise.resolve()
    expect(starts).toEqual(['1', '2', '3'])
  })
  it('拒绝非法并发数量', () => {
    const q = new DownloadQueue(() => undefined)
    for (const value of [0, 51, -1, 1.5, NaN, Infinity])
      expect(() => q.setConcurrency(value)).toThrow(RangeError)
    expect(q.concurrency).toBe(10)
  })
})

describe('下载队列状态一致性回归', () => {
  it('拒绝运行中和排队中的重复业务 ID，但允许不同 ID 的相同 URL', () => {
    const q = new DownloadQueue(() => undefined, 1)
    q.enqueue({ id: 'same', url: 'https://example.com/a', begin: () => undefined })
    q.enqueue({ id: 'waiting', url: 'https://example.com/a', begin: () => undefined })
    expect(() => q.enqueue({ id: 'same', url: 'https://example.com/b', begin: () => undefined })).toThrow('Duplicate download task ID')
    expect(() => q.enqueue({ id: 'waiting', url: 'https://example.com/b', begin: () => undefined })).toThrow('Duplicate download task ID')
    expect(q.runningCount).toBe(1)
    expect(q.pendingCount).toBe(1)
    q.finish('same')
    expect(q.runningCount).toBe(0)
  })
  it('任务失败后释放槽位并继续启动排队任务', async () => {
    const errors: string[] = []
    const starts: string[] = []
    const q = new DownloadQueue(task => errors.push(task.id), 1)
    q.enqueue({ id: 'first', url: 'https://example.com/a', begin: () => { throw new Error('closed') } })
    q.enqueue({ id: 'second', url: 'https://example.com/b', begin: () => starts.push('second') })
    await Promise.resolve()
    expect(errors).toEqual(['first'])
    expect(starts).toEqual(['second'])
    expect(q.runningCount).toBe(1)
  })
})
