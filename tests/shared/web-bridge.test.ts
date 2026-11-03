import { describe, expect, it, vi } from "vite-plus/test";
import type { DirectiveBinding } from "vue";
import type { DesktopBridge } from "../../src/shared/ipc";
import { getBridge, initBridge } from "../../src/renderer/bridge";
import { isElectron, isWeb } from "../../src/renderer/bridge/platform";
import { vDisabledElectron, vIfElectron, vIfWeb } from "../../src/renderer/directives/electron";

function createMockElement() {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const listeners = new Map<string, Array<(e: unknown) => void>>();
  return {
    style: { display: "", pointerEvents: "", cursor: "", opacity: "" },
    setAttribute(k: string, v: string) {
      attrs.set(k, v);
    },
    getAttribute(k: string) {
      return attrs.get(k) ?? null;
    },
    classList: {
      add(c: string) {
        classes.add(c);
      },
      contains(c: string) {
        return classes.has(c);
      },
    },
    addEventListener(type: string, cb: (e: unknown) => void) {
      const list = listeners.get(type) ?? [];
      list.push(cb);
      listeners.set(type, list);
    },
  } as unknown as HTMLElement;
}

describe("Desktop Bridge 与跨端指令测试", () => {
  it("在 node/纯环境测试中能够正确判定 isWeb 与 isElectron 互斥", () => {
    expect(typeof isWeb).toBe("boolean");
    expect(typeof isElectron).toBe("boolean");
    expect(isWeb).toBe(!isElectron);
  });

  it("跨端指令 v-if-electron / v-if-web / v-disabled-electron 在 Web 环境下行为符合预期", () => {
    const elElectron = createMockElement();
    const elWeb = createMockElement();
    const elDisabled = createMockElement();

    vIfElectron.mounted(elElectron);
    vIfWeb.mounted(elWeb);
    vDisabledElectron.mounted(elDisabled, { value: "仅桌面可用" } as DirectiveBinding<
      string | undefined
    >);

    if (isWeb) {
      expect(elElectron.style.display).toBe("none");
      expect(elWeb.style.display).toBe("");
      expect(elDisabled.getAttribute("disabled")).toBe("true");
      expect(elDisabled.getAttribute("title")).toBe("仅桌面可用");
    } else {
      expect(elElectron.style.display).toBe("");
      expect(elWeb.style.display).toBe("none");
    }
  });

  it("未注入原生 Bridge 时调用 invoke 触发明确防御性拒绝", async () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    try {
      delete (globalThis as unknown as { window?: unknown }).window;
      const bridge = initBridge();
      await expect(bridge.invoke("app:version")).rejects.toThrow(
        /当前环境未检测到 Electron 原生桥接对象/,
      );
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
    }
  });

  it("未注入原生 Bridge 时订阅事件返回安全 no-op 函数而不崩溃", () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    try {
      delete (globalThis as unknown as { window?: unknown }).window;
      const bridge = initBridge();
      const unsub = bridge.on("update:state", () => {});
      expect(typeof unsub).toBe("function");
      expect(() => unsub()).not.toThrow();
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
    }
  });

  it("当注入原生 Bridge 时能正常代理 invoke 与 on", async () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    const mockInvoke = vi.fn().mockResolvedValue("0.1.4");
    const mockUnsub = vi.fn();
    const mockOn = vi.fn().mockReturnValue(mockUnsub);

    const mockBridge: DesktopBridge = {
      invoke: mockInvoke,
      on: mockOn,
    };

    try {
      (globalThis as unknown as { window?: { $ipcBridge?: DesktopBridge } }).window = {
        $ipcBridge: mockBridge,
      };
      const bridge = initBridge();

      const version = await bridge.invoke("app:version");
      expect(version).toBe("0.1.4");
      expect(mockInvoke).toHaveBeenCalledWith("app:version");

      const callback = vi.fn();
      const unsub = bridge.on("update:state", callback);
      expect(mockOn).toHaveBeenCalledWith("update:state", callback);
      unsub();
      expect(mockUnsub).toHaveBeenCalled();
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      } else {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    }
  });

  it("getBridge 能够感知 window.$ipcBridge 的后置挂载并动态升级", async () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    try {
      (globalThis as unknown as { window?: { $ipcBridge?: DesktopBridge } }).window = {};
      const fallbackBridge = initBridge();
      await expect(fallbackBridge.invoke("app:version")).rejects.toThrow(
        /当前环境未检测到 Electron 原生桥接对象/,
      );

      // 后置注入 window.$ipcBridge
      const mockInvoke = vi.fn().mockResolvedValue("0.1.4");
      (globalThis as unknown as { window: { $ipcBridge: DesktopBridge } }).window.$ipcBridge = {
        invoke: mockInvoke,
        on: vi.fn(),
      };

      // getBridge 应当自动升级为可用 bridge
      const active = getBridge();
      const version = await active.invoke("app:version");
      expect(version).toBe("0.1.4");
      expect(mockInvoke).toHaveBeenCalledWith("app:version");
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      } else {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    }
  });
});
