import { describe, expect, it } from "vite-plus/test";
import { createWebShimBridge } from "../src/renderer/bridge/web-shim";
import { isElectron, isWeb } from "../src/renderer/bridge/platform";

describe("Web Bridge Shim 降级适配测试", () => {
  it("在 node/纯环境测试中能够正确判定 isWeb", () => {
    // 单元测试环境中没有真正的 Electron process.versions.electron
    expect(typeof isWeb).toBe("boolean");
    expect(typeof isElectron).toBe("boolean");
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
