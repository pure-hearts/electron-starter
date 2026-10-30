import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  logger: { init: vi.fn(), log: { error: vi.fn() } },
  hotUpdate: { recover: vi.fn(), dispose: vi.fn() },
  protocol: { register: vi.fn(), dispose: vi.fn(), processArgs: vi.fn() },
  security: { configure: vi.fn(), dispose: vi.fn() },
  ipc: { register: vi.fn(), unregister: vi.fn() },
  downloads: { init: vi.fn(), dispose: vi.fn() },
  updater: { init: vi.fn(), dispose: vi.fn() },
  crash: { init: vi.fn(), dispose: vi.fn() },
  menu: { create: vi.fn(), destroy: vi.fn() },
  tray: { create: vi.fn(), destroy: vi.fn() },
  shortcut: { init: vi.fn(), dispose: vi.fn() },
  network: { init: vi.fn(), dispose: vi.fn() },
  window: {
    create: vi.fn(() => ({
      webContents: { on: vi.fn() },
    })),
    dispose: vi.fn(),
    broadcast: vi.fn(),
  },
  smoke: { register: vi.fn() },
}));

vi.mock("../src/main/modules/core/logger", () => ({
  initLogger: mocks.logger.init,
  log: mocks.logger.log,
}));
vi.mock("../src/main/modules/update/hot", () => ({
  recoverPendingUpdate: mocks.hotUpdate.recover,
  disposeHotUpdate: mocks.hotUpdate.dispose,
}));
vi.mock("../src/main/modules/protocol", () => ({
  registerResourceProtocol: mocks.protocol.register,
  disposeResourceProtocol: mocks.protocol.dispose,
  processDeepLinkArgs: mocks.protocol.processArgs,
}));
vi.mock("../src/main/session-security", () => ({
  configureSessionSecurity: mocks.security.configure,
  disposeSessionSecurity: mocks.security.dispose,
}));
vi.mock("../src/main/ipc", () => ({
  registerIPC: mocks.ipc.register,
  unregisterIPC: mocks.ipc.unregister,
}));
vi.mock("../src/main/modules/download", () => ({
  initDownloads: mocks.downloads.init,
  disposeDownloads: mocks.downloads.dispose,
}));
vi.mock("../src/main/modules/update/full", () => ({
  initUpdater: mocks.updater.init,
  disposeUpdater: mocks.updater.dispose,
}));
vi.mock("../src/main/modules/system/crash", () => ({
  initCrashRecovery: mocks.crash.init,
  disposeCrashRecovery: mocks.crash.dispose,
}));
vi.mock("../src/main/modules/system/menu", () => ({
  createMenu: mocks.menu.create,
  destroyMenu: mocks.menu.destroy,
}));
vi.mock("../src/main/modules/system/tray", () => ({
  createTray: mocks.tray.create,
  destroyTray: mocks.tray.destroy,
}));
vi.mock("../src/main/modules/system/shortcut-module", () => ({
  initGlobalShortcuts: mocks.shortcut.init,
  disposeGlobalShortcuts: mocks.shortcut.dispose,
}));
vi.mock("../src/main/modules/system/network-module", () => ({
  initNetworkMonitor: mocks.network.init,
  disposeNetworkMonitor: mocks.network.dispose,
}));
vi.mock("../src/main/window", () => ({
  createMainWindow: mocks.window.create,
  disposeWindows: mocks.window.dispose,
  broadcast: mocks.window.broadcast,
}));
vi.mock("../src/main/bootstrap/smoke", () => ({
  registerSmokeChecks: mocks.smoke.register,
}));

import { bootstrapMain, shutdownMain } from "../src/main/bootstrap";

beforeEach(() => {
  vi.clearAllMocks();
  shutdownMain();
});

describe("主进程启动门面集成测试", () => {
  it("正常启动时按序调用各子系统并注入依赖，关闭时逆序清理", () => {
    bootstrapMain();

    expect(mocks.logger.init).toHaveBeenCalledOnce();
    expect(mocks.hotUpdate.recover).toHaveBeenCalledOnce();
    expect(mocks.protocol.register).toHaveBeenCalledOnce();
    expect(mocks.security.configure).toHaveBeenCalledOnce();
    expect(mocks.ipc.register).toHaveBeenCalledOnce();
    expect(mocks.downloads.init).toHaveBeenCalledOnce();
    expect(mocks.updater.init).toHaveBeenCalledOnce();
    expect(mocks.crash.init).toHaveBeenCalledOnce();
    expect(mocks.menu.create).toHaveBeenCalledOnce();
    expect(mocks.tray.create).toHaveBeenCalledOnce();
    expect(mocks.shortcut.init).toHaveBeenCalledOnce();
    expect(mocks.network.init).toHaveBeenCalledOnce();
    expect(mocks.window.create).toHaveBeenCalledOnce();

    shutdownMain();

    expect(mocks.window.dispose).toHaveBeenCalledOnce();
    expect(mocks.network.dispose).toHaveBeenCalledOnce();
    expect(mocks.shortcut.dispose).toHaveBeenCalledOnce();
    expect(mocks.tray.destroy).toHaveBeenCalledOnce();
    expect(mocks.menu.destroy).toHaveBeenCalledOnce();
    expect(mocks.crash.dispose).toHaveBeenCalledOnce();
    expect(mocks.updater.dispose).toHaveBeenCalledOnce();
    expect(mocks.downloads.dispose).toHaveBeenCalledOnce();
    expect(mocks.ipc.unregister).toHaveBeenCalledOnce();
    expect(mocks.security.dispose).toHaveBeenCalledOnce();
    expect(mocks.protocol.dispose).toHaveBeenCalledOnce();
    expect(mocks.hotUpdate.dispose).toHaveBeenCalledOnce();
  });

  it("下载模块 initDownloads 接收到有效的 broadcast 回调", () => {
    bootstrapMain();
    expect(mocks.downloads.init).toHaveBeenCalledTimes(1);
    const onState = mocks.downloads.init.mock.calls[0][0];
    expect(typeof onState).toBe("function");
    onState({ id: "test", url: "https://example.com", state: "started" });
    expect(mocks.window.broadcast).toHaveBeenCalledWith("download:state", {
      id: "test",
      url: "https://example.com",
      state: "started",
    });
    shutdownMain();
  });
});
