import { describe, it, expect } from "vite-plus/test";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { redactLogMessage } from "../src/main/modules/core/log-redaction";

describe("Diagnostics and log export serialization", () => {
  it("redacts sensitive fields before exporting logs", () => {
    const rawLog =
      'User login Bearer mySecretToken https://api.test?token=xyz123 {"password":"secret123456"}';
    const sanitized = redactLogMessage(rawLog);
    expect(sanitized).not.toContain("secret123456");
    expect(sanitized).not.toContain("mySecretToken");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("compresses and extracts diagnostics package safely with fflate", () => {
    const sysInfo = {
      appVersion: "0.1.3",
      osPlatform: "darwin",
      memoryMb: 16384,
    };
    const logData = "2026-10-30 INFO Application startup completed successfully.";

    const zipArchive = zipSync({
      "diagnostics-summary.json": strToU8(JSON.stringify(sysInfo)),
      "logs/main.log": strToU8(logData),
    });

    expect(zipArchive.byteLength).toBeGreaterThan(0);

    const unzipped = unzipSync(zipArchive);
    expect(unzipped["diagnostics-summary.json"]).toBeDefined();
    expect(unzipped["logs/main.log"]).toBeDefined();

    const restoredSysInfo = JSON.parse(strFromU8(unzipped["diagnostics-summary.json"]));
    expect(restoredSysInfo.appVersion).toBe("0.1.3");
    expect(restoredSysInfo.osPlatform).toBe("darwin");

    const restoredLog = strFromU8(unzipped["logs/main.log"]);
    expect(restoredLog).toBe(logData);
  });
});
