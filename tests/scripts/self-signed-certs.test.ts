import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("self-signed certificates suite tests", () => {
  const rootDir = process.cwd();
  const certsDir = path.join(rootDir, "certs");

  it("ensures certs directory structure and README exist", () => {
    expect(fs.existsSync(certsDir)).toBe(true);
    expect(fs.existsSync(path.join(certsDir, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(certsDir, ".gitkeep"))).toBe(true);
  });

  it("verifies gitignore protects all sensitive cert files from tracking", () => {
    const gitignorePath = path.join(rootDir, ".gitignore");
    const content = fs.readFileSync(gitignorePath, "utf8");

    expect(content).toContain("certs/**/*.pfx");
    expect(content).toContain("certs/**/*.p12");
    expect(content).toContain("certs/**/*.key");
    expect(content).toContain("certs/**/*.cer");
    expect(content).toContain("!certs/.gitkeep");
    expect(content).toContain("!certs/README.md");

    // 运行 git 命令确保实际未跟踪任何密钥
    const untrackedInCerts = execSync("git ls-files certs/", { encoding: "utf8" }).trim();
    // 只有已提交或待跟踪的非敏感文件（或为空）
    expect(untrackedInCerts).not.toContain(".pfx");
    expect(untrackedInCerts).not.toContain(".p12");
    expect(untrackedInCerts).not.toContain(".key");
  });

  it("verifies generated cert-info metadata format", () => {
    const winInfoPath = path.join(certsDir, "windows", "cert-info.json");
    const macInfoPath = path.join(certsDir, "macos", "cert-info.json");
    const linuxInfoPath = path.join(certsDir, "linux", "cert-info.json");

    if (fs.existsSync(winInfoPath)) {
      const winInfo = JSON.parse(fs.readFileSync(winInfoPath, "utf8"));
      expect(winInfo.platform).toBe("Windows");
      expect(winInfo.pfxFile).toBe("certs/windows/code-sign.pfx");
      expect(winInfo.cerFile).toBe("certs/windows/root-ca.cer");
      expect(winInfo.sha256Fingerprint).toBeDefined();
    }

    if (fs.existsSync(macInfoPath)) {
      const macInfo = JSON.parse(fs.readFileSync(macInfoPath, "utf8"));
      expect(macInfo.platform).toBe("macOS");
      expect(macInfo.p12File).toBe("certs/macos/mac-codesign.p12");
      expect(macInfo.cerFile).toBe("certs/macos/mac-root-ca.cer");
    }

    if (fs.existsSync(linuxInfoPath)) {
      const linuxInfo = JSON.parse(fs.readFileSync(linuxInfoPath, "utf8"));
      expect(linuxInfo.platform).toBe("Linux");
      expect(linuxInfo.keyFile).toBe("certs/linux/linux-signer.key");
    }
  });
});
