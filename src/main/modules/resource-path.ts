/** app:// 资源路径安全解析：确保页面只能读取指定渲染资源目录内的真实文件。 */
import fs from 'node:fs'
import path from 'node:path'

/** 将 URL 路径解析到磁盘文件，非法、越界、失效的路径均返回 null。 */
export function resolveRendererAsset(root: string, pathname: string): string | null {
  let decoded: string
  // URL 可能包含百分号编码；解码失败直接拒绝，而不是猜测文件名。
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  // 拒绝非绝对 URL 路径、NUL、反斜杠及 .. 目录遍历片段。
  if (!decoded.startsWith('/') || decoded.includes('\0') || decoded.includes('\\') ||
      decoded.split('/').includes('..')) return null
  // realpathSync 解析目录的真实位置，避免软链接把资源目录指向意外位置。
  const canonicalRoot = fs.realpathSync(root)
  // path.resolve 负责规范化磁盘路径，再验证是否仍在允许的根目录中。
  const target = path.resolve(canonicalRoot, '.' + decoded)
  // 路径前缀必须带分隔符，避免 /assets2 被误判在 /assets 内。
  if (target !== canonicalRoot && !target.startsWith(canonicalRoot + path.sep)) return null
  // 对最终文件再次 realpath，阻止目录内部的符号链接逃逸。
  const safeFile = (file: string): string | null => {
    try {
      const actual = fs.realpathSync(file)
      if (actual !== canonicalRoot && !actual.startsWith(canonicalRoot + path.sep)) return null
      // 只返回普通文件，拒绝把目录当作 app:// 页面资源返回。
      return fs.statSync(actual).isFile() ? actual : null
    } catch { return null }
  }
  // 网站根路径对应 index.html；其他请求映射到经过校验的文件。
  if (decoded === '/') return safeFile(path.join(canonicalRoot, 'index.html'))
  return safeFile(target)
}
