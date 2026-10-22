import { describe, it, expect } from "vite-plus/test";
import { AxiosError, AxiosHeaders, CanceledError } from "axios";
import { normalizeRequestError, RequestError } from "../src/renderer/api/errors";
describe("HTTP client error classification", () => {
  it("preserves cancellation and timeout reasons", () => {
    expect(normalizeRequestError(new CanceledError()).kind).toBe("cancelled");
    expect(normalizeRequestError(new AxiosError("time", "ECONNABORTED")).kind).toBe("timeout");
  });
  it("extracts response codes without exposing arbitrary response bodies", () => {
    const err = new AxiosError("Forbidden", "ERR_BAD_RESPONSE", undefined, undefined, {
      status: 403,
      data: { secret: "hidden" },
      headers: {},
      config: { headers: new AxiosHeaders() },
      statusText: "Forbidden",
    });
    const mapped = normalizeRequestError(err);
    expect(mapped.kind).toBe("http");
    expect(mapped.status).toBe(403);
    expect(mapped.message).not.toContain("hidden");
  });
  it("distinguishes transport errors and unexpected throws", () => {
    expect(normalizeRequestError(new AxiosError("refused", "ERR_NETWORK")).kind).toBe("network");
    expect(normalizeRequestError("unexpected").kind).toBe("unknown");
    const once = new RequestError("network", "failed");
    expect(normalizeRequestError(once)).toBe(once);
  });
});
