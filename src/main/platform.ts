/** 统一平台判断；主进程模块不再直接散落 process.platform 字符串。 */
export const platform = {
  current: process.platform,
  isWindows: process.platform === "win32",
  isMac: process.platform === "darwin",
  isLinux: process.platform === "linux",
} as const;
