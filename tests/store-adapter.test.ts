import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
const fake = vi.hoisted(() => ({ state: {} as Record<string, unknown>, writes: vi.fn() }));
vi.mock("electron-store", () => ({
  default: class {
    get store() {
      return fake.state;
    }
    set store(value: Record<string, unknown>) {
      fake.state = value;
    }
    get(key: string) {
      return fake.state[key];
    }
    set = fake.writes;
    delete = vi.fn();
  },
}));

beforeEach(() => {
  vi.resetModules();
  fake.writes.mockReset();
  fake.state = { theme: "dark", locale: "en-US", closeToTray: false };
});
describe("配置适配器边界", () => {
  it("迁移旧配置并保留合法用户偏好", async () => {
    const { getSetting } = await import("../src/main/modules/store");
    expect(getSetting("theme")).toBe("dark");
    expect(getSetting("closeToTray")).toBe(false);
    expect(fake.state.schemaVersion).toBe(1);
  });
  it("内部调用也拒绝非法值，不能仅依赖IPC校验", async () => {
    const { setSetting } = await import("../src/main/modules/store");
    expect(() => setSetting("theme", "invalid")).toThrow();
    expect(() => setSetting("closeToTray", "false")).toThrow();
    expect(fake.writes).not.toHaveBeenCalled();
  });
});
