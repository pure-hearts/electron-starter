/**
 * @file generate-hot-keys.mjs
 * @description 增量热更新密钥生成工具：生成 Ed25519 非对称公私钥对。
 *
 * 安全规范：
 * 1. 公钥 (Public Key)：内置于客户端安装包 resources/ 目录下，随软件发布，用于下载增量包后验签。
 * 2. 私钥 (Private Key)：保存在发布机器或 CI/CD 环境变量中，绝不能随客户端分发，已被 .gitignore 保护。
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = process.cwd();
const resourcesDir = path.join(rootDir, "resources");
const publicKeyPath = path.join(resourcesDir, "hot-update-public-key.pem");
const privateKeyPath = path.join(rootDir, "hot-update-private-key.pem");

console.log("🔑 正在生成 Ed25519 增量热更新签名密钥对...");

// 生成高强度的 Ed25519 密钥对
const keyPair = crypto.generateKeyPairSync("ed25519");

// 导出 PEM 格式公钥与私钥
const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" });
const privateKeyPem = keyPair.privateKey.export({ type: "pkcs8", format: "pem" });

// 确保 resources 目录存在
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// 写入公钥（客户端验签用）
fs.writeFileSync(publicKeyPath, publicKeyPem, "utf8");
console.log(`✅ 公钥已生成并保存至: ${path.relative(rootDir, publicKeyPath)} (随客户端分发)`);

// 写入私钥（发布打包签名用）
fs.writeFileSync(privateKeyPath, privateKeyPem, "utf8");
console.log(
  `🔒 私钥已生成并保存至: ${path.relative(rootDir, privateKeyPath)} (已被 .gitignore 保护，绝勿泄露)`,
);

console.log("\n💡 提示：在打包增量更新包时，scripts/pack-hot.ts 将自动读取此私钥进行签名。");
