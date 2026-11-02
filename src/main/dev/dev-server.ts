/**
 * @file dev-server.ts
 * @description 本地开发调试服务参数管理：
 * 负责解析命令行中的 --dev-server-url 参数并恢复环境变量，
 * 并在子进程重启/热更时保持参数延续。
 */

const DEV_SERVER_ARG_PREFIX = "--dev-server-url=";

/**
 * 从进程启动参数中提取开发服务地址并回填至环境变量 VITE_DEV_SERVER_URL。
 */
export function restoreDevServerUrl(): void {
  const devArg = process.argv.find((arg) => arg.startsWith(DEV_SERVER_ARG_PREFIX));
  if (devArg) {
    process.env.VITE_DEV_SERVER_URL = devArg.slice(DEV_SERVER_ARG_PREFIX.length);
  }
}

/**
 * 当应用在开发模式下需要重启自身（例如退出重启或增量热更）时，
 * 为子进程命令行参数列表追加 --dev-server-url。
 */
export function appendDevServerArg(args: string[]): void {
  const url = process.env.VITE_DEV_SERVER_URL;
  if (url && !args.some((a) => a.startsWith(DEV_SERVER_ARG_PREFIX))) {
    args.push(`${DEV_SERVER_ARG_PREFIX}${url}`);
  }
}
