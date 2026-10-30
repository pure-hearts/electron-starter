/**
 * @file platform.ts
 * @description 跨进程通用的平台探测数据结构与版本解析纯函数。
 * 可在主进程 (Node.js) 与渲染进程 (浏览器/Web) 无缝运行。
 */

export interface WindowsVersionInfo {
  /** 主版本号，Win7=6, Win8=6, Win10/Win11=10 */
  readonly major: number;
  /** 次版本号，Win7=1, Win8=2, Win8.1=3, Win10/Win11=0 */
  readonly minor: number;
  /** 系统内部 Build 号 (如 Win10 19045, Win11 22000/22621/22631) */
  readonly build: number;
  /** 是否为 Windows 7 或更早系统 (NT <= 6.1) */
  readonly isWin7OrLower: boolean;
  /** 是否为 Windows 8 / 8.1 (NT 6.2 / 6.3) */
  readonly isWin8: boolean;
  /** 是否为 Windows 10 (NT 10.0 且 build < 22000) */
  readonly isWin10: boolean;
  /** 是否为 Windows 11 或更高版本系统 (NT 10.0 且 build >= 22000) */
  readonly isWin11OrGreater: boolean;
}

export interface MacVersionInfo {
  /** Darwin 内核主版本号 (如 Darwin 20.x 对应 macOS 11 Big Sur) */
  readonly darwinMajor: number;
  /** 映射后的 macOS 大版本号 (如 11, 12, 13, 14, 15) */
  readonly macosMajor: number;
  /** 是否为 macOS 11 (Big Sur) 或更高版本 */
  readonly isBigSurOrGreater: boolean;
  /** 是否为 macOS 13 (Ventura) 或更高版本 */
  readonly isVenturaOrGreater: boolean;
  /** 是否为 macOS 14 (Sonoma) 或更高版本 */
  readonly isSonomaOrGreater: boolean;
}

export interface PlatformInfo {
  /** 是否运行在 Electron 容器环境内 */
  readonly isElectron: boolean;
  /** 是否运行在纯 Web 浏览器环境 */
  readonly isWeb: boolean;
  /** 当前平台原始标识 ('win32' | 'darwin' | 'linux' | 'web') */
  readonly current: string;
  /** 是否为 Windows 操作系统 */
  readonly isWindows: boolean;
  /** 是否为 macOS 操作系统 */
  readonly isMac: boolean;
  /** 是否为 Linux 操作系统 */
  readonly isLinux: boolean;
  /** Windows 细分版本信息；若非 Windows 系统则为 null */
  readonly windows: WindowsVersionInfo | null;
  /** macOS 细分版本信息；若非 macOS 系统则为 null */
  readonly mac: MacVersionInfo | null;
}

/**
 * 解析 Windows `os.release()` 版本字符串 (如 "10.0.22631" 或 "6.1.7601")
 */
export function parseWindowsVersion(releaseStr: string): WindowsVersionInfo {
  const parts = releaseStr.split(".").map((part) => parseInt(part, 10) || 0);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const build = parts[2] ?? 0;

  // Win7: NT 6.1; Vista: NT 6.0; XP: NT 5.x
  const isWin7OrLower = major < 6 || (major === 6 && minor <= 1);
  // Win8: NT 6.2; Win8.1: NT 6.3
  const isWin8 = major === 6 && (minor === 2 || minor === 3);
  // Windows 11 微软官方定义: NT 内核主版本依旧是 10.0，但 Build >= 22000
  const isWin11OrGreater = major >= 10 && build >= 22000;
  // Windows 10: NT 10.0 且 build < 22000 (首个正式版 10240, 终版 19045)
  const isWin10 = major === 10 && build < 22000;

  return {
    major,
    minor,
    build,
    isWin7OrLower,
    isWin8,
    isWin10,
    isWin11OrGreater,
  };
}

/**
 * 解析 Darwin `os.release()` 内核版本并映射到 macOS 真实大版本
 * 对应法则：macOS Major = Darwin Major - 9
 * - Darwin 20.x -> macOS 11 (Big Sur)
 * - Darwin 21.x -> macOS 12 (Monterey)
 * - Darwin 22.x -> macOS 13 (Ventura)
 * - Darwin 23.x -> macOS 14 (Sonoma)
 * - Darwin 24.x -> macOS 15 (Sequoia)
 */
export function parseMacVersion(darwinReleaseStr: string): MacVersionInfo {
  const parts = darwinReleaseStr.split(".").map((part) => parseInt(part, 10) || 0);
  const darwinMajor = parts[0] ?? 0;
  const macosMajor = darwinMajor >= 20 ? darwinMajor - 9 : 10;

  return {
    darwinMajor,
    macosMajor,
    isBigSurOrGreater: darwinMajor >= 20,
    isVenturaOrGreater: darwinMajor >= 22,
    isSonomaOrGreater: darwinMajor >= 23,
  };
}

/**
 * 跨端平台探测器纯函数
 * @param rawPlatform 操作系统字符串 (如 'win32' | 'darwin' | 'linux' | 'web')
 * @param osRelease 系统版本字符串 (如 Node.js os.release())
 * @param isElectronEnv 是否处于 Electron 容器
 */
export function createPlatformInfo(
  rawPlatform: string,
  osRelease = "",
  isElectronEnv = true,
): PlatformInfo {
  const isWindows = rawPlatform === "win32" || rawPlatform === "windows";
  const isMac = rawPlatform === "darwin" || rawPlatform === "mac";
  const isLinux = rawPlatform === "linux";

  const windows = isWindows && osRelease ? parseWindowsVersion(osRelease) : null;
  const mac = isMac && osRelease ? parseMacVersion(osRelease) : null;

  return {
    isElectron: isElectronEnv,
    isWeb: !isElectronEnv,
    current: rawPlatform,
    isWindows,
    isMac,
    isLinux,
    windows,
    mac,
  };
}
