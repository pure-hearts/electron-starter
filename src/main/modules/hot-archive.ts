import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'

const MAX_FILES = 800
const MAX_EXPANDED = 128 * 1024 * 1024

/** Extract only ordinary assets, with ZIP traversal and expansion limits. */
export function extractSafe(zip: Uint8Array, directory: string): void {
  let count = 0
  let total = 0
  const files = unzipSync(zip, {
    filter(info) {
      count++
      total += info.originalSize
      if (count > MAX_FILES || total > MAX_EXPANDED) throw new Error('ZIP limits exceeded')
      return true
    }
  })
  const root = path.resolve(directory)
  for (const [name, bytes] of Object.entries(files)) {
    if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').some(p => p === '..')) {
      throw new Error('Unsafe ZIP path')
    }
    if (name.endsWith('/')) continue
    const target = path.resolve(root, name)
    if (!target.startsWith(root + path.sep)) throw new Error('Unsafe ZIP target')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes, { flag: 'wx' })
  }
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Missing index.html')
}
