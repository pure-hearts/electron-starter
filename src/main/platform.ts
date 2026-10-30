/** 统一平台判断；主进程模块不再直接散落 process.platform 字符串。 */
import os from "node:os";
import { createPlatformInfo, type PlatformInfo } from "../shared/platform";

/**
 * 主进程平台信息单例
 * 天然处于 Electron/Node 容器内部，具备操作系统精准的 release 版本信息。
 */
export const platform: PlatformInfo = createPlatformInfo(process.platform, os.release(), true);

export type { PlatformInfo, WindowsVersionInfo, MacVersionInfo } from "../shared/platform";
