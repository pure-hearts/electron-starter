/** 不依赖 Electron 的启动事务：明确每一步资源的所有权和逆序释放规则。 */
export interface StartupStep {
  start: () => void;
  // stop 必须能处理 start 只完成一半的情况，并可安全重复调用。
  stop: () => void;
}

export class StartupLifecycle {
  private state: "idle" | "starting" | "running" | "stopping" = "idle";
  private steps: readonly StartupStep[] = [];
  constructor(private readonly report: (error: unknown) => void) {}

  start(steps: readonly StartupStep[]): void {
    if (this.state !== "idle") return;
    this.state = "starting";
    try {
      for (const step of steps) {
        // 先记录清理方法：初始化抛错前也可能已分配一部分原生资源。
        this.steps = [...this.steps, step];
        step.start();
      }
      this.state = "running";
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    if (this.state === "idle" || this.state === "stopping") return;
    this.state = "stopping";
    const owned = this.steps;
    this.steps = [];
    for (const step of [...owned].reverse()) {
      try {
        step.stop();
      }
      // 一个模块清理失败不能妨碍下载、IPC 等其他模块撤销权限和资源。
      catch (error) {
        this.report(error);
      }
    }
    this.state = "idle";
  }
}
