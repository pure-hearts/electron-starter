/**
 * @file index.ts
 * @description 开发与调试辅助模块统一出口：
 * 隔离生产代码与本地开发特有的黑魔法/调试逻辑。
 */
import { restoreDevServerUrl } from "./dev-server";
import { setupDevPidLock } from "./pid-lock";

/**
 * 初始化开发环境所需的基础设施（开发服务参数还原、防孤儿进程锁）。
 */
export function setupDevEnvironment(): void {
  restoreDevServerUrl();
  setupDevPidLock();
}

export { restoreDevServerUrl, appendDevServerArg } from "./dev-server";
export { setupDevPidLock } from "./pid-lock";
