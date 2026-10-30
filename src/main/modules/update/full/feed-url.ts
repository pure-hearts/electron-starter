/**
 * 校验整包更新服务器的 Feed URL。
 * 要求标准 HTTPS 地址，不接受凭据、片段或非规范化写法。
 * 这只是配置入口校验，不能代替网络层重定向和签名验证。
 */
export function validateUpdateFeedUrl(input: string): void {
  // URL 构造函数负责语法解析；解析失败转为统一、可理解的配置错误。
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid update feed URL");
  }
  // 限制加密传输，确保有 hostname，不能在 URL 中夹带用户名或密码。
  // URL 的 hash 不参与服务器资源请求，拒绝它以避免歧义。
  // toString() 必须与原文一致，避免不同规范化形式指向相同地址。
  // 最大长度限制用于拒绝明显异常的配置输入。
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash ||
    url.toString() !== input ||
    input.length > 4096
  ) {
    throw new Error("Invalid update feed URL");
  }
}
