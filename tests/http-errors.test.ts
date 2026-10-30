import { describe, it, expect } from "vite-plus/test";
import { AxiosError, AxiosHeaders, CanceledError } from "axios";
import { normalizeRequestError, RequestError } from "../src/renderer/api/errors";
import { request, useAxios } from "../src/renderer/api/request";

describe("HTTP client error classification & VueUse useAxios", () => {
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

  it("useAxios resolves reactive data and normalizes errors through the bound request instance", async () => {
    const originalAdapter = request.defaults.adapter;
    try {
      request.defaults.adapter = async (config) => {
        if (config.url === "/mock-fail") {
          throw new AxiosError("Forbidden", "ERR_BAD_RESPONSE", config, undefined, {
            status: 401,
            data: { token: "super-secret-token" },
            headers: {},
            config: { headers: new AxiosHeaders() },
            statusText: "Unauthorized",
          });
        }
        return {
          data: { ok: true, target: config.url },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };

      const okState = useAxios<{ ok: boolean; target: string }>(
        "/mock-ok",
        { method: "GET" },
        { immediate: false },
      );
      expect(okState.isFinished.value).toBe(false);
      await okState.execute();
      expect(okState.isFinished.value).toBe(true);
      expect(okState.data.value).toEqual({ ok: true, target: "/mock-ok" });
      expect(okState.error.value).toBeUndefined();

      const failState = useAxios("/mock-fail", { method: "GET" }, { immediate: false });
      await failState.execute().catch(() => undefined);
      expect(failState.error.value).toBeInstanceOf(RequestError);
      const reqErr = failState.error.value as RequestError;
      expect(reqErr.kind).toBe("http");
      expect(reqErr.status).toBe(401);
      expect(reqErr.message).not.toContain("super-secret-token");
    } finally {
      request.defaults.adapter = originalAdapter;
    }
  });
});
