import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import { popupContextMenu } from "../../src/main/modules/system/context-menu";
import type { BrowserWindow, MenuItemConstructorOptions } from "electron";

let builtTemplate: MenuItemConstructorOptions[] = [];
const mockPopup = vi.fn();

vi.mock("electron", () => {
  return {
    Menu: {
      buildFromTemplate: vi.fn().mockImplementation((tpl: MenuItemConstructorOptions[]) => {
        builtTemplate = tpl;
        return {
          popup: mockPopup,
        };
      }),
    },
    BrowserWindow: class {},
  };
});

const mockBroadcast = vi.fn();
vi.mock("../../src/main/window/broadcast", () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
}));

describe("context-menu module tests", () => {
  let mockWin: BrowserWindow;
  const mockSend = vi.fn();

  beforeEach(() => {
    builtTemplate = [];
    mockPopup.mockClear();
    mockBroadcast.mockClear();
    mockSend.mockClear();

    mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        isDestroyed: vi.fn().mockReturnValue(false),
        send: mockSend,
        inspectElement: vi.fn(),
        openDevTools: vi.fn(),
      },
    } as unknown as BrowserWindow;
  });

  it("builds editable context menu with cut, copy, paste and undo", () => {
    popupContextMenu(mockWin, { isEditable: true });
    expect(mockPopup).toHaveBeenCalled();

    const roles = builtTemplate.map((item) => item.role).filter(Boolean);
    expect(roles).toContain("undo");
    expect(roles).toContain("redo");
    expect(roles).toContain("cut");
    expect(roles).toContain("copy");
    expect(roles).toContain("paste");
    expect(roles).toContain("selectAll");
  });

  it("builds selection context menu when non-editable text is selected", () => {
    popupContextMenu(mockWin, { isEditable: false, hasSelection: true, selectionText: "hello" });
    expect(mockPopup).toHaveBeenCalled();

    const roles = builtTemplate.map((item) => item.role).filter(Boolean);
    expect(roles).toContain("copy");
    expect(roles).toContain("selectAll");
    expect(roles).not.toContain("cut");
  });

  it("includes custom action items and invokes broadcast on click", () => {
    popupContextMenu(mockWin, {
      items: [
        { id: "custom-action-1", label: "自定义操作", type: "normal" },
        { type: "separator" },
      ],
    });

    expect(mockPopup).toHaveBeenCalled();
    const customItem = builtTemplate.find((item) => item.id === "custom-action-1");
    expect(customItem).toBeDefined();
    expect(customItem?.label).toBe("自定义操作");

    // 模拟点击自定义菜单项
    customItem?.click?.({} as any, {} as any, {} as any);
    expect(mockSend).toHaveBeenCalledWith("context-menu:action", { id: "custom-action-1" });
  });

  it("passes coordinates to popup options", () => {
    popupContextMenu(mockWin, { x: 120.4, y: 240.8, isEditable: true });
    expect(mockPopup).toHaveBeenCalledWith({
      window: mockWin,
      x: 120,
      y: 241,
    });
  });

  it("does not pop up if window is destroyed", () => {
    (mockWin.isDestroyed as any).mockReturnValue(true);
    popupContextMenu(mockWin, { isEditable: true });
    expect(mockPopup).not.toHaveBeenCalled();
  });
});
