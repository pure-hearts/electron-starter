/** Run after vp build. Requires a private Ed25519 PEM path in HOT_UPDATE_PRIVATE_KEY_PEM_PATH. */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
const appVersion = JSON.parse(readFileSync('package.json','utf8')).version as string
const keyPath = process.env.HOT_UPDATE_PRIVATE_KEY_PEM_PATH
const revision = Number(process.env.HOT_UPDATE_REVISION)
const baseURL = process.env.HOT_UPDATE_ASSET_BASE_URL
if (!keyPath || !baseURL?.startsWith('https://') || !Number.isSafeInteger(revision) || revision < 1) {
  throw new Error('Set HOT_UPDATE_PRIVATE_KEY_PEM_PATH, HOT_UPDATE_REVISION (positive integer), HOT_UPDATE_ASSET_BASE_URL (HTTPS)')
}
const directory = 'dist/renderer'
const entries: Record<string, Uint8Array> = {}
function walk(root: string) {
  for (const child of readdirSync(root)) {
    const full = join(root, child)
    if (statSync(full).isDirectory()) walk(full)
    else entries[relative(directory, full).replaceAll('\\','/')] = new Uint8Array(readFileSync(full))
  }
}
walk(directory)
if (!entries['index.html']) throw new Error('Run vp build first')
const zip = zipSync(entries, { level: 6 })
const sha256 = createHash('sha256').update(zip).digest('hex')
const fileName = 'renderer-' + revision + '.zip'
const body = { revision, compatibleApp: appVersion, url: baseURL.replace(/\/$/,'') + '/' + fileName, sha256 }
const signature = sign(null, Buffer.from(JSON.stringify(body)), createPrivateKey(readFileSync(keyPath))).toString('base64')
mkdirSync('release/hot', {recursive:true})
writeFileSync(join('release/hot',fileName), zip)
writeFileSync('release/hot/manifest.json', JSON.stringify({...body,signature},null,2))
console.log('Created release/hot/manifest.json and ' + fileName)
