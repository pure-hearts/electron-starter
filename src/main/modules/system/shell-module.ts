/**
 * 原生 Shell 与桌面集成模块：
 * 严格防范危险 URL 与非法本地路径注入，提供受控的安全桌面交互能力。
 */
import { shell } from "electron";
import { safeExternalUrl, safeLocalPath } from "../../../shared/validation";

/**
 * 在系统的文件管理器中定位并高亮显示目标文件或目录。
 * 捕获并防御底层可能抛出的系统异常，操作失败安全返回 false。
 */
export async function showItemInFolder(targetPath: string): Promise<boolean> {
  try {
    const verified = safeLocalPath(targetPath);
    shell.showItemInFolder(verified);
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用系统默认关联程序打开本地路径对应文件或目录。
 * 返回 Electron shell.openPath 的字符串结果（空字符串表示成功，非空字符串为错误原因）。
 */
export async function openPath(targetPath: string): Promise<string> {
  try {
    const verified = safeLocalPath(targetPath);
    return await shell.openPath(verified);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * 校验 safeExternalUrl 白名单后，使用系统默认浏览器打开外部超链接。
 * 拒绝 javascript:、file:、data: 等危险协议。
 */
export async function openExternal(url: string): Promise<boolean> {
  safeExternalUrl(url);
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将指定本地文件或目录移至系统回收站/废纸篓。
 * 捕获异常并安全返回操作布尔状态。
 */
export async function trashItem(targetPath: string): Promise<boolean> {
  try {
    const verified = safeLocalPath(targetPath);
    await shell.trashItem(verified);
    return true;
  } catch {
    return false;
  }
}
