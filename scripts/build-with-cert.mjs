/**
 * @file build-with-cert.mjs
 * @description 构建打包自动证书集成器：
 * 自动感知项目本地 certs/ 目录下的个人证书（Windows .pfx / macOS .p12），
 * 若检测到证书文件，自动注入对应的 CSC_LINK 与密码环境变量并启动签名打包；
 * 若未生成证书，则平滑降级为无证书构建，并在控制台友好提示。
 */

import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const rootDir = process.cwd();
const certsDir = path.join(rootDir, "certs");
const winPfxPath = path.join(certsDir, "windows", "code-sign.pfx");
const macP12Path = path.join(certsDir, "macos", "mac-codesign.p12");

const args = process.argv.slice(2);
const defaultPassword = process.env.CERT_PASSWORD || "dev-cert-password-123";

const isWinBuild =
  args.includes("--win") ||
  args.some((arg) => arg.includes("nsis") || arg.includes("portable") || arg.includes("appx"));
const isMacBuild =
  args.includes("--mac") ||
  args.some((arg) => arg.includes("dmg") || arg.includes("zip") || arg.includes("mas"));
const isLinuxBuild =
  args.includes("--linux") ||
  args.some((arg) => arg.includes("AppImage") || arg.includes("deb") || arg.includes("rpm"));

const env = { ...process.env };

// 1. Windows 代码签名证书注入
if (isWinBuild || (!isMacBuild && !isLinuxBuild && process.platform === "win32")) {
  if (fs.existsSync(winPfxPath) && !env.CSC_LINK && !env.WIN_CSC_LINK) {
    env.WIN_CSC_LINK = winPfxPath;
    env.WIN_CSC_KEY_PASSWORD = env.WIN_CSC_KEY_PASSWORD || env.CSC_KEY_PASSWORD || defaultPassword;
    console.log(
      `[build-with-cert] 🔒 检测到 Windows 个人代码签名证书: ${path.relative(rootDir, winPfxPath)}，已启用 Authenticode 签名。`,
    );
  } else if (!env.CSC_LINK && !env.WIN_CSC_LINK) {
    console.log(
      "[build-with-cert] ℹ️ 未检测到 Windows 个人证书，以无证书模式构建（可运行 pnpm cert:generate 生成）。",
    );
  }
}

// 2. macOS 个人证书注入
if (isMacBuild || (!isWinBuild && !isLinuxBuild && process.platform === "darwin")) {
  if (fs.existsSync(macP12Path) && !env.CSC_LINK) {
    env.CSC_LINK = macP12Path;
    env.CSC_KEY_PASSWORD = env.CSC_KEY_PASSWORD || env.MAC_CSC_KEY_PASSWORD || defaultPassword;
    console.log(
      `[build-with-cert] 🔒 检测到 macOS 个人代码签名证书: ${path.relative(rootDir, macP12Path)}，已配置个人身份签名。`,
    );

    // 本地自签名模式下清除可能来自其他项目的未配齐 Apple 公证环境变量，避免阻断构建
    if (!env.ENABLE_APPLE_NOTARIZE) {
      delete env.APPLE_API_KEY;
      delete env.APPLE_API_KEY_ID;
      delete env.APPLE_API_ISSUER;
      delete env.APPLE_ID;
      delete env.APPLE_APP_SPECIFIC_PASSWORD;
      delete env.APPLE_TEAM_ID;
    }
  } else if (!env.CSC_LINK) {
    console.log(
      "[build-with-cert] ℹ️ 未检测到 macOS 个人证书，以无证书模式构建（可运行 pnpm cert:generate 生成）。",
    );
  }
}

// 3. Linux 提示
if (isLinuxBuild) {
  console.log("[build-with-cert] 🐧 正在执行 Linux 架构安装包打包...");
}

// 4. 执行 electron-builder
const builderCli = require.resolve("electron-builder/cli.js");

const child = spawn(process.execPath, [builderCli, ...args], {
  stdio: "inherit",
  env,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
