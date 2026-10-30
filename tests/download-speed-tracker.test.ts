import { describe, expect, it } from "vite-plus/test";
import { SpeedTracker } from "../src/main/modules/download/speed-tracker";

describe("SpeedTracker 速率与 ETA 估算", () => {
  it("首个采样点返回 0 速度且无 ETA", () => {
    const tracker = new SpeedTracker(0.3, 200);
    const result = tracker.update(100, 1000, 1000);
    expect(result.speed).toBe(0);
    expect(result.eta).toBeUndefined();
  });

  it("短于最小采样间隔时复用上一次平滑速度", () => {
    const tracker = new SpeedTracker(0.3, 200);
    tracker.update(100, 1000, 1000);
    // 第二次采样 500ms 后：deltaBytes=500, elapsed=500ms => 1000 B/s
    const firstUpdate = tracker.update(600, 1000, 1500);
    expect(firstUpdate.speed).toBe(1000);
    expect(firstUpdate.eta).toBe(1); // 400 字节 / 1000 B/s => 0.4s 向上取整 1s

    // 仅间隔 50ms (小于 200ms)
    const quickUpdate = tracker.update(650, 1000, 1550);
    expect(quickUpdate.speed).toBe(1000);
  });

  it("多次采样经过 EMA 平滑计算", () => {
    const tracker = new SpeedTracker(0.5, 200);
    tracker.update(0, 10000, 1000);
    // 第一次计算速度：1000 字节 / 1s = 1000 B/s
    tracker.update(1000, 10000, 2000);
    // 第二次瞬时速度：3000 字节 / 1s = 3000 B/s
    // EMA = 0.5 * 3000 + 0.5 * 1000 = 2000 B/s
    const third = tracker.update(4000, 10000, 3000);
    expect(third.speed).toBe(2000);
    // 剩余 6000 字节 / 2000 B/s = 3s
    expect(third.eta).toBe(3);
  });

  it("重置后恢复初始状态", () => {
    const tracker = new SpeedTracker();
    tracker.update(100, 1000, 1000);
    tracker.update(500, 1000, 2000);
    tracker.reset();
    const result = tracker.update(500, 1000, 3000);
    expect(result.speed).toBe(0);
    expect(result.eta).toBeUndefined();
  });
});
