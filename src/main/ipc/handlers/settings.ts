/**
 * @file settings.ts
 * @description 设置中心、系统诊断、原生目录选择与全局快捷键 IPC Handlers
 */
import { dialog, BrowserWindow } from "electron";
import type { HandlerGroup } from "./types";
import { getAllSettings, updateAllSettings } from "../../modules/store";
import { setAutoStart } from "../../modules/system/startup";
import {
  registerToggleShortcut,
  getRegisteredShortcut,
} from "../../modules/system/shortcut-module";
import { getSystemDiagnostics, exportDiagnosticLogs } from "../../modules/system/diagnostics";
import { getNetworkStatus } from "../../modules/system/network-module";
import { setDownloadConcurrency } from "../../modules/download";
import type { UserSettings } from "../../../shared/ipc";

export const settingsHandlers = {
  "settings:all:get": () => getAllSettings(),
  "settings:all:set": (_e, [partial]) => {
    const updated = updateAllSettings(partial as Partial<UserSettings>);
    const p = partial as Partial<UserSettings>;
    // 联动系统自启动
    if (typeof p.autoStart === "boolean") {
      setAutoStart(p.autoStart);
    }
    // 联动并发下载配置
    if (typeof p.downloadConcurrency === "number") {
      setDownloadConcurrency(p.downloadConcurrency);
    }
    // 联动全局快捷键
    if (typeof p.globalShortcutToggle === "string") {
      registerToggleShortcut(p.globalShortcutToggle);
    }
    return updated;
  },
  "dialog:selectDirectory": async (e, [defaultPath]) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const options = {
      title: "选择默认下载保存文件夹",
      defaultPath: typeof defaultPath === "string" && defaultPath ? defaultPath : undefined,
      properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  },
  "shortcut:register": (_e, [acc]) => registerToggleShortcut(acc as string),
  "shortcut:get": () => getRegisteredShortcut(),
  "diagnostics:system:get": () => getSystemDiagnostics(),
  "diagnostics:exportLogs": () => exportDiagnosticLogs(),
  "app:networkStatus": () => getNetworkStatus(),
} satisfies HandlerGroup;
