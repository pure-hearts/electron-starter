import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

vi.mock("electron", () => {
  return {
    app: {
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    protocol: {
      registerSchemesAsPrivileged: vi.fn(),
    },
    dialog: {
      showMessageBox: vi.fn(),
    },
    BrowserWindow: class {},
  };
});

import { renderCrashFallback } from "../../src/main/modules/system/crash";
import type { BrowserWindow } from "electron";

describe("crash-fallback module tests", () => {
  let mockWin: BrowserWindow;
  let loadedUrl = "";

  beforeEach(() => {
    loadedUrl = "";
    mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      loadURL: vi.fn().mockImplementation((url: string) => {
        loadedUrl = url;
        return Promise.resolve();
      }),
    } as unknown as BrowserWindow;
  });

  it("loads crash fallback URL with reason and exit code params", () => {
    renderCrashFallback(mockWin, {
      reason: "crashed",
      exitCode: 139,
    });

    expect(mockWin.loadURL).toHaveBeenCalled();
    expect(loadedUrl).toContain("crash-fallback.html");
    expect(loadedUrl).toContain("reason=crashed");
    expect(loadedUrl).toContain("code=139");
  });

  it("handles empty details safely without crashing", () => {
    renderCrashFallback(mockWin, {} as any);
    expect(mockWin.loadURL).toHaveBeenCalled();
    expect(loadedUrl).toContain("crash-fallback.html");
  });

  it("does not load if window is destroyed", () => {
    (mockWin.isDestroyed as any).mockReturnValue(true);
    renderCrashFallback(mockWin, { reason: "oom", exitCode: 1 });
    expect(mockWin.loadURL).not.toHaveBeenCalled();
  });
});
