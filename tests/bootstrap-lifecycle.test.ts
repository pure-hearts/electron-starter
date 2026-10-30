import { describe, expect, it, vi } from "vite-plus/test";
import { StartupLifecycle } from "../src/main/modules/system/startup-lifecycle";

describe("启动事务与资源释放", () => {
  it("重复启动仅初始化一次，按逆序释放且重复释放无副作用", () => {
    const events: string[] = [];
    const lifecycle = new StartupLifecycle(() => {});
    const steps = ["security", "ipc", "window"].map((name) => ({
      start: () => {
        events.push(`start:${name}`);
      },
      stop: () => {
        events.push(`stop:${name}`);
      },
    }));
    lifecycle.start(steps);
    lifecycle.start(steps);
    lifecycle.stop();
    lifecycle.stop();
    expect(events).toEqual([
      "start:security",
      "start:ipc",
      "start:window",
      "stop:window",
      "stop:ipc",
      "stop:security",
    ]);
  });
  it("部分初始化失败时也清理当前步骤，后续步骤不执行并允许完整重试", () => {
    const cleanup = vi.fn();
    const next = vi.fn();
    const lifecycle = new StartupLifecycle(() => {});
    expect(() =>
      lifecycle.start([
        { start: () => {}, stop: cleanup },
        {
          start: () => {
            throw new Error("failed");
          },
          stop: cleanup,
        },
        { start: next, stop: cleanup },
      ]),
    ).toThrow("failed");
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalled();
    lifecycle.start([{ start: next, stop: cleanup }]);
    expect(next).toHaveBeenCalledOnce();
    lifecycle.stop();
  });
  it("清理失败不阻止其他资源释放，且启动期间重入无副作用", () => {
    const report = vi.fn();
    const first = vi.fn();
    const lifecycle = new StartupLifecycle(report);
    lifecycle.start([
      { start: () => lifecycle.start([]), stop: first },
      {
        start: () => {},
        stop: () => {
          throw new Error("cleanup");
        },
      },
    ]);
    lifecycle.stop();
    expect(first).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
  });
});
