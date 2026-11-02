/**
 * @file index.ts
 * @description Electron 主进程顶层入口：
 * 负责单实例互斥锁判定、开发环境初始化、应用生命周期与核心模块引导。
 */
import { app } from "electron";
import { registerDeepLink } from "./modules/protocol/deep-link";
import { log } from "./modules/core/logger";
import { bootstrapMain } from "./bootstrap";
import { registerAppLifecycle } from "./bootstrap/lifecycle";
import { setupDevEnvironment } from "./dev";

// 初始化开发环境所需辅助支持（仅在未打包开发阶段生效）
setupDevEnvironment();

// 获取单实例锁：多开时自动终止次要实例，由已运行主实例聚焦并响应事件
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Windows 原生通知依赖固定的 AppUserModelId，未设置会被系统静默丢弃
  if (process.platform === "win32") {
    app.setAppUserModelId(process.env.APP_USER_MODEL_ID || "com.electron.starter");
  }

  // 先注册生命周期监听与系统协议唤起，再进行主流程事务化启动
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
