/**
 * @file generate-self-signed-certs.mjs
 * @description 跨平台个人自签名证书生成工具：
 * 为 Windows、macOS 与 Linux 三端生成自签名代码签名证书及公钥根证书，
 * 并将敏感证书与私钥统一输出至受 .gitignore 保护的 certs/ 目录。
 *
 * 包含：
 * 1. Windows: Authenticode 规范代码签名证书 (.pfx) 及公钥根证书 (.cer)
 * 2. macOS: Apple 规范代码签名证书 (.p12) 及公钥证书 (.cer)
 * 3. Linux: 安装包完整性校验密钥对 (.key, .pub, .crt)
 * 4. 联动生成增量热更新 Ed25519 签名密钥对
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const certsDir = path.join(rootDir, "certs");
const winDir = path.join(certsDir, "windows");
const macDir = path.join(certsDir, "macos");
const linuxDir = path.join(certsDir, "linux");

// 解析命令行参数
const args = process.argv.slice(2);
const isClean = args.includes("--clean");
const pwdIndex = args.indexOf("--password");
const defaultPassword =
  pwdIndex !== -1 && args[pwdIndex + 1]
    ? args[pwdIndex + 1]
    : process.env.CERT_PASSWORD || "dev-cert-password-123";

// 清理模式
if (isClean) {
  console.log("🧹 正在清理本地生成的自签名证书与私钥...");
  const dirsToClean = [winDir, macDir, linuxDir];
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  console.log("✅ 清理完成！所有本地敏感证书文件已移除。");
  process.exit(0);
}

// 确保目录结构存在
for (const dir of [certsDir, winDir, macDir, linuxDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 检查 OpenSSL 是否可用
function checkOpenSsl() {
  try {
    const version = execSync("openssl version", { encoding: "utf8" }).trim();
    return version;
  } catch (error) {
    console.error("❌ 未检测到系统 OpenSSL 命令行工具，请先安装 OpenSSL。");
    throw error;
  }
}

const opensslVersion = checkOpenSsl();
console.log(`🛡️ 检测到系统环境: ${opensslVersion}`);

// 兼容性探测：OpenSSL 3.x 需带 -legacy 参数以兼容 macOS / Windows 系统的 PKCS#12 密钥包解析
const isLegacySupported = (() => {
  try {
    execSync("openssl pkcs12 -help 2>&1 | grep -e -legacy", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const legacyArg = isLegacySupported ? "-legacy " : "";

console.log(`🔐 正在为三端生成个人自签名代码签名证书（密码: ${defaultPassword}）...\n`);

const validityDays = 1095; // 3 年有效期

/**
 * 1. 生成 Windows Authenticode 个人证书
 */
function generateWindowsCert() {
  console.log("📦 [1/3] 正在生成 Windows Authenticode 代码签名证书...");
  const keyPath = path.join(winDir, "code-sign.key");
  const cerPath = path.join(winDir, "root-ca.cer");
  const pfxPath = path.join(winDir, "code-sign.pfx");
  const confPath = path.join(winDir, "openssl.cnf");

  const confContent = `
[ req ]
distinguished_name = req_dn
prompt = no
x509_extensions = v3_code_signing

[ req_dn ]
CN = Electron Vue Template Dev Publisher
O = PureHearts Dev
OU = Desktop App Development
C = CN

[ v3_code_signing ]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = codeSigning
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
`;

  fs.writeFileSync(confPath, confContent.trim(), "utf8");

  // 生成 RSA 4096 密钥与 X.509 证书
  execSync(`openssl genrsa -out "${keyPath}" 4096`, { stdio: "ignore" });
  execSync(
    `openssl req -new -x509 -key "${keyPath}" -out "${cerPath}" -days ${validityDays} -config "${confPath}"`,
    { stdio: "ignore" },
  );

  // 打包为 PKCS#12 (PFX)
  execSync(
    `openssl pkcs12 -export ${legacyArg}-out "${pfxPath}" -inkey "${keyPath}" -in "${cerPath}" -passout pass:${defaultPassword}`,
    { stdio: "ignore" },
  );

  // 清理临时配置文件
  fs.unlinkSync(confPath);

  // 计算指纹
  const certDer = execSync(`openssl x509 -in "${cerPath}" -outform DER`);
  const sha1 = crypto.createHash("sha1").update(certDer).digest("hex").toUpperCase();
  const sha256 = crypto.createHash("sha256").update(certDer).digest("hex").toUpperCase();

  const certInfo = {
    platform: "Windows",
    commonName: "Electron Vue Template Dev Publisher",
    organization: "PureHearts Dev",
    validityDays,
    pfxFile: "certs/windows/code-sign.pfx",
    cerFile: "certs/windows/root-ca.cer",
    password: defaultPassword,
    sha1Fingerprint: sha1,
    sha256Fingerprint: sha256,
    trustInstructions:
      "将 root-ca.cer 导入至 Windows 的「受信任的根证书颁发机构」和「受信任的发布者」以消除 SmartScreen 拦截。",
  };

  fs.writeFileSync(path.join(winDir, "cert-info.json"), JSON.stringify(certInfo, null, 2), "utf8");
  console.log(`   ✅ 证书已生成: certs/windows/code-sign.pfx`);
  console.log(
    `   ✅ 根证书已生成: certs/windows/root-ca.cer (指纹 SHA-256: ${sha256.slice(0, 16)}...)`,
  );
}

/**
 * 2. 生成 macOS 个人代码签名证书
 */
function generateMacCert() {
  console.log("🍎 [2/3] 正在生成 macOS 个人代码签名证书...");
  const keyPath = path.join(macDir, "mac-codesign.key");
  const cerPath = path.join(macDir, "mac-root-ca.cer");
  const p12Path = path.join(macDir, "mac-codesign.p12");
  const confPath = path.join(macDir, "openssl.cnf");

  const confContent = `
[ req ]
distinguished_name = req_dn
prompt = no
x509_extensions = v3_mac_code_signing

[ req_dn ]
CN = Developer ID Application: Electron Vue Template Dev
O = PureHearts Dev
OU = Desktop App Development
C = CN

[ v3_mac_code_signing ]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = codeSigning, 1.2.840.113635.100.1.1
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
`;

  fs.writeFileSync(confPath, confContent.trim(), "utf8");

  // 生成 RSA 4096 密钥与 X.509 证书
  execSync(`openssl genrsa -out "${keyPath}" 4096`, { stdio: "ignore" });
  execSync(
    `openssl req -new -x509 -key "${keyPath}" -out "${cerPath}" -days ${validityDays} -config "${confPath}"`,
    { stdio: "ignore" },
  );

  // 打包为 PKCS#12 (P12)
  execSync(
    `openssl pkcs12 -export ${legacyArg}-out "${p12Path}" -inkey "${keyPath}" -in "${cerPath}" -passout pass:${defaultPassword}`,
    { stdio: "ignore" },
  );

  // 清理临时配置文件
  fs.unlinkSync(confPath);

  // 计算指纹
  const certDer = execSync(`openssl x509 -in "${cerPath}" -outform DER`);
  const sha1 = crypto.createHash("sha1").update(certDer).digest("hex").toUpperCase();
  const sha256 = crypto.createHash("sha256").update(certDer).digest("hex").toUpperCase();

  const certInfo = {
    platform: "macOS",
    commonName: "Developer ID Application: Electron Vue Template Dev",
    organization: "PureHearts Dev",
    validityDays,
    p12File: "certs/macos/mac-codesign.p12",
    cerFile: "certs/macos/mac-root-ca.cer",
    password: defaultPassword,
    sha1Fingerprint: sha1,
    sha256Fingerprint: sha256,
    keychainImportCommand: `security import certs/macos/mac-codesign.p12 -k ~/Library/Keychains/login.keychain-db -P "${defaultPassword}" -T /usr/bin/codesign`,
  };

  fs.writeFileSync(path.join(macDir, "cert-info.json"), JSON.stringify(certInfo, null, 2), "utf8");
  console.log(`   ✅ 证书已生成: certs/macos/mac-codesign.p12`);
  console.log(
    `   ✅ 根证书已生成: certs/macos/mac-root-ca.cer (指纹 SHA-256: ${sha256.slice(0, 16)}...)`,
  );
}

/**
 * 3. 生成 Linux 签名与校验密钥
 */
function generateLinuxCert() {
  console.log("🐧 [3/3] 正在生成 Linux 发行包签名密钥与 X.509 凭证...");
  const keyPath = path.join(linuxDir, "linux-signer.key");
  const pubPath = path.join(linuxDir, "linux-signer.pub");
  const crtPath = path.join(linuxDir, "linux-signer.crt");
  const confPath = path.join(linuxDir, "openssl.cnf");

  const confContent = `
[ req ]
distinguished_name = req_dn
prompt = no
x509_extensions = v3_linux_sign

[ req_dn ]
CN = Electron Vue Template Linux Signer
O = PureHearts Dev
C = CN

[ v3_linux_sign ]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = codeSigning
subjectKeyIdentifier = hash
`;

  fs.writeFileSync(confPath, confContent.trim(), "utf8");

  // 生成 RSA 4096 密钥与证书
  execSync(`openssl genrsa -out "${keyPath}" 4096`, { stdio: "ignore" });
  execSync(`openssl rsa -in "${keyPath}" -pubout -out "${pubPath}"`, { stdio: "ignore" });
  execSync(
    `openssl req -new -x509 -key "${keyPath}" -out "${crtPath}" -days ${validityDays} -config "${confPath}"`,
    { stdio: "ignore" },
  );

  fs.unlinkSync(confPath);

  const certDer = execSync(`openssl x509 -in "${crtPath}" -outform DER`);
  const sha256 = crypto.createHash("sha256").update(certDer).digest("hex").toUpperCase();

  const certInfo = {
    platform: "Linux",
    commonName: "Electron Vue Template Linux Signer",
    validityDays,
    keyFile: "certs/linux/linux-signer.key",
    pubFile: "certs/linux/linux-signer.pub",
    crtFile: "certs/linux/linux-signer.crt",
    sha256Fingerprint: sha256,
  };

  fs.writeFileSync(
    path.join(linuxDir, "cert-info.json"),
    JSON.stringify(certInfo, null, 2),
    "utf8",
  );
  console.log(`   ✅ 签名密钥已生成: certs/linux/linux-signer.key / .pub`);
}

/**
 * 4. 联动生成/同步热更新 Ed25519 签名密钥对
 */
function syncHotUpdateKeys() {
  const hotScript = path.join(rootDir, "scripts", "generate-hot-keys.mjs");
  if (fs.existsSync(hotScript)) {
    console.log("\n⚡ 同步刷新渲染层增量热更新 Ed25519 签名密钥对...");
    execSync(`node "${hotScript}"`, { stdio: "inherit" });
  }
}

// 执行生成
generateWindowsCert();
generateMacCert();
generateLinuxCert();
syncHotUpdateKeys();

console.log("\n========================================================");
console.log("🎉 三端个人自签名证书与密钥套件已全部生成完毕！");
console.log(`📁 存放位置: ${path.relative(rootDir, certsDir)}/`);
console.log(`🔑 默认密码: ${defaultPassword}`);
console.log("🛡️  安全声明: 所有私钥与证书均已加入 .gitignore，绝不会被意外推送到远程代码库。");
console.log(
  "💡 提示: 运行构建打包时（如 pnpm dist:win / dist:mac），构建系统将自动检测并使用对应证书。",
);
console.log("========================================================\n");
