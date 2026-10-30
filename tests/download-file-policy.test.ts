import { describe, expect, it, vi } from "vite-plus/test";
import {
  sanitizeFilename,
  planDownloadPath,
  finalizeTempFile,
  cleanupTempFile,
} from "../src/main/modules/download/file-policy";

describe("Download File Policy 安全与落盘策略", () => {
  it("sanitizeFilename 移除非法字符与路径穿越符", () => {
    expect(sanitizeFilename("../../../secret.txt")).toBe("secret.txt");
    expect(sanitizeFilename("foo/bar\\baz.pdf")).toBe("baz.pdf");
    expect(sanitizeFilename("foo*bar?name:1.zip")).toBe("foo_bar_name_1.zip");
    expect(sanitizeFilename("...hidden.png")).toBe("hidden.png");
    expect(sanitizeFilename("")).toBe("download");
  });

  it("planDownloadPath 无同名文件时生成原始路径与 .download 临时文件", () => {
    const mockExists = vi.fn().mockReturnValue(false);
    const plan = planDownloadPath("/downloads", "report.pdf", mockExists);

    expect(plan.filename).toBe("report.pdf");
    expect(plan.finalPath).toBe("/downloads/report.pdf");
    expect(plan.tempPath).toBe("/downloads/report.pdf.download");
  });

  it("planDownloadPath 遇到同名文件时自动追加递增序号避免覆盖", () => {
    const existing = new Set(["/downloads/report.pdf", "/downloads/report (1).pdf"]);
    const mockExists = (p: string) => existing.has(p);

    const plan = planDownloadPath("/downloads", "report.pdf", mockExists);
    expect(plan.filename).toBe("report (2).pdf");
    expect(plan.finalPath).toBe("/downloads/report (2).pdf");
    expect(plan.tempPath).toBe("/downloads/report (2).pdf.download");
  });

  it("finalizeTempFile 原子重命名临时文件为正式文件名", async () => {
    const mockRename = vi.fn().mockResolvedValue(undefined);
    await finalizeTempFile("/downloads/file.download", "/downloads/file", mockRename);
    expect(mockRename).toHaveBeenCalledWith("/downloads/file.download", "/downloads/file");
  });

  it("cleanupTempFile 异步删除临时文件并容忍异常", async () => {
    const mockUnlink = vi.fn().mockRejectedValue(new Error("ENOENT"));
    await expect(cleanupTempFile("/downloads/file.download", mockUnlink)).resolves.toBeUndefined();
    expect(mockUnlink).toHaveBeenCalledWith("/downloads/file.download");
  });
});
