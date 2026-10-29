import { describe, it, expect } from "vite-plus/test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  verifyHotManifest,
  manifestBody,
  validateHotArchiveUrl,
  type ManifestBody,
} from "../src/main/modules/update/hot/manifest";

const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const body: ManifestBody = {
  revision: 7,
  compatibleApp: "0.1.0",
  url: "https://example.com/renderer-7.zip",
  sha256: "f".repeat(64),
};
function signed(input: ManifestBody = body) {
  return {
    ...input,
    signature: sign(
      null,
      Buffer.from(JSON.stringify(manifestBody(input))),
      keys.privateKey,
    ).toString("base64"),
  };
}
describe("signed renderer hot update manifest", () => {
  it("accepts a valid signed manifest", () => {
    expect(verifyHotManifest(signed(), "0.1.0", publicKey).revision).toBe(7);
  });
  it("rejects tampering even when SHA-256 has correct shape", () => {
    const m = signed();
    expect(() => verifyHotManifest({ ...m, sha256: "a".repeat(64) }, "0.1.0", publicKey)).toThrow(
      "signature",
    );
  });
  it("rejects incompatible app and invalid URL", () => {
    expect(() => verifyHotManifest(signed(), "0.2.0", publicKey)).toThrow("Incompatible");
    expect(() =>
      verifyHotManifest(signed({ ...body, url: "http://example.com/a.zip" }), "0.1.0", publicKey),
    ).toThrow("manifest");
  });
  it("rejects signed HTTPS URLs with credentials or fragments", () => {
    for (const url of [
      "https://username:password@example.com/renderer.zip",
      "https://example.com/renderer.zip#ignored",
      "https:///missing-host",
    ]) {
      expect(() => verifyHotManifest(signed({ ...body, url }), "0.1.0", publicKey)).toThrow();
    }
  });
  it("accepts a valid signed manifest with versionTag and commit", () => {
    const timestampTag = "20261029173000_be18d80";
    const m = signed({
      ...body,
      revision: 20261029173000,
      versionTag: timestampTag,
      commit: "be18d80",
    });
    const verified = verifyHotManifest(m, "0.1.0", publicKey);
    expect(verified.revision).toBe(20261029173000);
    expect(verified.versionTag).toBe(timestampTag);
    expect(verified.commit).toBe("be18d80");
  });
  it("rejects missing signature and malformed objects", () => {
    expect(() => verifyHotManifest({ ...body }, "0.1.0", publicKey)).toThrow();
    expect(() => verifyHotManifest(null, "0.1.0", publicKey)).toThrow();
  });
});

describe("hot archive URL validation", () => {
  it("rejects embedded credentials, fragments and non-HTTPS URLs", () => {
    for (const url of [
      "https://user:pass@example.com/archive.zip",
      "https://example.com/archive.zip#token",
      "http://example.com/archive.zip",
      "https://example.com/archive.zip\n",
      "https://example.com:443/archive.zip",
    ]) {
      expect(() => validateHotArchiveUrl(url)).toThrow("Invalid hot update URL");
    }
  });
  it("accepts a canonical HTTPS URL without credentials", () => {
    expect(() => validateHotArchiveUrl("https://example.com/archive.zip")).not.toThrow();
  });
});
