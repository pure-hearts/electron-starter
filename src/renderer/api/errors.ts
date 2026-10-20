import axios from 'axios'
export type RequestFailureKind = 'cancelled' | 'timeout' | 'http' | 'network' | 'unknown'
export class RequestError extends Error {
  constructor(
    public readonly kind: RequestFailureKind,
    message: string,
    public readonly status?: number,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'RequestError'
  }
}
export function normalizeRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) return error
  if (axios.isCancel(error)) return new RequestError('cancelled', 'Request was cancelled', undefined, { cause: error })
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new RequestError('timeout', 'Request timed out', undefined, { cause: error })
    }
    if (error.response) {
      return new RequestError('http', 'HTTP ' + error.response.status, error.response.status, { cause: error })
    }
    return new RequestError('network', 'Network request failed', undefined, { cause: error })
  }
  return new RequestError('unknown', error instanceof Error ? error.message : 'Unexpected request failure', undefined, { cause: error })
}
