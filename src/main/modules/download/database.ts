import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DownloadState } from "../../../shared/ipc";
import { log } from "../core/logger";

export interface DownloadDbRecord {
  id: string;
  url: string;
  filename: string;
  save_path: string;
  total_bytes: number;
  received_bytes: number;
  state: string;
  can_resume: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export class DownloadDatabase {
  private db: DatabaseSync | null = null;

  constructor(dbPath: string) {
    try {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(dbPath);
      this.initSchema();
    } catch (error) {
      log.warn(
        "Failed to initialize SQLite download database, falling back to disabled mode",
        error,
      );
      this.db = null;
    }
  }

  private initSchema(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        filename TEXT NOT NULL,
        save_path TEXT NOT NULL,
        total_bytes INTEGER DEFAULT 0,
        received_bytes INTEGER DEFAULT 0,
        state TEXT NOT NULL,
        can_resume INTEGER DEFAULT 0,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_downloads_state ON downloads(state);
    `);
  }

  upsert(state: DownloadState): void {
    if (!this.db) return;
    try {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO downloads (
          id, url, filename, save_path, total_bytes, received_bytes,
          state, can_resume, error_message, created_at, updated_at, completed_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          filename = COALESCE(excluded.filename, downloads.filename),
          save_path = COALESCE(excluded.save_path, downloads.save_path),
          total_bytes = excluded.total_bytes,
          received_bytes = excluded.received_bytes,
          state = excluded.state,
          can_resume = excluded.can_resume,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at,
          completed_at = CASE
            WHEN excluded.state IN ('completed', 'failed', 'cancelled') AND downloads.completed_at IS NULL
            THEN excluded.completed_at
            ELSE downloads.completed_at
          END;
      `);

      const filename = state.filename ?? (state.path ? path.basename(state.path) : "download");
      const savePath = state.path ?? "";
      const totalBytes = state.totalBytes ?? 0;
      const receivedBytes = state.receivedBytes ?? 0;
      const canResume = state.canResume ? 1 : 0;
      const errorMsg = state.error ?? null;
      const completedAt = ["completed", "failed", "cancelled"].includes(state.state) ? now : null;

      stmt.run(
        state.id,
        state.url,
        filename,
        savePath,
        totalBytes,
        receivedBytes,
        state.state,
        canResume,
        errorMsg,
        state.createdAt ?? now,
        now,
        completedAt,
      );
    } catch (error) {
      log.warn("Failed to upsert download record", error);
    }
  }

  getHistory(limit = 100, offset = 0): DownloadState[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM downloads
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(limit, offset) as unknown as DownloadDbRecord[];

      return rows.map((row) => {
        const total = row.total_bytes;
        const received = row.received_bytes;
        const percent =
          total > 0 && received >= 0
            ? Math.max(0, Math.min(100, Math.round((received / total) * 100)))
            : undefined;

        return {
          id: row.id,
          url: row.url,
          filename: row.filename,
          path: row.save_path,
          state: row.state as DownloadState["state"],
          totalBytes: total,
          receivedBytes: received,
          percent,
          canResume: Boolean(row.can_resume),
          error: row.error_message ?? undefined,
          createdAt: row.created_at,
          completedAt: row.completed_at ?? undefined,
          fileExists: undefined,
        };
      });
    } catch (error) {
      log.warn("Failed to query download history", error);
      return [];
    }
  }

  remove(id: string): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare("DELETE FROM downloads WHERE id = ?");
      const result = stmt.run(id);
      return Number(result.changes) > 0;
    } catch (error) {
      log.warn("Failed to remove download record", error);
      return false;
    }
  }

  clearTerminalHistory(): number {
    if (!this.db) return 0;
    try {
      const stmt = this.db.prepare(
        "DELETE FROM downloads WHERE state IN ('completed', 'failed', 'cancelled')",
      );
      const result = stmt.run();
      return Number(result.changes);
    } catch (error) {
      log.warn("Failed to clear terminal download history", error);
      return 0;
    }
  }

  close(): void {
    if (!this.db) return;
    try {
      this.db.close();
    } catch {
      // ignore
    } finally {
      this.db = null;
    }
  }
}
