import fs from "node:fs";
import path from "node:path";

/**
 * 启动新 Electron 前安全清理上次调试遗留的孤儿进程，彻底防止单实例锁死锁。
 * @param rootDir 项目根目录路径（默认使用当前工作目录）
 */
export function cleanupPreviousElectron(rootDir: string = process.cwd()): void {
  const pidFile = path.join(rootDir, ".dev-electron.pid");
  if (!fs.existsSync(pidFile)) return;

  try {
    const stat = fs.statSync(pidFile);
    const isRecent = Date.now() - stat.mtimeMs < 12 * 60 * 60 * 1000; // 仅处理 12 小时内产生的残留，规避长期搁置后的 PID 复用误杀
    if (isRecent) {
      const raw = fs.readFileSync(pidFile, "utf-8").trim();
      const pid = parseInt(raw, 10);
      if (!Number.isNaN(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGTERM");
        } catch {
          // 目标进程已退出或不可达
        }
      }
    }
  } catch {
    // 忽略文件读取异常
  } finally {
    try {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch {
      // 忽略文件清理异常
    }
  }
}
