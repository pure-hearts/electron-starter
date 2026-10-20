/** Redact common credentials before forwarding renderer diagnostics to disk. */
export function redactLogMessage(input: string): string {
  return input
    .replace(/\bBearer\s+[\w~+./=-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:access_token|refresh_token|token|api_key|password|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/("(?:password|token|secret|api_key|authorization)"\s*:\s*")[^"]+(")/gi, '$1[REDACTED]$2')
}
