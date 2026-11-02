/**
 * @file fs.ts
 * @description 文件系统 IPC 处理层：映射所有 fs:* 通道并安全转发至 fs-module。
 * 负责参数类型解构、上下文提取（如发送方 BrowserWindow），并由外层网关完成来源审查与超时熔断。
 */

import type { HandlerGroup } from "./types";
import type {
  FsCopyOptions,
  FsMoveOptions,
  FsOpenDialogOptions,
  FsSaveDialogOptions,
} from "../../../shared/ipc";
import {
  appendFile,
  checksum,
  copy,
  emptyDir,
  ensureDir,
  ensureFile,
  ensureLink,
  ensureSymlink,
  exists,
  getAppPaths,
  lstat,
  mkdir,
  mkdirs,
  move,
  outputFile,
  outputJson,
  pathExists,
  pathInfo,
  readBinary,
  readDir,
  readFile,
  readJson,
  readdir,
  readText,
  remove,
  showOpenDialog,
  showSaveDialog,
  stat,
  trash,
  writeBinary,
  writeFile,
  writeJson,
  writeText,
  isEmpty,
} from "../../modules/fs/fs-module";

export const fsHandlers = {
  // === 1. 存在性与智能保底 ===
  /** 确保目录存在；存在返回 true，不存在则递归创建后返回 true */
  "fs:ensureDir": (_e, [p]) => ensureDir(p as string),
  /** 兼容 mkdirs 别名 */
  "fs:mkdirs": (_e, [p]) => mkdirs(p as string),
  /** 确保文件存在；不存在则自动创建父级目录及空文件 */
  "fs:ensureFile": (_e, [p]) => ensureFile(p as string),
  /** 确保硬链接存在，自动补齐目标父级目录 */
  "fs:ensureLink": (_e, [src, dest]) => ensureLink(src as string, dest as string),
  /** 确保符号链接存在，自动补齐目标父级目录 */
  "fs:ensureSymlink": (_e, [src, dest, type]) =>
    ensureSymlink(src as string, dest as string, type as "dir" | "file" | "junction" | undefined),
  /** 判断目标路径是否存在 */
  "fs:exists": (_e, [p]) => exists(p as string),
  /** 兼容 pathExists 别名 */
  "fs:pathExists": (_e, [p]) => pathExists(p as string),
  /** 检查目录是否为空目录，或文件是否为 0 字节 */
  "fs:isEmpty": (_e, [p]) => isEmpty(p as string),

  // === 2. 便捷读写与自动补全 ===
  /** 读取并反序列化 JSON，支持 fallback 兜底默认值 */
  "fs:readJson": (_e, [p, fallback]) => readJson(p as string, fallback),
  /** 写入 JSON 数据，自动创建父级目录并格式化缩进 */
  "fs:writeJson": (_e, [p, data, opts]) =>
    writeJson(p as string, data, opts as { spaces?: number } | undefined),
  /** 兼容 outputJson 别名 */
  "fs:outputJson": (_e, [p, data, opts]) =>
    outputJson(p as string, data, opts as { spaces?: number } | undefined),
  /** 读取 UTF-8 文本内容，支持 fallback 兜底与 50MB 阈值保护 */
  "fs:readText": (_e, [p, opts]) =>
    readText(p as string, opts as { encoding?: "utf-8" | "ascii"; fallback?: string } | undefined),
  /** 写入文本内容，自动补齐父级目录，支持覆盖或 append 追加 */
  "fs:writeText": (_e, [p, content, opts]) =>
    writeText(
      p as string,
      content as string,
      opts as { encoding?: "utf-8" | "base64"; append?: boolean } | undefined,
    ),
  /** 兼容 outputFile 别名 */
  "fs:outputFile": (_e, [p, data, opts]) =>
    outputFile(
      p as string,
      data as string,
      opts as { encoding?: "utf-8" | "base64"; append?: boolean } | undefined,
    ),
  /** 读取二进制文件并转为 Base64 编码字符串（带 50MB 保护） */
  "fs:readBinary": (_e, [p]) => readBinary(p as string),
  /** 将 Base64 编码数据写入二进制文件，自动补齐父目录 */
  "fs:writeBinary": (_e, [p, data]) => writeBinary(p as string, data as string),
  /** 标准文件异步读取 */
  "fs:readFile": (_e, [p, opts]) =>
    readFile(p as string, opts as { encoding?: "utf-8" | "base64" } | undefined),
  /** 标准文件异步写入 */
  "fs:writeFile": (_e, [p, data, opts]) =>
    writeFile(p as string, data as string, opts as { encoding?: "utf-8" | "base64" } | undefined),
  /** 追加文件内容 */
  "fs:appendFile": (_e, [p, data, opts]) =>
    appendFile(p as string, data as string, opts as { encoding?: "utf-8" } | undefined),

  // === 3. 高级文件管理 ===
  /** 递归复制文件或整个目录树 */
  "fs:copy": (_e, [src, dest, opts]) =>
    copy(src as string, dest as string, opts as FsCopyOptions | undefined),
  /** 移动文件或目录，底层支持跨分区 EXDEV 自动降级与目标父目录补齐 */
  "fs:move": (_e, [src, dest, opts]) =>
    move(src as string, dest as string, opts as FsMoveOptions | undefined),
  /** 幂等安全删除文件或目录（类似 rm -rf，路径不存在静默返回 true） */
  "fs:remove": (_e, [p]) => remove(p as string),
  /** 清空目录内所有子文件与子目录，保留目录本身 */
  "fs:emptyDir": (_e, [p]) => emptyDir(p as string),
  /** 安全移至系统废纸篓/回收站（防误删） */
  "fs:trash": (_e, [p]) => trash(p as string),
  /** 创建目录 */
  "fs:mkdir": (_e, [p, opts]) => mkdir(p as string, opts as { recursive?: boolean } | undefined),

  // === 4. 目录检索与元数据完整性 ===
  /** 扫描目录下所有条目清单（含名称、类型、大小、修改时间） */
  "fs:readDir": (_e, [p, opts]) =>
    readDir(p as string, opts as { recursive?: boolean; maxDepth?: number } | undefined),
  /** 兼容 readdir 别名 */
  "fs:readdir": (_e, [p, opts]) =>
    readdir(p as string, opts as { recursive?: boolean; maxDepth?: number } | undefined),
  /** 获取文件或目录属性元数据 */
  "fs:stat": (_e, [p]) => stat(p as string),
  /** 获取符号链接属性元数据 */
  "fs:lstat": (_e, [p]) => lstat(p as string),
  /** 主进程管道流式计算文件散列摘要（MD5 / SHA256） */
  "fs:checksum": (_e, [p, algo]) => checksum(p as string, (algo as "md5" | "sha256") || "sha256"),

  // === 5. 系统路径与原生对话框 ===
  /** 获取常用预设标准基准路径字典（userData, documents, downloads 等） */
  "fs:appPaths": () => getAppPaths(),
  /** 解析路径结构信息（root, dir, base, ext, name, isAbsolute） */
  "fs:pathInfo": (_e, [p]) => pathInfo(p as string),
  /** 唤起系统原生文件/目录打开选择对话框 */
  "fs:dialog:open": (e, [opts]) =>
    showOpenDialog(opts as FsOpenDialogOptions | undefined, e.sender),
  /** 唤起系统原生文件保存对话框 */
  "fs:dialog:save": (e, [opts]) =>
    showSaveDialog(opts as FsSaveDialogOptions | undefined, e.sender),
  /** 兼容 showOpenDialog 别名 */
  "fs:showOpenDialog": (e, [opts]) =>
    showOpenDialog(opts as FsOpenDialogOptions | undefined, e.sender),
  /** 兼容 showSaveDialog 别名 */
  "fs:showSaveDialog": (e, [opts]) =>
    showSaveDialog(opts as FsSaveDialogOptions | undefined, e.sender),
} satisfies HandlerGroup;
