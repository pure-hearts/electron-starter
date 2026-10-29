import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { normalizeAccentColor, getSystemThemeInfo } from "../src/main/modules/system/theme-module";
import { nativeTheme, systemPreferences } from "electron";

vi.mock("electron", () => ({
  nativeTheme: {
    shouldUseDarkColors: false,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  systemPreferences: {
    getAccentColor: vi.fn(),
  },
}));

vi.mock("../src/main/window/broadcast", () => ({
  broadcast: vi.fn(),
  broadcastToAllWindows: vi.fn(),
}));

describe("Theme System Integration", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  describe("normalizeAccentColor", () => {
    it("normalizes hex colors on darwin and win32", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      expect(normalizeAccentColor("007affff")).toBe("#007AFF");
      expect(normalizeAccentColor("#3b82f6")).toBe("#3B82F6");
      expect(normalizeAccentColor("ff5500")).toBe("#FF5500");

      Object.defineProperty(process, "platform", { value: "win32" });
      expect(normalizeAccentColor("e11d48ff")).toBe("#E11D48");
    });

    it("returns null on non-Win/Mac platforms like Linux", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      expect(normalizeAccentColor("007affff")).toBeNull();
      expect(normalizeAccentColor("#ffffff")).toBeNull();
    });

    it("handles malformed or missing accent colors gracefully", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      expect(normalizeAccentColor("")).toBeNull();
      expect(normalizeAccentColor("123")).toBeNull();
      expect(normalizeAccentColor(null)).toBeNull();
      expect(normalizeAccentColor(undefined)).toBeNull();
    });
  });

  describe("getSystemThemeInfo", () => {
    it("accurately reads dark colors and accent color", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      // @ts-expect-error mock property
      nativeTheme.shouldUseDarkColors = true;
      vi.mocked(systemPreferences.getAccentColor).mockReturnValue("007affff");

      const info = getSystemThemeInfo();
      expect(info.shouldUseDarkColors).toBe(true);
      expect(info.accentColor).toBe("#007AFF");
    });

    it("falls back gracefully when accentColor throws or is unsupported", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      // @ts-expect-error mock property
      nativeTheme.shouldUseDarkColors = false;
      vi.mocked(systemPreferences.getAccentColor).mockImplementationOnce(() => {
        throw new Error("Not supported");
      });

      const info = getSystemThemeInfo();
      expect(info.shouldUseDarkColors).toBe(false);
      expect(info.accentColor).toBeNull();
    });

    it("returns null accentColor on Linux", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      // @ts-expect-error mock property
      nativeTheme.shouldUseDarkColors = true;
      vi.mocked(systemPreferences.getAccentColor).mockReturnValue("007affff");

      const info = getSystemThemeInfo();
      expect(info.shouldUseDarkColors).toBe(true);
      expect(info.accentColor).toBeNull();
    });
  });
});
