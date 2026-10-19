import { describe, it, expect } from 'vitest'
import { safeUrl, validate } from '../src/shared/validation'
describe('IPC boundary', () => {
  it('accepts known settings', () => {
    expect(() => validate('store:set', ['locale','en-US'])).not.toThrow()
  })
  it('rejects unknown settings and dangerous paths', () => {
    expect(() => validate('store:get', ['arbitraryFile'])).toThrow()
    expect(() => validate('window:open', ['https://evil.example'])).toThrow()
  })
  it('accepts HTTPS and refuses local files', () => {
    expect(safeUrl('https://example.com/test').hostname).toBe('example.com')
    expect(() => safeUrl('file:///etc/passwd')).toThrow()
    expect(() => safeUrl('http://127.0.0.1/private')).toThrow()
  })
  it('requires valid action', () => {
    expect(() => validate('window:action', ['minimize'])).not.toThrow()
    expect(() => validate('window:action', ['eval'])).toThrow()
  })
})
