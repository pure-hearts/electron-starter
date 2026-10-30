import { describe, expect, it } from "vite-plus/test";
import { createPlatformInfo, parseMacVersion, parseWindowsVersion } from "../src/shared/platform";

describe("Shared Platform Detection & Parsing", () => {
  describe("parseWindowsVersion", () => {
    it("correctly identifies Windows 7", () => {
      const info = parseWindowsVersion("6.1.7601");
      expect(info.major).toBe(6);
      expect(info.minor).toBe(1);
      expect(info.build).toBe(7601);
      expect(info.isWin7OrLower).toBe(true);
      expect(info.isWin8).toBe(false);
      expect(info.isWin10).toBe(false);
      expect(info.isWin11OrGreater).toBe(false);
    });

    it("correctly identifies Windows 8.1", () => {
      const info = parseWindowsVersion("6.3.9600");
      expect(info.major).toBe(6);
      expect(info.minor).toBe(3);
      expect(info.isWin7OrLower).toBe(false);
      expect(info.isWin8).toBe(true);
      expect(info.isWin10).toBe(false);
      expect(info.isWin11OrGreater).toBe(false);
    });

    it("correctly identifies Windows 10", () => {
      const info = parseWindowsVersion("10.0.19045");
      expect(info.major).toBe(10);
      expect(info.build).toBe(19045);
      expect(info.isWin7OrLower).toBe(false);
      expect(info.isWin8).toBe(false);
      expect(info.isWin10).toBe(true);
      expect(info.isWin11OrGreater).toBe(false);
    });

    it("correctly identifies Windows 11 (build >= 22000)", () => {
      const info = parseWindowsVersion("10.0.22631");
      expect(info.major).toBe(10);
      expect(info.build).toBe(22631);
      expect(info.isWin7OrLower).toBe(false);
      expect(info.isWin8).toBe(false);
      expect(info.isWin10).toBe(false);
      expect(info.isWin11OrGreater).toBe(true);
    });
  });

  describe("parseMacVersion", () => {
    it("correctly parses Darwin 20.x as macOS 11 Big Sur", () => {
      const info = parseMacVersion("20.6.0");
      expect(info.darwinMajor).toBe(20);
      expect(info.macosMajor).toBe(11);
      expect(info.isBigSurOrGreater).toBe(true);
      expect(info.isVenturaOrGreater).toBe(false);
      expect(info.isSonomaOrGreater).toBe(false);
    });

    it("correctly parses Darwin 22.x as macOS 13 Ventura", () => {
      const info = parseMacVersion("22.3.0");
      expect(info.darwinMajor).toBe(22);
      expect(info.macosMajor).toBe(13);
      expect(info.isBigSurOrGreater).toBe(true);
      expect(info.isVenturaOrGreater).toBe(true);
      expect(info.isSonomaOrGreater).toBe(false);
    });

    it("correctly parses Darwin 24.x as macOS 15 Sequoia", () => {
      const info = parseMacVersion("24.1.0");
      expect(info.darwinMajor).toBe(24);
      expect(info.macosMajor).toBe(15);
      expect(info.isBigSurOrGreater).toBe(true);
      expect(info.isVenturaOrGreater).toBe(true);
      expect(info.isSonomaOrGreater).toBe(true);
    });
  });

  describe("createPlatformInfo", () => {
    it("creates complete info for Windows 11 under Electron", () => {
      const p = createPlatformInfo("win32", "10.0.22621", true);
      expect(p.isElectron).toBe(true);
      expect(p.isWeb).toBe(false);
      expect(p.isWindows).toBe(true);
      expect(p.isMac).toBe(false);
      expect(p.isLinux).toBe(false);
      expect(p.windows?.isWin11OrGreater).toBe(true);
      expect(p.mac).toBeNull();
    });

    it("creates complete info for Linux under Web browser", () => {
      const p = createPlatformInfo("linux", "", false);
      expect(p.isElectron).toBe(false);
      expect(p.isWeb).toBe(true);
      expect(p.isLinux).toBe(true);
      expect(p.isWindows).toBe(false);
      expect(p.isMac).toBe(false);
      expect(p.windows).toBeNull();
      expect(p.mac).toBeNull();
    });

    it("creates complete info for macOS Darwin under Electron", () => {
      const p = createPlatformInfo("darwin", "23.5.0", true);
      expect(p.isElectron).toBe(true);
      expect(p.isMac).toBe(true);
      expect(p.mac?.isSonomaOrGreater).toBe(true);
      expect(p.windows).toBeNull();
    });
  });
});
