import { describe, expect, it } from 'vite-plus/test'
import { RecoveryPolicy } from '../src/main/modules/core/recovery-policy'
describe('crash recovery guard', () => {
  it('stops infinite reload loops', () => {
    const policy = new RecoveryPolicy(2, 60_000)
    expect(policy.canRecover(1000)).toBe(true)
    expect(policy.canRecover(2000)).toBe(true)
    expect(policy.canRecover(3000)).toBe(false)
    expect(policy.canRecover(70_000)).toBe(true)
  })
  it('uses a finite rolling window', () => {
    const policy = new RecoveryPolicy(1, 500)
    expect(policy.canRecover(5)).toBe(true)
    expect(policy.canRecover(50)).toBe(false)
    expect(policy.canRecover(600)).toBe(true)
  })
})
