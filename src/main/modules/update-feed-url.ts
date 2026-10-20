/** Require canonical HTTPS feeds without credentials or fragments. */
export function validateUpdateFeedUrl(input: string): void {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Invalid update feed URL') }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.hash || url.toString() !== input || input.length > 4096) {
    throw new Error('Invalid update feed URL')
  }
}
