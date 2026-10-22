import { describe, expect, it } from "vite-plus/test";
import { safeUrl } from "../src/shared/validation";

describe("network URL safety regression", () => {
  it("rejects internal endpoints", () => {
    for (const url of [
      "https://localhost/",
      "https://127.0.0.1/",
      "https://192.168.1.1/",
      "https://10.0.0.1/",
      "https://169.254.1.1/",
    ]) {
      expect(() => safeUrl(url)).toThrow();
    }
  });
  it("rejects embedded credentials", () => {
    expect(() => safeUrl("https://alice:secret@example.com/file")).toThrow();
  });
});
