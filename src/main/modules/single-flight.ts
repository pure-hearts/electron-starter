/** 并发合并器：同一异步操作进行期间，所有调用者复用同一个 Promise，避免重复下载/检查。 */
/** Share one in-progress asynchronous operation between concurrent callers. */
export function singleFlight<T>(work: () => Promise<T>): () => Promise<T> {
  // active 引用当前正在执行的 Promise；未开始或结束后为 undefined。
  let active: Promise<T> | undefined
  return () => {
    // 已有任务时直接返回同一结果，不再次运行 work。
    if (active) return active
    // Promise.resolve().then(work) 将 work 调用统一为可捕获异常的异步操作。
    const operation = Promise.resolve().then(work)
    active = operation
    // 无论成功失败都清空当前任务；先比较引用防止覆盖后来启动的新任务。
    void operation.finally(() => {
      if (active === operation) active = undefined
    }).catch(() => undefined)
    return operation
  }
}
