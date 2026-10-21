import fs from 'node:fs'
import path from 'node:path'

// CI 传入 win/mac/linux，防止误用其他未支持的目标。
const platform = process.argv[2]
// 各操作系统至少应产出的安装包格式。
const expected = { win: ['.exe'], mac: ['.dmg', '.zip'], linux: ['.AppImage', '.deb'] }
if (!Object.hasOwn(expected, platform)) throw new Error('Unknown package target: ' + platform)
const dir = path.resolve('release')
if (!fs.existsSync(dir)) throw new Error('Missing release directory')
// 只扫描 release 根目录下的普通文件，而不是内部打包目录。
const files = fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isFile())
# 针对每种预期格式检查是否确实生成安装包，而不是仅相信构建退出码。
for (const extension of expected[platform]) {
  const matching = files.filter(name => name.endsWith(extension))
  if (!matching.length) throw new Error('Missing ' + platform + ' installer (' + extension + ')')
  for (const name of matching) {
    const bytes = fs.statSync(path.join(dir, name)).size
# 小于 1MiB 的安装包通常属于空文件或意外输出，因此拒绝通过。
    if (bytes < 1024 * 1024) throw new Error('Suspiciously small installer: ' + name)
    console.log('Verified', name, bytes, 'bytes')
  }
}
console.log('Unsigned package artifact presence verified for', platform)
