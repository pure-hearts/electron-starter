import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { safeExternalUrl, safeLocalPath, validate } from "../src/shared/validation";
import {
  showItemInFolder,
  openPath,
  openExternal,
  trashItem,
} from "../src/main/modules/system/shell-module";
import { shell } from "electron";

vi.mock("electron", () => ({
  shell: {
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
    openExternal: vi.fn(),
    trashItem: vi.fn(),
  },
}));

describe("Shell Security & Validation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("safeExternalUrl Protocol Allowlist", () => {
    it("allows standard web and mail protocols", () => {
      expect(safeExternalUrl("https://github.com/pure-hearts/electron-starter").protocol).toBe(
        "https:",
      );
      expect(safeExternalUrl("http://localhost:5173/test").protocol).toBe("http:");
      expect(safeExternalUrl("mailto:support@example.com").protocol).toBe("mailto:");
    });

    it("rejects dangerous and local file schemes", () => {
      for (const dangerous of [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html,<script>alert(1)</script>",
        "blob:https://example.com/uuid",
        "ftp://mirror.example.com/archive.zip",
      ]) {
        expect(() => safeExternalUrl(dangerous)).toThrow();
      }
    });

    it("rejects null and non-string inputs", () => {
      // @ts-expect-error test invalid types
      expect(() => safeExternalUrl(null)).toThrow();
      // @ts-expect-error test invalid types
      expect(() => safeExternalUrl(undefined)).toThrow();
      expect(() => safeExternalUrl("a".repeat(4097))).toThrow();
    });
  });

  describe("safeLocalPath Validation", () => {
    it("accepts valid POSIX and Windows file paths", () => {
      expect(safeLocalPath("/usr/local/bin/app")).toBe("/usr/local/bin/app");
      expect(safeLocalPath("C:\\Users\\Admin\\AppData")).toBe("C:\\Users\\Admin\\AppData");
      expect(safeLocalPath("  /trimmed/path  ")).toBe("/trimmed/path");
    });

    it("rejects null bytes and empty paths", () => {
      expect(() => safeLocalPath("/path/to\0/file")).toThrow(/Null bytes/);
      expect(() => safeLocalPath("")).toThrow(/Invalid path/);
      expect(() => safeLocalPath("   ")).toThrow(/Invalid path/);
    });
  });

  describe("shell-module invocation defense", () => {
    it("showItemInFolder invokes electron shell and handles exceptions safely", async () => {
      vi.mocked(shell.showItemInFolder).mockReturnValue(undefined);
      const ok = await showItemInFolder("/valid/file.txt");
      expect(ok).toBe(true);
      expect(shell.showItemInFolder).toHaveBeenCalledWith("/valid/file.txt");

      vi.mocked(shell.showItemInFolder).mockImplementationOnce(() => {
        throw new Error("OS file system error");
      });
      const failed = await showItemInFolder("/error/path.txt");
      expect(failed).toBe(false);

      const invalidPath = await showItemInFolder("/null\0byte");
      expect(invalidPath).toBe(false);
    });

    it("openPath forwards path and handles errors", async () => {
      vi.mocked(shell.openPath).mockResolvedValue("");
      const result = await openPath("/valid/doc.pdf");
      expect(result).toBe("");
      expect(shell.openPath).toHaveBeenCalledWith("/valid/doc.pdf");

      const badPath = await openPath("/bad\0path");
      expect(badPath).toContain("Null bytes");
    });

    it("openExternal verifies safe URL and opens safely", async () => {
      vi.mocked(shell.openExternal).mockResolvedValue(undefined);
      const ok = await openExternal("https://electronjs.org");
      expect(ok).toBe(true);
      expect(shell.openExternal).toHaveBeenCalledWith("https://electronjs.org");

      // Dangerous URL must be rejected by safeExternalUrl before calling shell
      await expect(openExternal("javascript:void(0)")).rejects.toThrow();
      expect(shell.openExternal).toHaveBeenCalledTimes(1);
    });

    it("trashItem deletes item safely and catches exceptions", async () => {
      vi.mocked(shell.trashItem).mockResolvedValue(undefined);
      const ok = await trashItem("/path/to/remove.log");
      expect(ok).toBe(true);
      expect(shell.trashItem).toHaveBeenCalledWith("/path/to/remove.log");

      vi.mocked(shell.trashItem).mockRejectedValueOnce(new Error("File busy"));
      const failed = await trashItem("/locked/file");
      expect(failed).toBe(false);
    });
  });

  describe("IPC Validation Channel Integration", () => {
    it("validates shell:* IPC channels properly", () => {
      expect(() => validate("shell:showItemInFolder", ["/home/user/doc.txt"])).not.toThrow();
      expect(() => validate("shell:openPath", ["/home/user/doc.txt"])).not.toThrow();
      expect(() => validate("shell:openExternal", ["https://example.com"])).not.toThrow();
      expect(() => validate("shell:trashItem", ["/home/user/doc.txt"])).not.toThrow();

      expect(() => validate("shell:showItemInFolder", [])).toThrow();
      expect(() => validate("shell:openExternal", ["ftp://evil.com"])).toThrow();
      expect(() => validate("shell:trashItem", ["/null\0byte"])).toThrow();
    });
  });
});
