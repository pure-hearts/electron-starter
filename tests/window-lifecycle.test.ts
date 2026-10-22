import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  settings: new Map<string, unknown>(),
  save: vi.fn(),
  quitting: false,
  error: vi.fn(),
  unready: vi.fn(),
}));
vi.mock("../src/main/modules/store", () => ({
  getSetting: (key: string) => state.settings.get(key),
  setSetting: state.save,
}));
vi.mock("../src/main/modules/protocol", () => ({
  rendererURL: (route: string) => "app://renderer" + route,
  markDeepLinkRendererUnready: state.unready,
}));
vi.mock("../src/main/modules/core/logger", () => ({ log: { error: state.error } }));
vi.mock("../src/main/modules/core/lifecycle", () => ({ isQuitting: () => state.quitting }));
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  class Window extends EventEmitter {
    static all: Window[] = [];
    static getAllWindows() {
      return Window.all.filter((win) => !win.destroyed);
    }
    static fromWebContents(sender: unknown) {
      return Window.all.find((win) => win.webContents === sender);
    }
    id = Window.all.length + 1;
    destroyed = false;
    maximized = false;
    minimized = false;
    bounds = { x: 0, y: 0, width: 1140, height: 760 };
    normal = { x: 30, y: 40, width: 900, height: 650 };
    webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn(),
      isDestroyed: () => this.destroyed,
      send: vi.fn(),
    });
    show = vi.fn();
    focus = vi.fn();
    hide = vi.fn();
    loadURL = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          this.resolveLoad = resolve;
          this.rejectLoad = reject;
        }),
    );
    resolveLoad!: () => void;
    rejectLoad!: (error: Error) => void;
    constructor(public options: Record<string, unknown>) {
      super();
      Window.all.push(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    isMaximized() {
      return this.maximized;
    }
    isMinimized() {
      return this.minimized;
    }
    getBounds() {
      return this.bounds;
    }
    getNormalBounds() {
      return this.maximized || this.minimized ? this.normal : this.bounds;
    }
    setBounds(bounds: typeof this.bounds) {
      this.bounds = bounds;
    }
    maximize() {
      this.maximized = true;
      this.emit("maximize");
    }
    restore() {
      this.minimized = false;
      this.maximized = false;
    }
    destroy() {
      if (!this.destroyed) {
        this.destroyed = true;
        this.emit("closed");
        this.removeAllListeners();
        this.webContents.removeAllListeners();
      }
    }
    close() {
      const event = { preventDefault: vi.fn() };
      this.emit("close", event);
      if (!event.preventDefault.mock.calls.length) this.destroy();
    }
  }
  return {
    BrowserWindow: Window,
    screen: Object.assign(new EventEmitter(), {
      getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
    }),
  };
});
import { BrowserWindow, screen } from "electron";
import { createMainWindow, disposeWindows, getMainWindow, openChild } from "../src/main/window";

type MockWindow = EventEmitter & {
  destroyed: boolean;
  maximized: boolean;
  minimized: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  normal: { x: number; y: number; width: number; height: number };
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  destroy(): void;
  close(): void;
  resolveLoad(): void;
  rejectLoad(error: Error): void;
  webContents: EventEmitter;
};
const asMock = (win: unknown) => win as MockWindow;
beforeEach(() => {
  vi.useFakeTimers();
  state.settings.clear();
  state.save.mockClear();
  state.error.mockClear();
  state.quitting = false;
  delete process.env.VITE_DEV_SERVER_URL;
});
afterEach(() => {
  disposeWindows();
  vi.useRealTimers();
});
describe("WindowManager 生命周期", () => {
  it("复用主窗口，释放全部窗口与屏幕监听器后可重新创建", () => {
    const before = screen.listenerCount("display-removed");
    const main = createMainWindow();
    expect(createMainWindow()).toBe(main);
    openChild("/settings");
    expect(BrowserWindow.getAllWindows()).toHaveLength(3);
    expect(screen.listenerCount("display-removed")).toBe(before + 1);
    disposeWindows();
    disposeWindows();
    expect(BrowserWindow.getAllWindows()).toHaveLength(0);
    expect(getMainWindow()).toBeNull();
    expect(screen.listenerCount("display-removed")).toBe(before);
    expect(createMainWindow()).not.toBe(main);
  });
  it("拖动后最大化的迟到防抖保存常规尺寸，不把最大化矩形写入配置", () => {
    const main = asMock(createMainWindow());
    main.emit("resize");
    main.maximized = true;
    main.bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    vi.advanceTimersByTime(400);
    expect(JSON.parse(state.save.mock.calls.at(-1)![1])).toEqual({
      ...main.normal,
      maximized: true,
    });
  });
  it("恢复最大化状态，屏幕移除后把窗口收回可见工作区", () => {
    state.settings.set(
      "windowBounds",
      JSON.stringify({ x: 20, y: 20, width: 900, height: 650, maximized: true }),
    );
    const main = asMock(createMainWindow());
    expect(main.maximized).toBe(true);
    main.maximized = false;
    main.bounds = { x: 4000, y: 0, width: 900, height: 650 };
    screen.emit("display-removed");
    expect(main.bounds.x).toBeGreaterThanOrEqual(0);
    expect(main.bounds.x + main.bounds.width).toBeLessThanOrEqual(1920);
  });
  it("关闭到托盘保持窗口；正式退出销毁并取消待保存回调", () => {
    state.settings.set("closeToTray", true);
    const main = asMock(createMainWindow());
    main.close();
    expect(main.destroyed).toBe(false);
    expect(main.hide).toHaveBeenCalled();
    main.emit("resize");
    state.quitting = true;
    main.close();
    const saved = state.save.mock.calls.length;
    vi.runAllTimers();
    expect(main.destroyed).toBe(true);
    expect(state.save).toHaveBeenCalledTimes(saved);
  });
  it("旧窗口加载失败不会显示已销毁窗口或关闭新窗口的 Splash", async () => {
    const old = asMock(createMainWindow());
    old.destroy();
    const current = createMainWindow();
    old.rejectLoad(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(old.show).not.toHaveBeenCalled();
    expect(BrowserWindow.getAllWindows()).toHaveLength(2);
    expect(getMainWindow()).toBe(current);
  });
  it("Splash 加载失败受控销毁；子窗口失败关闭并释放引用", async () => {
    createMainWindow();
    const splash = asMock(BrowserWindow.getAllWindows()[1]);
    splash.rejectLoad(new Error("splash failed"));
    openChild("/settings");
    const child = asMock(BrowserWindow.getAllWindows().at(-1));
    child.rejectLoad(new Error("child failed"));
    await Promise.resolve();
    await Promise.resolve();
    expect(splash.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
    expect(BrowserWindow.getAllWindows()).toHaveLength(1);
  });
});
