import { describe, it, expect } from 'vite-plus/test'
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

describe('additional IPC security boundaries', () => {
  it('rejects malformed store values', () => {
    expect(() => validate('store:set', ['closeToTray', 'yes'])).toThrow()
    expect(() => validate('store:set', ['locale', 'es-ES'])).toThrow()
    expect(() => validate('store:set', ['theme', 'javascript:evil'])).toThrow()
  })
  it('allows valid application settings', () => {
    expect(() => validate('store:set', ['closeToTray', false])).not.toThrow()
    expect(() => validate('store:set', ['theme', 'dark'])).not.toThrow()
    expect(() => validate('store:set', ['locale', 'en-US'])).not.toThrow()
  })
  it('rejects local private-network download URLs and embedded passwords', () => {
    for (const bad of ['https://localhost/file','https://127.0.0.1/file','https://192.168.1.1/file','https://10.1.1.2/file','https://user:pass@example.com/file']) {
      expect(() => safeUrl(bad)).toThrow()
    }
  })
  it('rejects invalid download and log command shapes', () => {
    expect(() => validate('download:start', ['ftp://example.com/file'])).toThrow()
    expect(() => validate('download:cancel', [])).toThrow()
    expect(() => validate('notification:show', ['', 'body'])).toThrow()
    expect(() => validate('log:write', ['trace', 'message'])).toThrow()
  })
})

describe('application lifecycle IPC contract', () => {
  it('accepts no-argument restart only', () => {
    expect(() => validate('app:restart', [])).not.toThrow()
    expect(() => validate('app:restart', ['--inspect'])).toThrow()
  })
})
