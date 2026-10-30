/** 日志脱敏：尽量替换常见令牌和密码模式，降低诊断日志泄露凭据的风险。 */
/** Redact common credentials before forwarding renderer diagnostics to disk. */
/** 匹配常见 Bearer、URL 查询参数和 JSON 属性中的敏感值。 */
export function redactLogMessage(input: string): string {
  return (
    input
      // 替换 HTTP Authorization: Bearer 中的令牌内容。
      .replace(/\bBearer\s+[\w~+./=-]+/gi, "Bearer [REDACTED]")
      // URL 查询串中的 token/api_key/password/secret 等参数值不落盘。
      .replace(
        /([?&](?:access_token|refresh_token|token|api_key|password|secret)=)[^&\s]+/gi,
        "$1[REDACTED]",
      )
      // 针对常见 JSON 日志中的敏感字段替换字符串值。
      .replace(
        /("(?:password|token|secret|api_key|authorization)"\s*:\s*")[^"]+(")/gi,
        "$1[REDACTED]$2",
      )
  );
}
