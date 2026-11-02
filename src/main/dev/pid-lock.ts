/**
 * @file pid-lock.ts
 * @description 开发环境孤儿进程锁治理：
 * 记录当前调试实例 PID 至 .dev-electron.pid 文件，并在应用退出时清理。
 * 供下次调试启动时自愈排查，防止出现僵尸 Electron 进程抢占单实例锁。
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const PID_FILE = path.join(process.cwd(), ".dev-electron.pid");

/**
 * 注册开发环境 PID 锁文件及退出清理钩子。
 * 仅在开发模式 (app.isPackaged === false) 下生效。
 */
export function setupDevPidLock(): void {
  if (app.isPackaged) return;

  try {
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {
    // 忽略工作区文件系统权限异常
  }

  const cleanPid = () => {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {
      // 退出阶段忽略清理异常
    }
  };

  app.on("will-quit", cleanPid);
  process.on("exit", cleanPid);
}
