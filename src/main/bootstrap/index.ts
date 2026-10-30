/**
 * 主进程启动顺序集中编排：
 * 使用 StartupLifecycle 进行事务化启动，若中途失败自动逆序释放已分配资源。
 */
import { createMainWindow, disposeWindows, broadcast } from "../window";
import { registerIPC, unregisterIPC } from "../ipc";
import {
  registerResourceProtocol,
  disposeResourceProtocol,
  processDeepLinkArgs,
} from "../modules/protocol";
import { initCrashRecovery, disposeCrashRecovery } from "../modules/system/crash";
import { initLogger, log } from "../modules/core/logger";
import { initDownloads, disposeDownloads } from "../modules/download";
import { createMenu, destroyMenu } from "../modules/system/menu";
import { createTray, destroyTray } from "../modules/system/tray";
import { initUpdater, disposeUpdater } from "../modules/update/full";
import { recoverPendingUpdate, disposeHotUpdate } from "../modules/update/hot";
import { configureSessionSecurity, disposeSessionSecurity } from "../session-security";
import { registerSmokeChecks } from "./smoke";
import { StartupLifecycle } from "../modules/system/startup-lifecycle";

const lifecycle = new StartupLifecycle((error) => {
  log.error("Bootstrap rollback error", error);
});

export function bootstrapMain(): void {
  lifecycle.start([
    { start: () => initLogger(), stop: () => {} },
    { start: () => recoverPendingUpdate(), stop: () => disposeHotUpdate() },
    { start: () => registerResourceProtocol(), stop: () => disposeResourceProtocol() },
    { start: () => configureSessionSecurity(), stop: () => disposeSessionSecurity() },
    { start: () => registerIPC(), stop: () => unregisterIPC() },
    {
      start: () => initDownloads((state) => broadcast("download:state", state)),
      stop: () => disposeDownloads(),
    },
    { start: () => initUpdater(), stop: () => disposeUpdater() },
    { start: () => initCrashRecovery(), stop: () => disposeCrashRecovery() },
    { start: () => createMenu(), stop: () => destroyMenu() },
    { start: () => createTray(), stop: () => destroyTray() },
    {
      start: () => {
        // 功能处理器均已准备好后，才创建加载 Vue 页面内容的主窗口。
        const main = createMainWindow();
        main.webContents.on("did-fail-load", (_event, code, desc) => {
          log.error("Main window failed to load", code, desc);
        });
        processDeepLinkArgs(process.argv);
        registerSmokeChecks(main);
      },
      stop: () => disposeWindows(),
    },
  ]);
}

/** 退出时释放启动阶段注册的全部主进程资源。 */
export function shutdownMain(): void {
  lifecycle.stop();
}
