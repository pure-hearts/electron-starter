import { describe, expect, it } from 'vite-plus/test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { extractSafe } from '../src/main/modules/update/hot/archive'

function withTemporaryDirectory(run: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'electron-starter-zip-'))
  try { run(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
describe('safe hot ZIP extraction', () => {
  it('extracts a valid renderer build', () => withTemporaryDirectory(dir => {
    const archive = zipSync({ 'index.html': strToU8('<html></html>'), 'assets/main.js': strToU8('ok') })
    extractSafe(archive, dir)
    expect(readFileSync(join(dir, 'assets', 'main.js'), 'utf8')).toBe('ok')
  }))
  it('rejects ZIP path traversal', () => withTemporaryDirectory(dir => {
    const archive = zipSync({ 'index.html': strToU8('ok'), '../escape.txt': strToU8('evil') })
    expect(() => extractSafe(archive, dir)).toThrow(/Unsafe ZIP/)
  }))
  it('requires an entry page', () => withTemporaryDirectory(dir => {
    const archive = zipSync({ 'assets/main.js': strToU8('ok') })
    expect(() => extractSafe(archive, dir)).toThrow(/Missing index.html/)
  }))
  it('does not overwrite files during extraction', () => withTemporaryDirectory(dir => {
    const archive = zipSync({ 'index.html': strToU8('ok') })
    extractSafe(archive, dir)
    expect(() => extractSafe(archive, dir)).toThrow()
  }))
})
