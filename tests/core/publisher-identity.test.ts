import { describe, expect, it } from "vite-plus/test";
import { spawnSync } from "node:child_process";
describe("production publisher identity gate", () => {
  it("fails closed while template metadata has placeholders", () => {
    const result = spawnSync(process.execPath, ["scripts/assert-publisher-identity.mjs"], {
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Production release requires a real maintainer email");
  });
});
