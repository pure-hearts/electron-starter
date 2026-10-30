/**
 * @file timeout.ts
 * @description IPC 调度高阶函数：为任意异步处理函数注入超时熔断守卫与执行性能监控。
 * 遵循无副作用纯函数设计，便于独立测试与函数式组合。
 */

import { log } from "../modules/core/logger";

/** 超时配置字典：长耗时通道单独放宽阈值，其余通道默认 10 秒超时 */
const LONG_RUNNING_CHANNELS = new Set<string>([
  "hot:check",
  "update:check",
  "update:download",
  "download:start",
]);

const DEFAULT_TIMEOUT_MS = 10_000;
const EXTENDED_TIMEOUT_MS = 60_000;
const SLOW_IPC_THRESHOLD_MS = 200;

/**
 * 根据通道名称获取允许的最大执行耗时（毫秒）。
 *
 * @param channel IPC 通道标识符
 * @returns 允许的最大超时毫秒数
 */
export function getChannelTimeout(channel: string): number {
  return LONG_RUNNING_CHANNELS.has(channel) ? EXTENDED_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/**
 * 高阶函数：包装目标异步函数，自动注入超时熔断与慢调用度量。
 *
 * @param fn 需要执行的目标异步函数
 * @param channelName 通道名称（用于日志诊断与差异化超时判断）
 * @param customTimeoutMs 可选的自定义超时时间，若未传入则自动根据通道推断
 * @returns 包装后的 Promise，若超时则抛出 IPC_TIMEOUT 错误
 */
export async function withTimeoutAndMetrics<T>(
  fn: () => Promise<T>,
  channelName: string,
  customTimeoutMs?: number,
): Promise<T> {
  const timeoutMs = customTimeoutMs ?? getChannelTimeout(channelName);
  const start = performance.now();

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`IPC_TIMEOUT: 任务执行超时 (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    const duration = Math.round(performance.now() - start);

    if (duration >= SLOW_IPC_THRESHOLD_MS) {
      log.warn(
        `[Slow IPC] 通道 ${channelName} 执行耗时较长: ${duration}ms (阈值: ${SLOW_IPC_THRESHOLD_MS}ms)`,
      );
    }

    return result;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
