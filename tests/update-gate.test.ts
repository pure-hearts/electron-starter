import { describe, expect, it } from "vite-plus/test";
import { UpdateGate } from "../src/main/modules/update/full/gate";
describe("full update state gate", () => {
  it("rejects concurrent checks and installation before download", () => {
    const gate = new UpdateGate();
    expect(() => gate.assertInstallReady()).toThrow();
    expect(gate.start()).toBe(true);
    expect(gate.start()).toBe(false);
    gate.complete();
    expect(gate.canInstall).toBe(false);
  });
  it("allows install only after downloaded and resets on new check", () => {
    const gate = new UpdateGate();
    gate.start();
    gate.markDownloaded();
    expect(gate.canInstall).toBe(true);
    expect(() => gate.assertInstallReady()).not.toThrow();
    gate.start();
    expect(gate.canInstall).toBe(false);
  });
  it("clears ready state on error", () => {
    const gate = new UpdateGate();
    gate.markDownloaded();
    gate.invalidate();
    expect(() => gate.assertInstallReady()).toThrow();
    expect(gate.isChecking).toBe(false);
  });
});
