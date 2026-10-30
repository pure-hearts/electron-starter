import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DownloadDatabase } from "../../src/main/modules/download/database";

describe("DownloadDatabase 原生 SQLite 下载历史持久化", () => {
  let dbDir: string;
  let dbPath: string;
  let db: DownloadDatabase;

  beforeEach(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-db-test-"));
    dbPath = path.join(dbDir, "downloads.db");
    db = new DownloadDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("支持新增、更新与查询历史记录", () => {
    db.upsert({
      id: "task-1",
      url: "https://example.com/file1.zip",
      filename: "file1.zip",
      path: "/downloads/file1.zip",
      state: "progress",
      receivedBytes: 50,
      totalBytes: 100,
      canResume: true,
      createdAt: 1000,
    });

    let history = db.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("task-1");
    expect(history[0].state).toBe("progress");
    expect(history[0].receivedBytes).toBe(50);
    expect(history[0].canResume).toBe(true);

    // 更新到完成
    db.upsert({
      id: "task-1",
      url: "https://example.com/file1.zip",
      filename: "file1.zip",
      path: "/downloads/file1.zip",
      state: "completed",
      receivedBytes: 100,
      totalBytes: 100,
      canResume: true,
      createdAt: 1000,
    });

    history = db.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].state).toBe("completed");
    expect(history[0].percent).toBe(100);
    expect(history[0].completedAt).toBeGreaterThan(0);
    // 拉取时不提前检查文件存在性，保持延迟按需检测
    expect(history[0].fileExists).toBeUndefined();
  });

  it("支持删除单条记录与清理全部终态历史", () => {
    db.upsert({
      id: "task-1",
      url: "https://example.com/1",
      state: "completed",
      createdAt: 1000,
    });
    db.upsert({
      id: "task-2",
      url: "https://example.com/2",
      state: "failed",
      createdAt: 2000,
    });
    db.upsert({
      id: "task-3",
      url: "https://example.com/3",
      state: "progress",
      createdAt: 3000,
    });

    expect(db.getHistory()).toHaveLength(3);

    // 删除单条
    expect(db.remove("task-1")).toBe(true);
    expect(db.getHistory()).toHaveLength(2);

    // 清理终态（task-2 是 failed 会被清理，task-3 是 progress 保留）
    const cleared = db.clearTerminalHistory();
    expect(cleared).toBe(1);

    const remaining = db.getHistory();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("task-3");
  });
});
