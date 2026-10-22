import { describe, expect, it } from "vite-plus/test";
import { UpdateGate } from "../src/main/modules/update/full/gate";

describe("installer update lifecycle regression", () => {
  it("never installs during a new check or after a failure", () => {
    const state = new UpdateGate();
    expect(state.start()).toBe(true);
    expect(() => state.assertInstallReady()).toThrow();
    state.markDownloaded();
    expect(() => state.assertInstallReady()).not.toThrow();
    state.invalidate();
    expect(() => state.assertInstallReady()).toThrow();
    expect(state.start()).toBe(true);
    expect(() => state.assertInstallReady()).toThrow();
  });
});
