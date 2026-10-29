/**
 * 系统主题与原生色彩偏好模块：
 * 读取深色/浅色偏好与系统强调色，并在系统主题变更时广播到所有窗口。
 */
import { nativeTheme, systemPreferences } from "electron";
import { broadcastToAllWindows } from "../../window/broadcast";

/**
 * 标准化系统强调色为 #RRGGBB 格式：
 * 仅在 macOS (darwin) 与 Windows (win32) 下生效，Linux 与其他平台兜底为 null。
 */
export function normalizeAccentColor(raw: string | null | undefined): string | null {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return null;
  }
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const clean = raw.replace(/^#/, "").trim();
  if (clean.length < 6) {
    return null;
  }
  return `#${clean.slice(0, 6).toUpperCase()}`;
}

/**
 * 获取当前系统主题信息（深浅色偏好与强调色）。
 */
export function getSystemThemeInfo(): { shouldUseDarkColors: boolean; accentColor: string | null } {
  let accentColor: string | null = null;
  if (process.platform === "darwin" || process.platform === "win32") {
    try {
      if (typeof systemPreferences?.getAccentColor === "function") {
        accentColor = normalizeAccentColor(systemPreferences.getAccentColor());
      }
    } catch {
      accentColor = null;
    }
  }

  const shouldUseDarkColors = Boolean(nativeTheme?.shouldUseDarkColors);
  return {
    shouldUseDarkColors,
    accentColor,
  };
}

/**
 * 主题变更监听器（在模块加载时自动注册，并支持手动调用注销）。
 */
export function initThemeListener(): () => void {
  const handler = () => {
    broadcastToAllWindows("theme:system:changed", getSystemThemeInfo());
  };
  nativeTheme.on("updated", handler);
  return () => {
    nativeTheme.removeListener("updated", handler);
  };
}

// 模块加载时默认挂载全局更新监听
try {
  if (typeof nativeTheme?.on === "function") {
    nativeTheme.on("updated", () => {
      broadcastToAllWindows("theme:system:changed", getSystemThemeInfo());
    });
  }
} catch {
  // 防御测试隔离或早于 app ready 运行时的异常
}
