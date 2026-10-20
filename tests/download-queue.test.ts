import { describe, expect, it } from 'vite-plus/test'
import { DownloadQueue } from '../src/main/modules/download-queue'

describe('single-flight FIFO download queue', () => {
  it('runs tasks in insertion order and allows duplicate URLs', () => {
    const calls: string[] = []
    const q = new DownloadQueue(() => { throw new Error('Unexpected failure') })
    expect(q.enqueue({ id: '1', url: 'https://example.com/a', begin: () => { calls.push('1') } })).toBe(false)
    expect(q.enqueue({ id: '2', url: 'https://example.com/a', begin: () => { calls.push('2') } })).toBe(true)
    expect(q.claim('https://example.com/a')).toBe('1')
    expect(calls).toEqual(['1'])
    q.finish('1')
    expect(q.claim('https://example.com/a')).toBe('2')
    expect(calls).toEqual(['1', '2'])
    q.finish('2')
    expect(q.activeId).toBe(null)
  })
  it('removes queued tasks without interfering with active downloads', () => {
    const calls: string[] = []
    const q = new DownloadQueue(() => undefined)
    q.enqueue({ id: 'a', url: 'https://example.com/a', begin: () => calls.push('a') })
    q.enqueue({ id: 'b', url: 'https://example.com/b', begin: () => calls.push('b') })
    expect(q.cancelQueued('b')?.url).toBe('https://example.com/b')
    expect(q.cancelQueued('a')).toBeNull()
    q.finish('a')
    expect(calls).toEqual(['a'])
  })
  it('continues after a sender cannot initiate a download', () => {
    const failed: string[] = []
    const q = new DownloadQueue((task) => { failed.push(task.id) })
    q.enqueue({ id: 'busy', url: 'https://example.com/a', begin: () => undefined })
    q.enqueue({ id: 'bad', url: 'https://example.com/b', begin: () => { throw new Error('window closed') } })
    q.enqueue({ id: 'next', url: 'https://example.com/c', begin: () => undefined })
    q.finish('busy')
    expect(failed).toEqual(['bad'])
    expect(q.activeId).toBe('next')
  })
  it('ignores spurious completion and unrelated download URLs', () => {
    const q = new DownloadQueue(() => undefined)
    q.enqueue({ id: 'a', url: 'https://example.com/a', begin: () => undefined })
    expect(q.claim('https://evil.example')).toBeNull()
    q.finish('not-current')
    expect(q.activeId).toBe('a')
  })
})
