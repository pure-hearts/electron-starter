import { describe, expect, it } from 'vite-plus/test'
import { UpdateGate } from '../src/main/modules/update/full/gate'
describe('full installer upgrade retry behavior', () => {
  it('prevents concurrent checks and invalidated install after retry', () => {
    const gate = new UpdateGate()
    expect(gate.start()).toBe(true)
    expect(gate.start()).toBe(false)
    gate.invalidate()
    expect(() => gate.assertInstallReady()).toThrow()
    expect(gate.start()).toBe(true)
    gate.markDownloaded()
    expect(() => gate.assertInstallReady()).not.toThrow()
    gate.invalidate()
    expect(() => gate.assertInstallReady()).toThrow()
  })
  it('completing an empty check never permits install', () => {
    const gate = new UpdateGate()
    gate.start()
    gate.complete()
    expect(gate.isChecking).toBe(false)
    expect(gate.canInstall).toBe(false)
  })
})
