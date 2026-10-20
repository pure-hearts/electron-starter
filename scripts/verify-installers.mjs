import fs from 'node:fs'
import path from 'node:path'

const platform = process.argv[2]
const expected = { win: ['.exe'], mac: ['.dmg', '.zip'], linux: ['.AppImage', '.deb'] }
if (!Object.hasOwn(expected, platform)) throw new Error('Unknown package target: ' + platform)
const dir = path.resolve('release')
if (!fs.existsSync(dir)) throw new Error('Missing release directory')
const files = fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isFile())
for (const extension of expected[platform]) {
  const matching = files.filter(name => name.endsWith(extension))
  if (!matching.length) throw new Error('Missing ' + platform + ' installer (' + extension + ')')
  for (const name of matching) {
    const bytes = fs.statSync(path.join(dir, name)).size
    if (bytes < 1024 * 1024) throw new Error('Suspiciously small installer: ' + name)
    console.log('Verified', name, bytes, 'bytes')
  }
}
console.log('Unsigned package artifact presence verified for', platform)
