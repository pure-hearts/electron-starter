/**
 * @file manifest.ts
 * @description 增量热更新清单解析与 Ed25519 验签模块。
 *
 * 安全设计：
 * 1. 签名校验：必须使用 Ed25519 公钥验证清单内容的完整性与发布者身份；
 * 2. 哈希约束：ZIP 压缩包必须匹配清单中的 SHA-256 哈希值；
 * 3. 严格 URL 校验：仅支持带 host 的规范 HTTPS 地址，防范内网 SSRF 与凭据外泄。
 */

import { verify } from "node:crypto";

/** 清单数据主体内容 */
export interface ManifestBody {
  /** 时间戳主序版本号 */
  revision: number;
  /** 完整版本标签，格式：时间戳_GitHash (如 20261029173000_be18d80) */
  versionTag?: string;
  /** Git 提交短 Hash */
  commit?: string;
  /** 兼容的 Electron 大版本 */
  compatibleApp: string;
  /** 资源包下载绝对或规范相对 HTTPS 地址 */
  url: string;
  /** 压缩包 SHA-256 哈希摘要 (64 位小写十六进制) */
  sha256: string;
}

/** 附带 Ed25519 数字签名的完整清单 */
export type SignedManifest = ManifestBody & { signature: string };

/**
 * 校验资源包下载 URL 格式：必须为标准 HTTPS，且禁止附带 Basic Auth 凭据或片段标识符。
 */
export function validateHotArchiveUrl(input: string): void {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid hot update URL");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash ||
    url.toString() !== input ||
    input.length > 4096
  ) {
    throw new Error("Invalid hot update URL");
  }
}

/**
 * 抽取用于签名的标准规范化对象结构。
 * 键字段顺序与 scripts/pack-hot.ts 严格对齐，确保 JSON.stringify 结果哈希一致。
 */
export function manifestBody(m: ManifestBody): ManifestBody {
  if (m.versionTag !== undefined || m.commit !== undefined) {
    return {
      revision: m.revision,
      versionTag: m.versionTag,
      commit: m.commit,
      compatibleApp: m.compatibleApp,
      url: m.url,
      sha256: m.sha256,
    };
  }
  return {
    revision: m.revision,
    compatibleApp: m.compatibleApp,
    url: m.url,
    sha256: m.sha256,
  };
}

/**
 * 验证热更新清单数据结构与 Ed25519 数字签名。
 * 签名校验失败或版本不兼容时抛出异常，阻止后续下载安装。
 */
export function verifyHotManifest(raw: unknown, appVersion: string, key: string): SignedManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid update manifest");
  }
  const m = raw as Partial<SignedManifest>;

  // 1. 版本号与兼容性校验
  if (
    !Number.isSafeInteger(m.revision) ||
    typeof m.revision !== "number" ||
    m.revision <= 0 ||
    m.compatibleApp !== appVersion
  ) {
    throw new Error("Incompatible update");
  }

  // 2. 资源下载地址与 SHA-256 哈希基本格式校验
  if (
    typeof m.url !== "string" ||
    !m.url.startsWith("https://") ||
    typeof m.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/i.test(m.sha256)
  ) {
    throw new Error("Invalid update manifest");
  }

  validateHotArchiveUrl(m.url);

  // 3. 签名长度校验 (Ed25519 Base64 签名通常为 86~88 字符)
  if (typeof m.signature !== "string" || m.signature.length < 60 || m.signature.length > 200) {
    throw new Error("Missing update signature");
  }

  // 4. Ed25519 签名验证
  const bytes = Buffer.from(JSON.stringify(manifestBody(m as ManifestBody)));
  if (!verify(null, bytes, key, Buffer.from(m.signature, "base64"))) {
    throw new Error("Invalid update signature");
  }

  return m as SignedManifest;
}
