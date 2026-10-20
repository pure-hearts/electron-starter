import fs from 'node:fs'
import path from 'node:path'

export function resolveRendererAsset(root: string, pathname: string): string | null {
  let decoded: string
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  if (!decoded.startsWith('/') || decoded.includes('\0') || decoded.includes('\\') ||
      decoded.split('/').includes('..')) return null
  const canonicalRoot = fs.realpathSync(root)
  const target = path.resolve(canonicalRoot, '.' + decoded)
  if (target !== canonicalRoot && !target.startsWith(canonicalRoot + path.sep)) return null
  const safeFile = (file: string): string | null => {
    try {
      const actual = fs.realpathSync(file)
      if (actual !== canonicalRoot && !actual.startsWith(canonicalRoot + path.sep)) return null
      return fs.statSync(actual).isFile() ? actual : null
    } catch { return null }
  }
  if (decoded === '/') return safeFile(path.join(canonicalRoot, 'index.html'))
  return safeFile(target)
}
