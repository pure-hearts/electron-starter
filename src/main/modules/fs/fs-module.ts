/**
 * @file fs-module.ts
 * @description 文件系统核心服务模块：
 * 纯原生异步实现（node:fs/promises + node:path + node:crypto + electron），
 * 全面支持 Promise 异步风格，提供对齐 fs-extra 核心行为及桌面专属增强能力。
 */

import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app, dialog, shell, BrowserWindow } from "electron";
import { safeLocalPath } from "../../../shared/validation";
import type {
  AppPaths,
  FsCopyOptions,
  FsEntry,
  FsMoveOptions,
  FsOpenDialogOptions,
  FsPathInfo,
  FsSaveDialogOptions,
  FsStat,
} from "../../../shared/ipc";

/** 单次 IPC 文件读写保护阈值：50MB (字节)，防止超大文件导致 IPC 缓冲区溢出或界面无响应 */
export const MAX_IPC_FILE_SIZE = 50 * 1024 * 1024;

/**
 * 判断目标路径（文件或目录）是否存在
 * @param targetPath 目标本地绝对路径
 * @returns 存在返回 true，不存在或路径非法返回 false
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    const verified = safeLocalPath(targetPath);
    await fs.access(verified);
    return true;
  } catch {
    return false;
  }
}

/** 兼容 exists 别名，行为与 pathExists 完全一致 */
export const exists = pathExists;

/**
 * 确保目录存在（类似 mkdir -p）
 * 目标目录若已存在直接返回 true；不存在则递归创建父级与目标目录后返回 true
 * @param targetPath 目标目录路径
 * @returns 成功确保存在返回 true
 */
export async function ensureDir(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.mkdir(verified, { recursive: true });
  return true;
}

/** 兼容 mkdirs 别名，行为与 ensureDir 完全一致 */
export const mkdirs = ensureDir;

/**
 * 确保文件存在（类似 touch）
 * 目标文件若已存在直接返回 true；不存在则自动递归补全各级缺失的父目录，并创建一个空文件后返回 true
 * @param targetPath 目标文件路径
 * @returns 成功确保文件存在返回 true
 */
export async function ensureFile(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  if (await pathExists(verified)) {
    return true;
  }
  const parent = path.dirname(verified);
  await fs.mkdir(parent, { recursive: true });
  await fs.writeFile(verified, "", { flag: "wx" }).catch(async (err: unknown) => {
    // 若并发创建过程中已被其他进程创建，安全忽略 EEXIST 错误
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err;
    }
  });
  return true;
}

/**
 * 确保硬链接（Hard Link）存在，自动补全目标父级目录
 * @param srcPath 源文件路径
 * @param destPath 目标链接路径
 * @returns 成功确保存在返回 true
 */
export async function ensureLink(srcPath: string, destPath: string): Promise<boolean> {
  const src = safeLocalPath(srcPath);
  const dest = safeLocalPath(destPath);
  if (await pathExists(dest)) {
    return true;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.link(src, dest);
  return true;
}

/**
 * 确保符号链接（Symbolic Link / 软链接）存在，自动补全目标父级目录
 * @param srcPath 源文件/目录路径
 * @param destPath 目标链接路径
 * @param type 链接类型（仅 Windows 环境生效：'dir' | 'file' | 'junction'）
 * @returns 成功确保存在返回 true
 */
export async function ensureSymlink(
  srcPath: string,
  destPath: string,
  type?: "dir" | "file" | "junction",
): Promise<boolean> {
  const src = safeLocalPath(srcPath);
  const dest = safeLocalPath(destPath);
  if (await pathExists(dest)) {
    return true;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.symlink(src, dest, type);
  return true;
}

/**
 * 检查目录是否为空目录，或文件是否为 0 字节
 * @param targetPath 目标本地路径
 * @returns 为空返回 true，否则返回 false
 */
export async function isEmpty(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  const fileStat = await fs.stat(verified);
  if (fileStat.isDirectory()) {
    const list = await fs.readdir(verified);
    return list.length === 0;
  }
  return fileStat.size === 0;
}

/**
 * 读取并自动反序列化 JSON 文件
 * 支持传入 fallback 兜底默认值：当文件不存在或格式解析异常时，安全返回 fallback，杜绝前端组件白屏崩溃
 * @param targetPath 目标 JSON 文件路径
 * @param fallback 可选的兜底默认值
 * @returns 解析后的 JavaScript 数据结构，或兜底数据
 */
export async function readJson(targetPath: string, fallback?: unknown): Promise<unknown> {
  const verified = safeLocalPath(targetPath);
  try {
    const raw = await fs.readFile(verified, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

/**
 * 写入 JSON 数据至目标文件
 * 自动检测并递归补全不存在的父级目录，默认开启 2 空格格式化缩进
 * @param targetPath 目标文件路径
 * @param data 需要序列化的 JavaScript 数据
 * @param options 可选配置，spaces 控制缩进空格数（默认 2）
 * @returns 写入成功返回 true
 */
export async function writeJson(
  targetPath: string,
  data: unknown,
  options?: { spaces?: number },
): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.mkdir(path.dirname(verified), { recursive: true });
  const spaces = options?.spaces ?? 2;
  const content = JSON.stringify(data, null, spaces);
  await fs.writeFile(verified, content, "utf-8");
  return true;
}

/** 兼容 outputJson 别名，行为与 writeJson 完全一致 */
export const outputJson = writeJson;

/**
 * 读取文本文件内容
 * 内置单次 IPC 50MB 阈值保护，支持传入 fallback 兜底值
 * @param targetPath 目标文件路径
 * @param options 可选配置，支持自定义编码与 fallback 默认值
 * @returns 文本内容字符串
 */
export async function readText(
  targetPath: string,
  options?: { encoding?: "utf-8" | "ascii"; fallback?: string },
): Promise<string> {
  const verified = safeLocalPath(targetPath);
  try {
    const fileStat = await fs.stat(verified);
    if (fileStat.size > MAX_IPC_FILE_SIZE) {
      throw new Error(`File size (${fileStat.size}B) exceeds 50MB IPC limit`);
    }
    const encoding = options?.encoding ?? "utf-8";
    return await fs.readFile(verified, { encoding });
  } catch (error) {
    if (options?.fallback !== undefined) {
      return options.fallback;
    }
    throw error;
  }
}

/**
 * 写入文本内容至文件
 * 自动递归创建缺失的父级目录，支持覆盖或追加（append）模式
 * @param targetPath 目标文件路径
 * @param content 待写入文本字符串
 * @param options 可选配置，支持自定义编码与追加模式
 * @returns 写入成功返回 true
 */
export async function writeText(
  targetPath: string,
  content: string,
  options?: { encoding?: "utf-8" | "base64"; append?: boolean },
): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.mkdir(path.dirname(verified), { recursive: true });
  const encoding = options?.encoding === "base64" ? "base64" : "utf-8";
  if (options?.append) {
    await fs.appendFile(verified, content, { encoding });
  } else {
    await fs.writeFile(verified, content, { encoding });
  }
  return true;
}

/** 兼容 outputFile 别名，行为与 writeText 完全一致 */
export const outputFile = writeText;

/**
 * 快速读取二进制文件并转为 Base64 编码字符串
 * 包含单次 IPC 50MB 安全体积校验
 * @param targetPath 目标二进制文件路径
 * @returns Base64 编码字符串
 */
export async function readBinary(targetPath: string): Promise<string> {
  const verified = safeLocalPath(targetPath);
  const fileStat = await fs.stat(verified);
  if (fileStat.size > MAX_IPC_FILE_SIZE) {
    throw new Error(`File size (${fileStat.size}B) exceeds 50MB IPC limit`);
  }
  const buf = await fs.readFile(verified);
  return buf.toString("base64");
}

/**
 * 将 Base64 编码数据还原写入为二进制文件
 * 自动补齐缺失的各级父级目录
 * @param targetPath 目标文件路径
 * @param base64Data Base64 编码内容
 * @returns 写入成功返回 true
 */
export async function writeBinary(targetPath: string, base64Data: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.mkdir(path.dirname(verified), { recursive: true });
  const buf = Buffer.from(base64Data, "base64");
  await fs.writeFile(verified, buf);
  return true;
}

/**
 * 标准文件异步读取
 * 支持 utf-8 字符串与 base64 格式
 * @param targetPath 目标文件路径
 * @param options 可选配置（支持 utf-8 / base64）
 * @returns 文件内容
 */
export async function readFile(
  targetPath: string,
  options?: { encoding?: "utf-8" | "base64" },
): Promise<string> {
  const verified = safeLocalPath(targetPath);
  const fileStat = await fs.stat(verified);
  if (fileStat.size > MAX_IPC_FILE_SIZE) {
    throw new Error(`File size (${fileStat.size}B) exceeds 50MB IPC limit`);
  }
  const encoding = options?.encoding ?? "utf-8";
  if (encoding === "base64") {
    const buf = await fs.readFile(verified);
    return buf.toString("base64");
  }
  return await fs.readFile(verified, "utf-8");
}

/**
 * 标准文件异步写入
 * @param targetPath 目标文件路径
 * @param data 待写入字符串
 * @param options 编码配置
 * @returns 成功返回 true
 */
export async function writeFile(
  targetPath: string,
  data: string,
  options?: { encoding?: "utf-8" | "base64" },
): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  const encoding = options?.encoding === "base64" ? "base64" : "utf-8";
  await fs.writeFile(verified, data, { encoding });
  return true;
}

/**
 * 追加内容至文件末尾
 * @param targetPath 目标文件路径
 * @param data 追加内容
 * @param options 编码配置
 * @returns 成功返回 true
 */
export async function appendFile(
  targetPath: string,
  data: string,
  options?: { encoding?: "utf-8" },
): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.appendFile(verified, data, options);
  return true;
}

/**
 * 递归复制文件或整个目录树
 * 自动补齐目标父级目录，支持覆盖控制与已存在冲突阻断
 * @param srcPath 源文件/目录路径
 * @param destPath 目标文件/目录路径
 * @param options 复制选项，如 overwrite（默认 true）
 * @returns 复制成功返回 true
 */
export async function copy(
  srcPath: string,
  destPath: string,
  options?: FsCopyOptions,
): Promise<boolean> {
  const src = safeLocalPath(srcPath);
  const dest = safeLocalPath(destPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, {
    recursive: true,
    force: options?.overwrite !== false,
    errorOnExist: options?.errorOnExist ?? false,
  });
  return true;
}

/**
 * 移动/重命名文件或目录
 * 底层优先原子 rename；若遇到跨分区/跨磁盘 EXDEV 报错，自动平滑降级为深度复制后删除源文件
 * @param srcPath 源路径
 * @param destPath 目标路径
 * @param options 移动选项，如 overwrite（默认 true）
 * @returns 移动成功返回 true
 */
export async function move(
  srcPath: string,
  destPath: string,
  options?: FsMoveOptions,
): Promise<boolean> {
  const src = safeLocalPath(srcPath);
  const dest = safeLocalPath(destPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  if (options?.overwrite === false && (await pathExists(dest))) {
    throw new Error(`Destination already exists: ${dest}`);
  }

  try {
    await fs.rename(src, dest);
    return true;
  } catch (err: unknown) {
    // 跨驱动器/分区 EXDEV 报错时降级为复制后删除
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await fs.cp(src, dest, { recursive: true, force: true });
      await fs.rm(src, { recursive: true, force: true });
      return true;
    }
    throw err;
  }
}

/**
 * 幂等安全删除文件或目录（类似 rm -rf）
 * 目标路径若本就不存在亦静默返回 true，绝不向上抛出不存在异常
 * @param targetPath 待删除文件或目录路径
 * @returns 删除成功或路径不存在均返回 true
 */
export async function remove(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.rm(verified, { recursive: true, force: true });
  return true;
}

/**
 * 清空指定目录内的所有子文件与子文件夹，保留目录自身
 * @param targetPath 目标目录路径
 * @returns 清空成功返回 true
 */
export async function emptyDir(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await ensureDir(verified);
  const items = await fs.readdir(verified);
  await Promise.all(
    items.map((item) => fs.rm(path.join(verified, item), { recursive: true, force: true })),
  );
  return true;
}

/**
 * 安全将文件或目录移至操作系统废纸篓/回收站
 * 避免永久物理删除造成的用户数据误丢失
 * @param targetPath 目标文件或目录路径
 * @returns 移入回收站成功返回 true
 */
export async function trash(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await shell.trashItem(verified);
  return true;
}

/**
 * 创建目录
 * @param targetPath 目标目录路径
 * @param options 可选配置，默认开启 recursive: true 递归创建
 * @returns 创建成功返回 true
 */
export async function mkdir(
  targetPath: string,
  options?: { recursive?: boolean },
): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.mkdir(verified, { recursive: options?.recursive ?? true });
  return true;
}

/**
 * 扫描目录下所有条目清单
 * 返回包含名称、完整绝对路径、文件/目录类型、大小与修改时间的强类型条目列表
 * @param dirPath 目录路径
 * @param options 扫描配置，支持 recursive 递归遍历与 maxDepth 最大深度控制
 * @returns 条目数组
 */
export async function readDir(
  dirPath: string,
  options?: { recursive?: boolean; maxDepth?: number },
): Promise<FsEntry[]> {
  const verified = safeLocalPath(dirPath);
  const results: FsEntry[] = [];
  const maxDepth = options?.maxDepth ?? (options?.recursive ? 10 : 1);

  async function scan(currentDir: string, currentDepth: number) {
    if (currentDepth > maxDepth) return;
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(currentDir, ent.name);
      let size: number | undefined;
      let mtime: number | undefined;
      try {
        const s = await fs.stat(full);
        size = s.size;
        mtime = s.mtimeMs;
      } catch {
        // 遇到无访问权限或虚拟文件时忽略详细 stat
      }

      results.push({
        name: ent.name,
        path: full,
        isFile: ent.isFile(),
        isDirectory: ent.isDirectory(),
        isSymbolicLink: ent.isSymbolicLink(),
        size,
        mtime,
      });

      if (options?.recursive && ent.isDirectory()) {
        await scan(full, currentDepth + 1);
      }
    }
  }

  await scan(verified, 1);
  return results;
}

/** 兼容 readdir 别名，行为与 readDir 完全一致 */
export const readdir = readDir;

/**
 * 获取文件或目录的属性元数据（跟踪软链接指向的目标）
 * @param targetPath 目标本地路径
 * @returns 元数据对象，目标不存在时安全返回 null
 */
export async function stat(targetPath: string): Promise<FsStat | null> {
  try {
    const verified = safeLocalPath(targetPath);
    const s = await fs.stat(verified);
    let isReadonly = false;
    try {
      await fs.access(verified, 2 /* W_OK */);
    } catch {
      isReadonly = true;
    }
    return {
      size: s.size,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymbolicLink: s.isSymbolicLink(),
      mtime: s.mtimeMs,
      birthtime: s.birthtimeMs,
      mode: s.mode,
      readonly: isReadonly,
    };
  } catch {
    return null;
  }
}

/**
 * 获取符号链接自身的元数据（不解引用软链接）
 * @param targetPath 目标本地路径
 * @returns 符号链接元数据对象，不存在时安全返回 null
 */
export async function lstat(targetPath: string): Promise<FsStat | null> {
  try {
    const verified = safeLocalPath(targetPath);
    const s = await fs.lstat(verified);
    return {
      size: s.size,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymbolicLink: s.isSymbolicLink(),
      mtime: s.mtimeMs,
      birthtime: s.birthtimeMs,
      mode: s.mode,
      readonly: false,
    };
  } catch {
    return null;
  }
}

/**
 * 主进程流式计算目标文件的散列摘要值（Checksum）
 * 基于管道流计算，即使数十 GB 大文件亦无需加载入内存，零 IPC 传输带宽消耗
 * @param targetPath 目标本地文件路径
 * @param algorithm 哈希算法，支持 'md5' 或 'sha256'（默认 'sha256'）
 * @returns 16 进制散列摘要字符串
 */
export async function checksum(
  targetPath: string,
  algorithm: "md5" | "sha256" = "sha256",
): Promise<string> {
  const verified = safeLocalPath(targetPath);
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = createReadStream(verified);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

/**
 * 获取操作系统常用的预定义标准基准路径字典
 * 包括 userData、documents、downloads、desktop、temp、home 等
 * @returns 系统标准路径字典
 */
export async function getAppPaths(): Promise<AppPaths> {
  const safeGet = (name: Parameters<typeof app.getPath>[0]): string => {
    try {
      return app.getPath(name);
    } catch {
      return "";
    }
  };

  return {
    home: safeGet("home"),
    appData: safeGet("appData"),
    userData: safeGet("userData"),
    temp: safeGet("temp"),
    desktop: safeGet("desktop"),
    documents: safeGet("documents"),
    downloads: safeGet("downloads"),
    pictures: safeGet("pictures"),
    music: safeGet("music"),
    videos: safeGet("videos"),
  };
}

/**
 * 解析路径结构信息，前端渲染层无需额外引入 Node path 模块
 * @param targetPath 目标本地路径
 * @returns 包含 root、dir、base、ext、name 以及 isAbsolute 的结构化路径对象
 */
export async function pathInfo(targetPath: string): Promise<FsPathInfo> {
  const verified = safeLocalPath(targetPath);
  const parsed = path.parse(verified);
  return {
    root: parsed.root,
    dir: parsed.dir,
    dirname: parsed.dir,
    base: parsed.base,
    basename: parsed.base,
    ext: parsed.ext,
    extname: parsed.ext,
    name: parsed.name,
    isAbsolute: path.isAbsolute(verified),
  };
}

/**
 * 唤起系统原生文件/目录选择打开对话框
 * @param options 对话框配置（标题、默认路径、过滤器、多选/选择文件夹属性等）
 * @param sender 发起调用的 WebContents，用于将对话框模态挂载到所属窗口
 * @returns 选中的文件绝对路径列表，若用户取消则返回 null
 */
export async function showOpenDialog(
  options?: FsOpenDialogOptions,
  sender?: Electron.WebContents,
): Promise<string[] | null> {
  const win = sender ? BrowserWindow.fromWebContents(sender) : null;
  const dialogOpts: Electron.OpenDialogOptions = {
    title: options?.title,
    defaultPath: options?.defaultPath,
    buttonLabel: options?.buttonLabel,
    filters: options?.filters,
    properties: options?.properties ?? ["openFile"],
  };

  const res = win
    ? await dialog.showOpenDialog(win, dialogOpts)
    : await dialog.showOpenDialog(dialogOpts);
  if (res.canceled || !res.filePaths.length) {
    return null;
  }
  return res.filePaths;
}

/**
 * 唤起系统原生文件保存对话框
 * @param options 对话框配置（标题、默认文件名与路径、过滤器等）
 * @param sender 发起调用的 WebContents，用于将对话框模态挂载到所属窗口
 * @returns 用户选择的保存目标绝对路径，若取消则返回 null
 */
export async function showSaveDialog(
  options?: FsSaveDialogOptions,
  sender?: Electron.WebContents,
): Promise<string | null> {
  const win = sender ? BrowserWindow.fromWebContents(sender) : null;
  const dialogOpts: Electron.SaveDialogOptions = {
    title: options?.title,
    defaultPath: options?.defaultPath,
    buttonLabel: options?.buttonLabel,
    filters: options?.filters,
  };

  const res = win
    ? await dialog.showSaveDialog(win, dialogOpts)
    : await dialog.showSaveDialog(dialogOpts);
  if (res.canceled || !res.filePath) {
    return null;
  }
  return res.filePath;
}
