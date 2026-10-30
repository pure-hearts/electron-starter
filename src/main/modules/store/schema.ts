/** 持久化配置的数据结构、默认值和旧版本迁移规则。 */
import type { SettingKey, UserSettings } from "../../../shared/ipc";
// SettingKey 约束用户能够存储的字段名称。
export type SettingsValues = Record<SettingKey, string | boolean | number>;
export interface SettingsState extends SettingsValues {
  schemaVersion: number;
}
// 增加配置字段或迁移行为时，按需提高结构版本号。
export const CURRENT_SETTINGS_VERSION = 2;
// 全新安装或无效字段回退时使用这些默认值。
export const settingsDefaults: SettingsState = {
  schemaVersion: CURRENT_SETTINGS_VERSION,
  theme: "light",
  locale: "zh-CN",
  closeToTray: true,
  windowBounds: "",
  autoStart: false,
  defaultDownloadDir: "",
  downloadConcurrency: 10,
  autoResumeDownloads: true,
  notificationsEnabled: true,
  notificationSound: true,
  notifyOnDownload: true,
  notifyOnUpdate: true,
  globalShortcutToggle: "CommandOrControl+Shift+X",
};
/** 验证窗口尺寸和坐标，避免恢复到异常大小或极远的位置。 */
export function normalizeWindowBounds(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 512) return "";
  try {
    const rect: unknown = JSON.parse(value);
    if (!rect || typeof rect !== "object") return "";
    const b = rect as Record<string, unknown>;
    // 必须具备 x/y/width/height 四个有限数字才能还原窗口矩形。
    for (const key of ["x", "y", "width", "height"]) {
      if (typeof b[key] !== "number" || !Number.isFinite(b[key])) return "";
    }
    if (
      (b.width as number) < 820 ||
      (b.width as number) > 10000 ||
      (b.height as number) < 540 ||
      (b.height as number) > 10000 ||
      Math.abs(b.x as number) > 100000 ||
      Math.abs(b.y as number) > 100000
    )
      return "";
    // 旧矩形没有 maximized 字段仍保持原结构，新增状态只接受严格布尔值。
    return JSON.stringify({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      ...(typeof b.maximized === "boolean" ? { maximized: b.maximized } : {}),
    });
  } catch {
    return "";
  }
}
/** Upgrade untrusted, potentially outdated settings to the current schema. */
/** 将未知版本的配置提取为当前允许的字段，并丢弃无效值。 */
export function migrateSettings(source: unknown): SettingsState {
  // 排除 null 和数组，避免把错误的 JSON 结构当成设置对象。
  const raw =
    source && typeof source === "object" && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : {};
  return {
    schemaVersion: CURRENT_SETTINGS_VERSION,
    theme: raw.theme === "dark" || raw.theme === "system" ? raw.theme : "light",
    locale: raw.locale === "en-US" ? "en-US" : "zh-CN",
    closeToTray: typeof raw.closeToTray === "boolean" ? raw.closeToTray : true,
    windowBounds: normalizeWindowBounds(raw.windowBounds),
    autoStart: typeof raw.autoStart === "boolean" ? raw.autoStart : false,
    defaultDownloadDir: typeof raw.defaultDownloadDir === "string" ? raw.defaultDownloadDir : "",
    downloadConcurrency:
      typeof raw.downloadConcurrency === "number" &&
      Number.isInteger(raw.downloadConcurrency) &&
      raw.downloadConcurrency >= 1 &&
      raw.downloadConcurrency <= 50
        ? raw.downloadConcurrency
        : 10,
    autoResumeDownloads:
      typeof raw.autoResumeDownloads === "boolean" ? raw.autoResumeDownloads : true,
    notificationsEnabled:
      typeof raw.notificationsEnabled === "boolean" ? raw.notificationsEnabled : true,
    notificationSound: typeof raw.notificationSound === "boolean" ? raw.notificationSound : true,
    notifyOnDownload: typeof raw.notifyOnDownload === "boolean" ? raw.notifyOnDownload : true,
    notifyOnUpdate: typeof raw.notifyOnUpdate === "boolean" ? raw.notifyOnUpdate : true,
    globalShortcutToggle:
      typeof raw.globalShortcutToggle === "string" && raw.globalShortcutToggle.length <= 100
        ? raw.globalShortcutToggle
        : "CommandOrControl+Shift+X",
  };
}
/** 对比规范化结果，判断是否需要重新写入当前结构。 */
export function settingsNeedMigration(source: unknown): boolean {
  const normalized = migrateSettings(source);
  if (!source || typeof source !== "object" || Array.isArray(source)) return true;
  const raw = source as Record<string, unknown>;
  return Object.entries(normalized).some(([key, value]) => raw[key] !== value);
}

/** 提取面向渲染层设置中心的配置对象 */
export function extractUserSettings(state: SettingsState): UserSettings {
  return {
    theme: state.theme as "light" | "dark" | "system",
    locale: state.locale as "zh-CN" | "en-US",
    closeToTray: Boolean(state.closeToTray),
    autoStart: Boolean(state.autoStart),
    defaultDownloadDir: String(state.defaultDownloadDir || ""),
    downloadConcurrency: Number(state.downloadConcurrency || 10),
    autoResumeDownloads: Boolean(state.autoResumeDownloads),
    notificationsEnabled: Boolean(state.notificationsEnabled),
    notificationSound: Boolean(state.notificationSound),
    notifyOnDownload: Boolean(state.notifyOnDownload),
    notifyOnUpdate: Boolean(state.notifyOnUpdate),
    globalShortcutToggle: String(state.globalShortcutToggle || "CommandOrControl+Shift+X"),
  };
}
