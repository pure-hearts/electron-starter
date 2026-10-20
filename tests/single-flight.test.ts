import { describe, expect, it } from 'vite-plus/test'
import { singleFlight } from '../src/main/modules/single-flight'

describe('hot update concurrency lock', () => {
  it('shares one active operation and permits another after completion', async () => {
    let calls = 0
    let release: ((value: number) => void) | undefined
    const task = singleFlight(() => {
      calls++
      return new Promise<number>(resolve => { release = resolve })
    })
    const first = task()
    const second = task()
    expect(first).toBe(second)
    await Promise.resolve()
    expect(calls).toBe(1)
    release?.(7)
    await expect(first).resolves.toBe(7)
    await Promise.resolve()
    const third = task()
    expect(third).not.toBe(first)
    await Promise.resolve()
    release?.(8)
    await expect(third).resolves.toBe(8)
    expect(calls).toBe(2)
  })
  it('unlocks after failed requests', async () => {
    let attempts = 0
    const task = singleFlight(async () => {
      attempts++
      if (attempts === 1) throw new Error('temporary failure')
      return 'ok'
    })
    await expect(task()).rejects.toThrow('temporary')
    await Promise.resolve()
    await expect(task()).resolves.toBe('ok')
    expect(attempts).toBe(2)
  })
})
