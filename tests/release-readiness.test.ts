import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";

describe("production release safety gates", () => {
  it("requires both Windows and macOS signing credentials before release", () => {
    const yml = fs.readFileSync(".github/workflows/release.yml", "utf8");
    for (const key of [
      "WIN_CSC_LINK",
      "WIN_CSC_KEY_PASSWORD",
      "MAC_CSC_LINK",
      "MAC_CSC_KEY_PASSWORD",
      "APPLE_ID",
      "APPLE_TEAM_ID",
    ]) {
      expect(yml).toContain(key);
    }
    expect(yml).toContain("needs: preflight");
  });
  it("does not ship placeholder maintainer identity as a verified publisher", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      author: { email: string };
    };
    expect(pkg.author.email).toContain("replace-before-release");
  });
});
