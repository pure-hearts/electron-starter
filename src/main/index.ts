/**
 * Electron 主进程入口：先隔离测试用户数据，再获取单实例锁。
 * 只有获得锁的实例才能注册系统事件和启动桌面模块。
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerDeepLink } from "./modules/protocol/deep-link";
import { log } from "./modules/core/logger";
import { bootstrapMain } from "./bootstrap";
import { registerAppLifecycle } from "./bootstrap/lifecycle";

// 自动化测试使用隔离目录，避免 Smoke 测试覆盖用户真实配置。
if (process.env.ELECTRON_STARTER_TEST_USERDATA) {
  fs.mkdirSync(process.env.ELECTRON_STARTER_TEST_USERDATA, { recursive: true });
  app.setPath("userData", process.env.ELECTRON_STARTER_TEST_USERDATA);
}

// 开发环境下若重启子进程，通过命令行参数恢复 dev-server 地址
const devArg = process.argv.find((arg) => arg.startsWith("--dev-server-url="));
if (devArg) {
  process.env.VITE_DEV_SERVER_URL = devArg.slice("--dev-server-url=".length);
}

// 第二实例无需再次注册 IPC、托盘等系统资源。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // 开发模式下记录 PID 锁文件，供下一次启动时安全自愈并防止孤儿进程
  if (!app.isPackaged) {
    const pidFile = path.join(process.cwd(), ".dev-electron.pid");
    try {
      fs.writeFileSync(pidFile, String(process.pid));
    } catch {}
    const cleanPid = () => {
      try {
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      } catch {}
    };
    app.on("will-quit", cleanPid);
    process.on("exit", cleanPid);
  }

  // Windows 原生通知依赖固定的 AppUserModelId，未设置会被系统静默丢弃。
  if (process.platform === "win32") {
    app.setAppUserModelId(process.env.APP_USER_MODEL_ID || "com.electron.starter");
  }

  // 先注册唤醒和退出事件，再启动 Electron 模块。
  registerAppLifecycle();
  registerDeepLink();
  app
    .whenReady()
    .then(bootstrapMain)
    .catch((err) => {
      log.error("Startup failure", err);
      app.quit();
    });
}
