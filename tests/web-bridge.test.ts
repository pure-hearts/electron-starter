import { describe, expect, it } from "vite-plus/test";
import type { DirectiveBinding } from "vue";
import { createWebShimBridge } from "../src/renderer/bridge/web-shim";
import { isElectron, isWeb } from "../src/renderer/bridge/platform";
import { vDisabledElectron, vIfElectron, vIfWeb } from "../src/renderer/directives/electron";

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

describe("Web Bridge Shim 降级适配与跨端指令测试", () => {
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

  it("支持 store 命名空间本地存储与数据恢复", async () => {
    const bridge = createWebShimBridge();
    expect(bridge.__isWebShim).toBe(true);

    // 存储主题设置
    await bridge.invoke("store:set", "theme", "dark");
    const theme = await bridge.invoke("store:get", "theme");
    expect(theme).toBe("dark");

    // 删除存储设置
    await bridge.invoke("store:delete", "theme");
    const emptyTheme = await bridge.invoke("store:get", "theme");
    expect(emptyTheme).toBeNull();
  });

  it("app:version 返回合法的 Web 标记版本", async () => {
    const bridge = createWebShimBridge();
    const ver = await bridge.invoke("app:version");
    expect(ver).toContain("Web");
  });

  it("事件总线能够正常订阅并接收模拟事件", async () => {
    const bridge = createWebShimBridge();
    let receivedPayload: unknown = null;

    const unsub = bridge.on("update:state", (payload: unknown) => {
      receivedPayload = payload;
    });

    await bridge.invoke("updater:check");
    expect(receivedPayload).toEqual({ kind: "full", status: "up-to-date" });

    unsub();
  });
});
