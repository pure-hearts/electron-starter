import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
const releaseDir = path.resolve(process.argv[2] || 'release')
if (!fs.existsSync(releaseDir)) throw new Error('Missing release artifacts')
const accepted = ['.exe','.dmg','.zip','.AppImage','.deb']
const targets = fs.readdirSync(releaseDir).filter(name =>
  accepted.some(ext => name.endsWith(ext)) && fs.statSync(path.join(releaseDir,name)).isFile()
).sort()
if (!targets.length) throw new Error('No distribution installers found')
const lines = targets.map(name => createHash('sha256').update(fs.readFileSync(path.join(releaseDir,name))).digest('hex') + '  ' + name)
fs.writeFileSync(path.join(releaseDir,'SHA256SUMS.txt'),lines.join('\n')+'\n')
console.log('Wrote checksums for '+targets.length+' artifacts')
