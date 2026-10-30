import { describe, expect, it } from "vite-plus/test";
import { getChannelTimeout, withTimeoutAndMetrics } from "../src/main/ipc/timeout";

describe("IPC timeout guard and latency profiling", () => {
  it("assigns appropriate timeouts according to channel characteristics", () => {
    expect(getChannelTimeout("app:version")).toBe(10_000);
    expect(getChannelTimeout("hot:check")).toBe(60_000);
    expect(getChannelTimeout("update:download")).toBe(60_000);
  });

  it("resolves promptly when task completes before timeout", async () => {
    const result = await withTimeoutAndMetrics(async () => 42, "test:fast", 500);
    expect(result).toBe(42);
  });

  it("aborts and throws IPC_TIMEOUT when task execution exceeds threshold", async () => {
    const hangingTask = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve("late"), 200));

    await expect(withTimeoutAndMetrics(hangingTask, "test:hanging", 50)).rejects.toThrow(
      "IPC_TIMEOUT: 任务执行超时",
    );
  });
});
