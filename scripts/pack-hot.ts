/**
 * @file pack-hot.ts
 * @description 增量热更新打包脚本：对 dist/renderer 前端静态资源进行打包、SHA-256 计算与 Ed25519 签名。
 *
 * 运行方式:
 * - 本地运行: pnpm hot:pack (自动执行 vp build 并打出热更新包)
 * - CI/CD 模式: 通过 HOT_UPDATE_PRIVATE_KEY 环境变量注入私钥完成自动化发布
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { execSync } from "node:child_process";
import { zipSync } from "fflate";

// 1. 读取当前主程序大版本号（用于版本兼容性限制 compatibleApp）
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const appVersion = pkg.version;

// 2. 自动生成规范版本号：时间戳 (主序数字比对) + Git 提交 Hash (追溯排查)
function generateVersionInfo(): { revision: number; commit: string; versionTag: string } {
  // 生成形如 20261029173000 的数字时间戳
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const revision = Number(process.env.HOT_UPDATE_REVISION) || Number(timestampStr);

  // 提取当前 Git 提交短 Hash
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim();
  } catch {
    commit = "custom";
  }

  const versionTag = `${revision}_${commit}`;
  return { revision, commit, versionTag };
}

const { revision, commit, versionTag } = generateVersionInfo();

/**
 * 规范化私钥字符串：兼容标准多行 PEM、单行 `\n` 转义字符串以及 Base64 编码字符串
 */
function normalizePemContent(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.includes("-----BEGIN")) {
    return decoded.replace(/\\n/g, "\n");
  }
  return trimmed;
}

// 3. 安全获取 Ed25519 签名私钥（绝不允许私钥硬编码或打入安装包）
function resolvePrivateKeyPem(): string {
  // 3.1 优先读取 CI/CD 环境变量直接传入的私钥文本或 Base64 内容
  const envKey = process.env.HOT_UPDATE_PRIVATE_KEY || process.env.HOT_UPDATE_PRIVATE_KEY_PEM;
  if (envKey && envKey.trim()) {
    return normalizePemContent(envKey);
  }
  // 3.2 次选读取环境变量指定的文件路径
  if (process.env.HOT_UPDATE_PRIVATE_KEY_PEM_PATH) {
    const customPath = process.env.HOT_UPDATE_PRIVATE_KEY_PEM_PATH;
    if (existsSync(customPath)) {
      return normalizePemContent(readFileSync(customPath, "utf8"));
    }
    throw new Error(`指定的私钥文件不存在: ${customPath}`);
  }
  // 3.3 本地开发默认从根目录 hot-update-private-key.pem 读取
  const defaultLocalPath = join(process.cwd(), "hot-update-private-key.pem");
  if (existsSync(defaultLocalPath)) {
    return normalizePemContent(readFileSync(defaultLocalPath, "utf8"));
  }
  throw new Error(
    "未找到增量更新签名私钥！请运行 `pnpm hot:keygen` 生成本地密钥，或配置 HOT_UPDATE_PRIVATE_KEY 环境变量。",
  );
}

const privateKeyPem = resolvePrivateKeyPem();

// 4. 解析增量包下载基础 URL
const baseURL =
  process.env.HOT_UPDATE_ASSET_BASE_URL ||
  process.env.HOT_UPDATE_URL ||
  "https://github.com/pure-hearts/electron-starter/releases/download/hot";

// 5. 递归收集 dist/renderer 静态资源文件（排除主进程和原生文件）
const directory = "dist/renderer";
if (!existsSync(directory) || !existsSync(join(directory, "index.html"))) {
  throw new Error("dist/renderer 构建产物不存在！请先运行 `vp build`。");
}

const entries: Record<string, Uint8Array> = {};
function walk(root: string) {
  for (const child of readdirSync(root)) {
    const full = join(root, child);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else {
      // 统一使用 POSIX 正斜杠分隔符，确保跨平台解压安全
      const key = relative(directory, full).replaceAll("\\", "/");
      entries[key] = new Uint8Array(readFileSync(full));
    }
  }
}
walk(directory);

console.log(`📦 正在压缩 ${Object.keys(entries).length} 个渲染层静态文件...`);

// 6. 生成安全 ZIP 资源包与 SHA-256 哈希
const zip = zipSync(entries, { level: 6 });
const sha256 = createHash("sha256").update(zip).digest("hex");
const fileName = `renderer-${revision}.zip`;

// 7. 构造清单元数据体（包含版本戳、Git Hash、兼容大版本与下载地址）
const body = {
  revision,
  versionTag,
  commit,
  compatibleApp: appVersion,
  url: baseURL.replace(/\/$/, "") + "/" + fileName,
  sha256,
};

// 8. 使用 Ed25519 私钥进行数字签名
const signature = sign(
  null,
  Buffer.from(JSON.stringify(body)),
  createPrivateKey(privateKeyPem),
).toString("base64");

// 9. 输出到 release/hot/ 目录
const outputDir = "release/hot";
mkdirSync(outputDir, { recursive: true });

writeFileSync(join(outputDir, fileName), zip);
const manifestPayload = { ...body, signature };
writeFileSync(join(outputDir, "manifest.json"), JSON.stringify(manifestPayload, null, 2));

console.log("\n✨ 增量热更新资源打包成功！");
console.log(`📌 版本标签: ${versionTag} (主序时间戳: ${revision}, Git 提交: ${commit})`);
console.log(`📁 资源文件: ${join(outputDir, fileName)} (${(zip.byteLength / 1024).toFixed(1)} KB)`);
console.log(`📄 清单元数据: ${join(outputDir, "manifest.json")}`);
