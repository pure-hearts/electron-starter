/** 热更新清单：用 Ed25519 公钥验证清单签名，用 SHA-256 核对下载 ZIP 完整性。 */
import { verify } from 'node:crypto'

// revision 是资源版本；compatibleApp 用于约束可兼容的主程序版本。
export type ManifestBody = { revision: number; compatibleApp: string; url: string; sha256: string }
// signature 是离线私钥生成的签名；私钥绝不能随安装包分发。
export type SignedManifest = ManifestBody & { signature: string }

/** Reject credentials, fragments and ambiguous/non-HTTPS update origins. */
/** 要求资源包下载地址为规范 HTTPS，且不能包含账号凭据。 */
export function validateHotArchiveUrl(input: string): void {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Invalid hot update URL') }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.hash || url.toString() !== input || input.length > 4096) {
    throw new Error('Invalid hot update URL')
  }
}

export function manifestBody(m: ManifestBody): ManifestBody {
  return { revision: m.revision, compatibleApp: m.compatibleApp, url: m.url, sha256: m.sha256 }
}

/** Verify Ed25519 signature over a stable ordered manifest body before using a ZIP. */
/** 验证热更新元数据与数字签名，失败时不可继续安装资源包。 */
export function verifyHotManifest(raw: unknown, appVersion: string, key: string): SignedManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid update manifest')
  const m = raw as Partial<SignedManifest>
  if (!Number.isSafeInteger(m.revision) || typeof m.revision !== 'number' || m.revision <= 0 || m.compatibleApp !== appVersion) throw new Error('Incompatible update')
  if (typeof m.url !== 'string' || !m.url.startsWith('https://') || typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(m.sha256)) throw new Error('Invalid update manifest')
  validateHotArchiveUrl(m.url)
  // Require an unambiguous HTTPS archive URL, with no embedded credentials or fragments.
  try {
    const target = new URL(m.url)
    if (target.protocol !== 'https:' || target.username || target.password || target.hash || target.hostname.length === 0) {
      throw new Error('Invalid update URL')
    }
  } catch { throw new Error('Invalid update manifest URL') }
  if (typeof m.signature !== 'string' || m.signature.length < 60 || m.signature.length > 200) throw new Error('Missing update signature')
  const bytes = Buffer.from(JSON.stringify(manifestBody(m as ManifestBody)))
  if (!verify(null, bytes, key, Buffer.from(m.signature, 'base64'))) throw new Error('Invalid update signature')
  return m as SignedManifest
}
