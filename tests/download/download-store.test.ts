import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import {
  useDownloadStore,
  formatBytes,
  formatSpeed,
  formatEta,
} from "../../src/renderer/stores/download";
import { initBridge } from "../../src/renderer/bridge";
import type { DesktopBridge, DownloadState } from "../../src/shared/ipc";

describe("useDownloadStore & 格式化工具函数", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    if (typeof (globalThis as any).window === "undefined") {
      (globalThis as any).window = {};
    }
  });

  describe("格式化工具", () => {
    it("formatBytes 正确格式化字节大小", () => {
      expect(formatBytes(undefined)).toBe("--");
      expect(formatBytes(-10)).toBe("--");
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
      expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2.0 GB");
    });

    it("formatSpeed 正确格式化每秒传输速率", () => {
      expect(formatSpeed(undefined)).toBe("0 B/s");
      expect(formatSpeed(0)).toBe("0 B/s");
      expect(formatSpeed(1024 * 500)).toBe("500.0 KB/s");
      expect(formatSpeed(1024 * 1024 * 3.2)).toBe("3.2 MB/s");
    });

    it("formatEta 格式化剩余秒数", () => {
      expect(formatEta(undefined)).toBe("--");
      expect(formatEta(0)).toBe("--");
      expect(formatEta(45)).toBe("45秒");
      expect(formatEta(125)).toBe("2分5秒");
      expect(formatEta(3600)).toBe("1时");
      expect(formatEta(3665)).toBe("1时1分");
    });
  });

  describe("Store 响应式与状态行为", () => {
    it("状态更新正确区分活跃任务与历史记录", async () => {
      const mockListeners = new Map<string, (payload: any) => void>();
      const mockBridge: DesktopBridge = {
        invoke: vi.fn().mockImplementation((channel: string) => {
          if (channel === "download:concurrency:get") return Promise.resolve(8);
          if (channel === "download:history:get") return Promise.resolve([]);
          if (channel === "download:start") return Promise.resolve("task-123");
          return Promise.resolve(undefined);
        }),
        on: vi.fn().mockImplementation((event: string, cb: (payload: any) => void) => {
          mockListeners.set(event, cb);
          return () => mockListeners.delete(event);
        }),
      };
      (window as any).$ipcBridge = mockBridge;
      initBridge();

      const store = useDownloadStore();
      await store.init();

      expect(store.concurrency).toBe(8);

      // 1. 发起下载任务
      const id = await store.start("https://example.com/archive.zip");
      expect(id).toBe("task-123");
      expect(store.activeCount).toBe(1);

      // 2. 模拟主进程推送 progress 状态
      const progressPayload: DownloadState = {
        id: "task-123",
        url: "https://example.com/archive.zip",
        filename: "archive.zip",
        state: "progress",
        receivedBytes: 5000,
        totalBytes: 10000,
        speed: 2500,
        eta: 2,
        percent: 50,
      };
      mockListeners.get("download:state")?.(progressPayload);

      expect(store.activeCount).toBe(1);
      expect(store.totalSpeed).toBe(2500);
      expect(store.activeList[0].percent).toBe(50);
      expect(store.historyTasks).toHaveLength(0);

      // 3. 模拟完成状态推送 -> 应从活跃队列移出，进入历史记录
      const completedPayload: DownloadState = {
        id: "task-123",
        url: "https://example.com/archive.zip",
        filename: "archive.zip",
        state: "completed",
        path: "/downloads/archive.zip",
        receivedBytes: 10000,
        totalBytes: 10000,
        percent: 100,
      };
      mockListeners.get("download:state")?.(completedPayload);

      expect(store.activeCount).toBe(0);
      expect(store.totalSpeed).toBe(0);
      expect(store.historyTasks).toHaveLength(1);
      expect(store.historyTasks[0].state).toBe("completed");
    });

    it("toggleDrawer 开关抽屉状态", () => {
      const store = useDownloadStore();
      expect(store.drawerVisible).toBe(false);
      store.toggleDrawer();
      expect(store.drawerVisible).toBe(true);
      store.toggleDrawer(false);
      expect(store.drawerVisible).toBe(false);
    });

    it("openFile 按需检测文件是否存在并标记状态", async () => {
      const mockBridge: DesktopBridge = {
        invoke: vi.fn().mockImplementation((channel: string, arg1?: string) => {
          if (channel === "download:file:exists") {
            return Promise.resolve(arg1 === "/valid/path.zip");
          }
          if (channel === "shell:openPath") {
            return Promise.resolve("");
          }
          return Promise.resolve(undefined);
        }),
        on: vi.fn().mockReturnValue(() => {}),
      };
      (window as any).$ipcBridge = mockBridge;
      initBridge();

      const store = useDownloadStore();
      store.historyTasks = [
        {
          id: "task-valid",
          url: "https://example.com/1",
          state: "completed",
          path: "/valid/path.zip",
        },
        {
          id: "task-missing",
          url: "https://example.com/2",
          state: "completed",
          path: "/missing/deleted.zip",
        },
      ];

      // 1. 打开存在的文件
      const ok = await store.openFile("task-valid", "/valid/path.zip");
      expect(ok).toBe(true);
      expect(store.historyTasks[0].fileExists).toBe(true);
      expect(mockBridge.invoke).toHaveBeenCalledWith("shell:openPath", "/valid/path.zip");

      // 2. 打开已不存在的文件
      const failed = await store.openFile("task-missing", "/missing/deleted.zip");
      expect(failed).toBe(false);
      expect(store.historyTasks[1].fileExists).toBe(false);
    });

    it("removeHistory 与 clearCompleted 正确更新历史列表", async () => {
      const mockBridge: DesktopBridge = {
        invoke: vi.fn().mockImplementation((channel: string, arg1?: string) => {
          if (channel === "download:history:remove") {
            return Promise.resolve(arg1 === "task-1");
          }
          if (channel === "download:history:clear") {
            return Promise.resolve(1);
          }
          if (channel === "shell:showItemInFolder") {
            return Promise.resolve(true);
          }
          return Promise.resolve(undefined);
        }),
        on: vi.fn().mockReturnValue(() => {}),
      };
      (window as any).$ipcBridge = mockBridge;
      initBridge();

      const store = useDownloadStore();
      store.historyTasks = [
        { id: "task-1", url: "https://example.com/1", state: "completed", path: "/path/1.zip" },
        { id: "task-2", url: "https://example.com/2", state: "failed" },
      ];

      // 测试 showInFolder
      const showed = await store.showInFolder("/path/1.zip");
      expect(showed).toBe(true);
      expect(mockBridge.invoke).toHaveBeenCalledWith("shell:showItemInFolder", "/path/1.zip");

      // 删除单条记录
      const removed = await store.removeHistory("task-1");
      expect(removed).toBe(true);
      expect(store.historyTasks).toHaveLength(1);
      expect(store.historyTasks[0].id).toBe("task-2");

      // 清空记录
      await store.clearCompleted();
      expect(store.historyTasks).toHaveLength(0);
    });
  });
});
