import fs from "node:fs";
import path from "node:path";

/**
 * 清理非法文件名字符，防止目录穿越与注入。
 */
export function sanitizeFilename(filename: string): string {
  const base = path.posix.basename(path.win32.basename(filename));
  // 移除控制字符和 Windows/Linux 非法字符
  const cleaned = Array.from(base)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 32 || '<>:"/\\|?*'.includes(ch)) return "_";
      return ch;
    })
    .join("")
    .replace(/^\.+/, "")
    .trim();
  return cleaned || "download";
}

export interface DownloadPathPlan {
  filename: string;
  finalPath: string;
  tempPath: string;
}

/**
 * 计算无冲突的保存路径与对应临时下载路径 (.download)。
 * 若目标目录存在同名文件，自动追加递增序号如 name (1).ext，绝不覆盖已有文件。
 */
export function planDownloadPath(
  baseDir: string,
  rawFilename: string,
  exists: (p: string) => boolean = fs.existsSync,
): DownloadPathPlan {
  const safe = sanitizeFilename(rawFilename);
  const ext = path.extname(safe);
  const nameWithoutExt = ext ? safe.slice(0, -ext.length) : safe;

  let candidateName = safe;
  let candidatePath = path.join(baseDir, candidateName);
  let index = 1;

  while (exists(candidatePath) && index < 10000) {
    candidateName = `${nameWithoutExt} (${index})${ext}`;
    candidatePath = path.join(baseDir, candidateName);
    index++;
  }

  // 临时文件与最终文件置于同一目录下，确保跨平台原子 rename 不会触发跨设备 EXDEV 错误
  const tempPath = candidatePath + ".download";

  return {
    filename: candidateName,
    finalPath: candidatePath,
    tempPath,
  };
}

/**
 * 将临时文件原子重命名为最终文件。
 */
export async function finalizeTempFile(
  tempPath: string,
  finalPath: string,
  renameFn: (oldPath: string, newPath: string) => Promise<void> = fs.promises.rename,
): Promise<void> {
  await renameFn(tempPath, finalPath);
}

/**
 * 异步清理下载过程中的临时文件，吞掉不存在的异常。
 */
export async function cleanupTempFile(
  tempPath: string,
  unlinkFn: (p: string) => Promise<void> = fs.promises.unlink,
): Promise<void> {
  try {
    await unlinkFn(tempPath);
  } catch {
    // 忽略文件不存在或已被移除的错误
  }
}
