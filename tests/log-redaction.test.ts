import { describe, expect, it } from "vite-plus/test";
import { redactLogMessage } from "../src/main/modules/core/log-redaction";
describe("renderer diagnostic redaction", () => {
  it("masks bearer tokens and sensitive query values", () => {
    expect(redactLogMessage("Bearer abcdef https://site.test?a=1&token=xyz")).toBe(
      "Bearer [REDACTED] https://site.test?a=1&token=[REDACTED]",
    );
  });
  it("masks common JSON credential keys without damaging normal messages", () => {
    const text = '{"password":"123","message":"ok"}';
    expect(redactLogMessage(text)).toBe('{"password":"[REDACTED]","message":"ok"}');
    expect(redactLogMessage("Page loaded")).toBe("Page loaded");
  });
});
