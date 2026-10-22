import { describe, expect, it } from "vite-plus/test";
import { DownloadTerminalRegistry } from "../src/main/modules/download/terminal";

describe("下载终态去重器", () => {
  it("同一任务只允许一次终态，不同任务相互独立", () => {
    const registry = new DownloadTerminalRegistry();
    expect(registry.finish("download-1")).toBe(true);
    expect(registry.finish("download-1")).toBe(false);
    expect(registry.has("download-1")).toBe(true);
    expect(registry.finish("download-2")).toBe(true);
  });
  it("有界缓存不会无限增长，淘汰后仍允许新业务 ID", () => {
    const registry = new DownloadTerminalRegistry(2);
    expect(registry.finish("a")).toBe(true);
    expect(registry.finish("b")).toBe(true);
    expect(registry.finish("c")).toBe(true);
    expect(registry.has("a")).toBe(false);
    expect(registry.has("b")).toBe(true);
    expect(registry.finish("c")).toBe(false);
  });
});
