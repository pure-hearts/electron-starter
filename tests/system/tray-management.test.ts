import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import path from "node:path";

vi.mock("../../src/main/window", () => ({
  focusMainWindow: vi.fn(),
}));

vi.mock("../../src/main/modules/core/lifecycle", () => ({
  requestQuit: vi.fn(),
}));

const mockTrayInstance = {
  setImage: vi.fn(),
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  on: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("electron", () => {
  class MockTray {
    constructor() {
      return mockTrayInstance;
    }
  }

  return {
    app: {
      isPackaged: false,
      getName: vi.fn().mockReturnValue("electron-starter"),
      dock: {
        setIcon: vi.fn(),
      },
    },
    Tray: MockTray,
    Menu: {
      buildFromTemplate: vi.fn().mockReturnValue({}),
    },
    nativeImage: {
      createFromPath: vi.fn().mockImplementation((p: string) => ({
        isEmpty: vi.fn().mockReturnValue(false),
        setTemplateImage: vi.fn(),
        resize: vi.fn().mockReturnThis(),
        _path: p,
      })),
    },
    protocol: {
      registerSchemesAsPrivileged: vi.fn(),
    },
  };
});

describe("System Tray Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves icons directory and path correctly for dev mode", async () => {
    const { getIconsDirectory, getIconPath } = await import("../../src/main/modules/system/tray");
    const dir = getIconsDirectory();
    expect(dir).toBe(path.join(process.cwd(), "resources", "icons"));

    const iconPath = getIconPath("trayTemplate.png");
    expect(iconPath).toBe(path.join(process.cwd(), "resources", "icons", "trayTemplate.png"));
  });

  it("creates and reloads tray icon cleanly", async () => {
    const { createTray, reloadTrayIcon, destroyTray } =
      await import("../../src/main/modules/system/tray");

    const tray = createTray();
    expect(tray).toBeDefined();

    const reloaded = reloadTrayIcon();
    expect(reloaded).toBe(true);
    expect(mockTrayInstance.setImage).toHaveBeenCalled();

    destroyTray();
    expect(mockTrayInstance.destroy).toHaveBeenCalled();
  });
});
