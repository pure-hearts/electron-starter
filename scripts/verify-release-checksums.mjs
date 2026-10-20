import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const directory = path.resolve(process.argv[2] || 'release')
const manifest = fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8')
const lines = manifest.trimEnd().split('\n')
if (!lines.length || !lines[0]) throw new Error('Empty checksum manifest')
const seen = new Set()
for (const line of lines) {
  const match = /^([0-9a-f]{64})  ([^\\/\r\n]+)$/.exec(line)
  if (!match) throw new Error('Invalid checksum line')
  const [, expected, filename] = match
  if (filename === '.' || filename === '..' || seen.has(filename)) throw new Error('Unsafe or duplicate artifact')
  seen.add(filename)
  const file = path.join(directory, filename)
  if (!fs.statSync(file).isFile()) throw new Error('Missing installer: ' + filename)
  const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  if (actual !== expected) throw new Error('Checksum mismatch: ' + filename)
  console.log('SHA-256 verified:', filename)
}
