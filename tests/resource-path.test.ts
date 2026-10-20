import { describe, expect, it } from 'vite-plus/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveRendererAsset } from '../src/main/modules/resource-path'
function fixture(run: (root: string, outside: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-assets-'))
  const root = path.join(dir, 'dist')
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>')
  fs.writeFileSync(path.join(root, 'assets', 'bundle.js'), 'ok')
  const outside = path.join(dir, 'private.txt')
  fs.writeFileSync(outside, 'secret')
  try { run(root, outside) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
describe('safe renderer resource protocol', () => {
  it('serves only known files and index', () => fixture(root => {
    expect(resolveRendererAsset(root, '/assets/bundle.js')).toBe(path.join(root, 'assets', 'bundle.js'))
    expect(resolveRendererAsset(root, '/')).toBe(path.join(root, 'index.html'))
    expect(resolveRendererAsset(root, '/missing.js')).toBeNull()
  }))
  it('rejects traversal and encoded separators', () => fixture(root => {
    for (const bad of ['/../private.txt', '/%2e%2e/private.txt', '/assets/%2e%2e/%2e%2e/private.txt', '/%5cWindows', '/%00']) {
      expect(resolveRendererAsset(root, bad)).toBeNull()
    }
  }))
  it('rejects symlinks escaping renderer root', () => fixture((root, outside) => {
    fs.symlinkSync(outside, path.join(root, 'assets', 'outside.txt'))
    expect(resolveRendererAsset(root, '/assets/outside.txt')).toBeNull()
  }))
})
