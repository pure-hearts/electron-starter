/** Run after vp build. Requires a private Ed25519 PEM path in HOT_UPDATE_PRIVATE_KEY_PEM_PATH. */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { zipSync } from 'fflate'
const appVersion = JSON.parse(readFileSync('package.json','utf8')).version as string
// 私钥路径只从构建环境读取；绝不能将签名私钥打进客户端安装包。
const keyPath = process.env.HOT_UPDATE_PRIVATE_KEY_PEM_PATH
// 热更新版本号独立于主程序版本，必须为正整数。
const revision = Number(process.env.HOT_UPDATE_REVISION)
const baseURL = process.env.HOT_UPDATE_ASSET_BASE_URL
if (!keyPath || !baseURL?.startsWith('https://') || !Number.isSafeInteger(revision) || revision < 1) {
  throw new Error('Set HOT_UPDATE_PRIVATE_KEY_PEM_PATH, HOT_UPDATE_REVISION (positive integer), HOT_UPDATE_ASSET_BASE_URL (HTTPS)')
}
// 只打包 Renderer 静态资源，不能热替换 Main 和 Preload 代码。
const directory = 'dist/renderer'
const entries: Record<string, Uint8Array> = {}
// 递归收集构建资源，并统一 ZIP 内目录分隔符以兼容跨平台。
function walk(root: string) {
  for (const child of readdirSync(root)) {
    const full = join(root, child)
    if (statSync(full).isDirectory()) walk(full)
    else entries[relative(directory, full).replaceAll('\\','/')] = new Uint8Array(readFileSync(full))
  }
}
walk(directory)
if (!entries['index.html']) throw new Error('Run vp build first')
// 对页面资源生成压缩包，客户端下载后还会校验 SHA-256 和签名。
const zip = zipSync(entries, { level: 6 })
// 摘要用于检查 ZIP 下载后是否被篡改，与数字签名作用不同。
const sha256 = createHash('sha256').update(zip).digest('hex')
const fileName = 'renderer-' + revision + '.zip'
const body = { revision, compatibleApp: appVersion, url: baseURL.replace(/\/$/,'') + '/' + fileName, sha256 }
// Ed25519 私钥只在发布机器签名清单；应用端仅保存对应公钥。
const signature = sign(null, Buffer.from(JSON.stringify(body)), createPrivateKey(readFileSync(keyPath))).toString('base64')
mkdirSync('release/hot', {recursive:true})
writeFileSync(join('release/hot',fileName), zip)
// 写出包含版本、兼容性、下载地址、哈希和签名的发布清单。
writeFileSync('release/hot/manifest.json', JSON.stringify({...body,signature},null,2))
console.log('Created release/hot/manifest.json and ' + fileName)
