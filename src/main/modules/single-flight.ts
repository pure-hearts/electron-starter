/** Share one in-progress asynchronous operation between concurrent callers. */
export function singleFlight<T>(work: () => Promise<T>): () => Promise<T> {
  let active: Promise<T> | undefined
  return () => {
    if (active) return active
    const operation = Promise.resolve().then(work)
    active = operation
    void operation.finally(() => {
      if (active === operation) active = undefined
    }).catch(() => undefined)
    return operation
  }
}
