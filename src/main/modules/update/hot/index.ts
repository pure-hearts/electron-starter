/**
 * @file index.ts
 * @description 增量热更新（Hot Update）协调器：
 * 专注于下载并解压包含纯 Renderer 前端静态资源的数字签名 ZIP 包；
 * 严格限制沙箱权限，Main 与 Preload 绝对不参与热更。
 *
 * 核心特性：
 * 1. 签名与哈希双重校验 (Ed25519 + SHA-256)；
 * 2. 状态机生命周期 (staged -> trying -> active)；
 * 3. 启动崩溃自动回滚机制 (Rollback)；
 * 4. 多源分发适配 (GitHub Releases / OSS / S3 / 自建 CDN)；
 * 5. 用户自主重启或下次无感生效。
 */

import { app } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HotUpdateInfo, HotUpdateResult } from "../../../../shared/ipc";
import { runtimeConfig } from "../../core/config";
import { broadcast } from "../../../window";
import { log } from "../../core/logger";
import { verifyHotManifest } from "./manifest";
import { extractSafe } from "./archive";
import { singleFlight } from "../../core/single-flight";
import { parseHotPointer, type HotPointer as Pointer } from "./pointer";
import { validateUpdateFeedUrl } from "../full/feed-url";
import { notifyBusiness } from "../../notification";

const here = path.dirname(fileURLToPath(import.meta.url));

// 声明全局生命周期控制器，应用退出时中止未完成的网络下载
let lifetime = new AbortController();

export function disposeHotUpdate(): void {
  lifetime.abort();
}

export function initHotUpdate(): void {
  if (lifetime.signal.aborted) {
    lifetime = new AbortController();
  }
}

/** 限制增量包体积上限为 32MB，防止恶意异常包耗尽磁盘 */
const MAX_ZIP = 32 * 1024 * 1024;

/** 用户数据区热更新资源工作目录 (userData/renderer-updates) */
function workspace(): string {
  return path.join(app.getPath("userData"), "renderer-updates");
}

/** 运行时状态指针文件路径 (userData/renderer-updates/current.json) */
function pointerPath(): string {
  return path.join(workspace(), "current.json");
}

/** 初始原生打包内置的前端静态资源根目录 */
function installedRoot(): string {
  return path.resolve(here, "../dist/renderer");
}

/** 从磁盘读取并防御性解析指针，若大版本不兼容或损坏返回 null */
function readPointer(): Pointer | null {
  try {
    return parseHotPointer(
      JSON.parse(fs.readFileSync(pointerPath(), "utf8")) as unknown,
      app.getVersion(),
    );
  } catch {
    return null;
  }
}

/** 原子写入热更新指针文件 (通过 .tmp 临时文件重命名，防止写入中断导致文件损坏) */
function writePointer(pointer: Pointer): void {
  fs.mkdirSync(workspace(), { recursive: true });
  const temp = pointerPath() + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(pointer, null, 2));
  fs.renameSync(temp, pointerPath());
}

/** 验证候选目录合法性：必须包含 index.html 且目录名符合格式 */
function candidate(name: string): string | null {
  const root = path.resolve(workspace(), name);
  return name && /^[a-z0-9_-]+$/i.test(name) && fs.existsSync(path.join(root, "index.html"))
    ? root
    : null;
}

/**
 * 启动时自愈与状态迁移：
 * - staged -> trying: 标记开始尝试加载新资源；
 * - trying -> rollback: 若启动时仍处于 trying，说明上次尝试引发了崩溃，自动回退到上一可用版本。
 */
export function recoverPendingUpdate(): void {
  const pointer = readPointer();
  if (pointer?.phase === "staged") {
    // 首次加载待验证版本，进入 trying 试跑阶段
    writePointer({ ...pointer, phase: "trying" });
  } else if (pointer?.phase === "trying") {
    // 崩溃自愈：上一次启动在 trying 阶段未完成健康上报，触发自动回滚
    log.warn("Rolling back unconfirmed renderer update", pointer.revision);
    if (pointer.previous) {
      writePointer({
        revision: Number(pointer.previous.replace(/^rev-/, "")) || 0,
        directory: pointer.previous,
        previous: null,
        compatibleApp: app.getVersion(),
        phase: "active",
      });
    } else {
      // 无上一热更版本时，直接清理指针，彻底退回安装包原生资源
      fs.rmSync(pointerPath(), { force: true });
    }
  }
}

/** 主窗口加载成功后触发健康确认，将 trying 提升为 active 稳定版本 */
export function markRendererHealthy(): void {
  const p = readPointer();
  if (p?.phase === "trying") {
    writePointer({ ...p, phase: "active" });
    log.info(`Renderer update marked healthy and active: rev-${p.revision}`);
  }
}

/** 根据当前指针返回实际应当生效的前端静态资源根目录 */
export function activeRendererRoot(): string {
  const pointer = readPointer();
  if (pointer?.phase === "staged") {
    // staged 阶段尚未重启，当前仍使用 previous 或初始内置资源
    return (pointer.previous && candidate(pointer.previous)) || installedRoot();
  }
  if (pointer) {
    return candidate(pointer.directory) ?? installedRoot();
  }
  return installedRoot();
}

/**
 * 获取当前增量热更新状态与版本信息（供 IPC 与前端视图查询展示）。
 */
export function getHotUpdateInfo(): HotUpdateInfo {
  const pointer = readPointer();
  return {
    currentRevision: pointer?.revision ?? 0,
    currentVersionTag:
      pointer?.versionTag ?? (pointer?.revision ? String(pointer.revision) : "base"),
    currentCommit: pointer?.commit ?? "base",
    phase: pointer?.phase ?? "none",
    previousDirectory: pointer?.previous ?? null,
    activeDirectory: activeRendererRoot(),
  };
}

/**
 * 触发应用安全重启以立即生效增量热更。
 */
export function applyHotRestart(): void {
  log.info("Relaunching application to activate staged hot update");
  const args = process.argv.slice(1);
  if (process.env.VITE_DEV_SERVER_URL && !args.some((a) => a.startsWith("--dev-server-url="))) {
    args.push(`--dev-server-url=${process.env.VITE_DEV_SERVER_URL}`);
  }
  app.relaunch({ args });
  app.exit(0);
}

/** 读取内置公钥 PEM 文本（用于验签） */
function signingKey(): string | null {
  const location = app.isPackaged
    ? path.join(process.resourcesPath, "resources", "hot-update-public-key.pem")
    : path.join(process.cwd(), "resources", "hot-update-public-key.pem");
  try {
    return fs.readFileSync(location, "utf8");
  } catch {
    return null;
  }
}

/** 带大小上限与超时限制的下载辅助函数 */
async function readLimited(url: string, max: number, signal: AbortSignal): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    redirect: "error",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        throw new Error("Update size limit exceeded");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks);
}

/**
 * 检查并执行增量热更新：
 * 使用 singleFlight 合并重复并发调用，防止同时下载/解压相同资源。
 */
export const checkHotUpdate = singleFlight(async (): Promise<HotUpdateResult> => {
  const config = runtimeConfig();
  const key = signingKey();
  const allowDev = process.env.HOT_UPDATE_DEV_MODE === "1";

  // 未打包且未开启调试模式，或缺少公钥/更新地址时，安全返回 disabled
  if ((!app.isPackaged && !allowDev) || !key || !config.hotUpdateUrl) {
    return {
      status: "disabled",
      message: "Configure HTTPS update URL and release public key first",
    };
  }

  const signal = lifetime.signal;
  try {
    signal.throwIfAborted();
    validateUpdateFeedUrl(config.hotUpdateUrl);
    const url = new URL(config.hotUpdateUrl);

    broadcast("update:state", { kind: "hot", status: "checking" });
    const raw = await readLimited(url.toString(), 16_384, signal);
    const m = verifyHotManifest(JSON.parse(raw.toString("utf8")) as unknown, app.getVersion(), key);

    const current = readPointer();

    // 已有已就绪等待重启的补丁时，提示用户先重启
    if (current?.phase === "staged" || current?.phase === "trying") {
      return { status: "ready", message: "Restart app before checking another hot update" };
    }

    // 时间戳主序比对：当前已是最新或更高版本
    if (m.revision <= (current?.revision ?? 0)) {
      return { status: "up-to-date" };
    }

    // 开始下载增量 ZIP 包
    broadcast("update:state", { kind: "hot", status: "downloading" });
    const bytes = await readLimited(m.url, MAX_ZIP, signal);
    signal.throwIfAborted();

    // SHA-256 完整性哈希校验
    if (createHash("sha256").update(bytes).digest("hex") !== m.sha256) {
      throw new Error("SHA-256 mismatch");
    }

    // 解压至独立的版本目录 rev-[revision]
    const name = "rev-" + m.revision;
    const temp = path.join(workspace(), name + "-tmp");
    const target = path.join(workspace(), name);

    fs.mkdirSync(workspace(), { recursive: true });
    fs.rmSync(temp, { recursive: true, force: true });
    fs.mkdirSync(temp);

    try {
      extractSafe(bytes, temp);
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      fs.renameSync(temp, target);
    } catch (err) {
      fs.rmSync(temp, { recursive: true, force: true });
      throw err;
    }

    // 写入就绪指针 (staged)
    writePointer({
      revision: m.revision,
      versionTag: m.versionTag,
      commit: m.commit,
      directory: name,
      previous: current?.directory ?? null,
      compatibleApp: app.getVersion(),
      phase: "staged",
    });

    // 广播就绪状态并向用户发送温和桌面通知
    broadcast("update:state", { kind: "hot", status: "ready" });
    notifyBusiness({
      title: "资源更新已就绪",
      body: `新版本 (${m.versionTag || m.revision}) 已就绪，重启应用后生效。`,
      kind: "success",
      dedupeKey: "hot-update-ready",
    });

    return {
      status: "ready",
      message: `Resource update is staged (${m.versionTag || m.revision}); restart app to activate`,
    };
  } catch (error) {
    log.error("Hot update failed", error);
    broadcast("update:state", {
      kind: "hot",
      status: "error",
      error: "资源更新失败，请稍后重试。",
    });
    return { status: "error", message: "资源更新失败，请稍后重试。" };
  }
});
