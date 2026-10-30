import { describe, it, expect } from "vite-plus/test";
import {
  migrateSettings,
  settingsNeedMigration,
  normalizeWindowBounds,
  extractUserSettings,
} from "../src/main/modules/store/schema";

describe("persistent settings migration", () => {
  it("fills defaults for outdated, incomplete settings", () => {
    expect(migrateSettings({ theme: "dark", locale: "en-US" })).toEqual({
      schemaVersion: 2,
      theme: "dark",
      locale: "en-US",
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
    });
  });
  it("replaces invalid and corrupted legacy settings", () => {
    expect(
      migrateSettings({ theme: "neon", locale: 99, closeToTray: "true", windowBounds: "{bad" }),
    ).toEqual({
      schemaVersion: 2,
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
    });
    expect(migrateSettings(null).schemaVersion).toBe(2);
  });
  it("accepts only finite, visible-size window bounds", () => {
    const bounds = JSON.stringify({ x: 20, y: 30, width: 1000, height: 750 });
    expect(normalizeWindowBounds(bounds)).toBe(bounds);
    expect(normalizeWindowBounds(JSON.stringify({ x: 0, y: 0, width: -20, height: 600 }))).toBe("");
    expect(
      normalizeWindowBounds(JSON.stringify({ x: 0, y: 0, width: Infinity, height: 800 })),
    ).toBe("");
  });
  it("does not rewrite normalized settings on each startup", () => {
    const current = migrateSettings({ theme: "system", locale: "en-US", closeToTray: false });
    expect(settingsNeedMigration(current)).toBe(false);
    expect(settingsNeedMigration({ ...current, schemaVersion: 0 })).toBe(true);
  });
  it("extracts UserSettings with strict typing", () => {
    const migrated = migrateSettings({});
    const userSettings = extractUserSettings(migrated);
    expect(userSettings.downloadConcurrency).toBe(10);
    expect(userSettings.closeToTray).toBe(true);
    expect(userSettings.globalShortcutToggle).toBe("CommandOrControl+Shift+X");
  });
});
