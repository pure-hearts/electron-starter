import { describe, it, expect } from "vite-plus/test";
import { safeUrl, validate, allowedChannels, allowedEvents } from "../../src/shared/validation";

describe("IPC and Event whitelist validation", () => {
  it("allows all channels present in allowedChannels regardless of arguments", () => {
    // 只要通道在 allowedChannels 白名单中即可放行，不校验具体参数
    expect(() => validate("store:set", ["locale", "en-US"])).not.toThrow();
    expect(() => validate("store:set", ["closeToTray", "any-arbitrary-string"])).not.toThrow();
    expect(() => validate("store:set")).not.toThrow();
    expect(() => validate("store:get", ["arbitraryKey"])).not.toThrow();
    expect(() => validate("window:action", ["minimize"])).not.toThrow();
    expect(() => validate("window:action", ["arbitrary-action"])).not.toThrow();
    expect(() => validate("window:open", ["/any-path"])).not.toThrow();
    expect(() => validate("app:restart", ["--extra", "--flags"])).not.toThrow();
    expect(() => validate("download:start", ["ftp://custom-proto"])).not.toThrow();
    expect(() => validate("download:retry", [])).not.toThrow();
    expect(() => validate("download:history:get", [-1, 99999])).not.toThrow();
    expect(() => validate("download:file:exists", [])).not.toThrow();
    expect(() => validate("notification:send", [{ arbitrary: "payload" }])).not.toThrow();
    expect(() => validate("log:write", ["custom-level", "msg"])).not.toThrow();
  });

  it("allows all events present in allowedEvents regardless of arguments", () => {
    expect(() => validate("download:state")).not.toThrow();
    expect(() => validate("update:state", [{ percent: 50 }])).not.toThrow();
    expect(() => validate("theme:system:changed")).not.toThrow();
    expect(() => validate("settings:changed")).not.toThrow();
    expect(() => validate("network:change")).not.toThrow();
  });

  it("rejects unregistered channels and events", () => {
    expect(() => validate("unregistered:channel" as any)).toThrow();
    expect(() => validate("arbitrary:event" as any)).toThrow();
    expect(() => validate("eval" as any, ["code"])).toThrow();
    expect(() => validate("" as any)).toThrow();
  });

  it("exports correct whitelists for preload and main processes", () => {
    expect(allowedChannels.has("store:set")).toBe(true);
    expect(allowedChannels.has("app:version")).toBe(true);
    expect(allowedEvents.has("download:state")).toBe(true);
    expect(allowedEvents.has("update:state")).toBe(true);
    expect(allowedEvents.has("arbitrary:event" as any)).toBe(false);
  });
});

describe("safeUrl utility security boundaries", () => {
  it("accepts HTTPS and refuses local files or plain HTTP", () => {
    expect(safeUrl("https://example.com/test").hostname).toBe("example.com");
    expect(() => safeUrl("file:///etc/passwd")).toThrow();
    expect(() => safeUrl("http://127.0.0.1/private")).toThrow();
  });

  it("rejects local private-network download URLs and embedded passwords", () => {
    for (const bad of [
      "https://localhost/file",
      "https://127.0.0.1/file",
      "https://192.168.1.1/file",
      "https://10.1.1.2/file",
      "https://user:pass@example.com/file",
    ]) {
      expect(() => safeUrl(bad)).toThrow();
    }
  });

  it("rejects local IPv6 endpoints and mapped IPv4", () => {
    for (const target of [
      "https://[::1]/",
      "https://[fd00::1]/",
      "https://[::ffff:127.0.0.1]/",
      "https://printer.local/",
    ]) {
      expect(() => safeUrl(target)).toThrow();
    }
  });
});
