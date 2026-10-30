/**
 * @file shortcut-recorder.test.ts
 * @description 快捷键解析与跨平台符号格式化单测
 */
import { describe, expect, it } from "vite-plus/test";
import { parseKeyboardEvent, formatAcceleratorDisplay } from "../src/renderer/utils/shortcut";

describe("shortcut utility tests", () => {
  describe("parseKeyboardEvent", () => {
    it("should mark inProgress when only modifier keys are pressed", () => {
      const mockEvent = {
        key: "Control",
        code: "ControlLeft",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent);
      expect(result.valid).toBe(false);
      expect(result.inProgress).toBe(true);
    });

    it("should cancel recording when Escape key is pressed", () => {
      const mockEvent = {
        key: "Escape",
        code: "Escape",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent);
      expect(result.valid).toBe(false);
      expect(result.inProgress).toBe(false);
      expect(result.error).toBe("已取消录制");
    });

    it("should reject standalone character key without modifiers", () => {
      const mockEvent = {
        key: "a",
        code: "KeyA",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("必须包含 Ctrl、Cmd 或 Alt");
    });

    it("should correctly parse CommandOrControl+Shift+X on Windows/Linux", () => {
      const mockEvent = {
        key: "X",
        code: "KeyX",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent, false);
      expect(result.valid).toBe(true);
      expect(result.accelerator).toBe("CommandOrControl+Shift+X");
    });

    it("should correctly parse CommandOrControl+Shift+X on macOS", () => {
      const mockEvent = {
        key: "X",
        code: "KeyX",
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: true,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent, true);
      expect(result.valid).toBe(true);
      expect(result.accelerator).toBe("CommandOrControl+Shift+X");
    });

    it("should correctly parse function keys like Alt+F5", () => {
      const mockEvent = {
        key: "F5",
        code: "F5",
        ctrlKey: false,
        metaKey: false,
        altKey: true,
        shiftKey: false,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent, false);
      expect(result.valid).toBe(true);
      expect(result.accelerator).toBe("Alt+F5");
    });

    it("should correctly parse navigation keys like CommandOrControl+ArrowUp", () => {
      const mockEvent = {
        key: "ArrowUp",
        code: "ArrowUp",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as unknown as KeyboardEvent;

      const result = parseKeyboardEvent(mockEvent, false);
      expect(result.valid).toBe(true);
      expect(result.accelerator).toBe("CommandOrControl+Up");
    });
  });

  describe("formatAcceleratorDisplay", () => {
    it("should format symbols properly on macOS", () => {
      const display = formatAcceleratorDisplay("CommandOrControl+Shift+X", true);
      expect(display).toEqual([
        { symbol: "⌘", label: "Cmd" },
        { symbol: "⇧", label: "Shift" },
        { symbol: "X", label: "X" },
      ]);
    });

    it("should format symbols properly on Windows/Linux", () => {
      const display = formatAcceleratorDisplay("CommandOrControl+Shift+X", false);
      expect(display).toEqual([
        { symbol: "Ctrl", label: "Ctrl" },
        { symbol: "Shift", label: "Shift" },
        { symbol: "X", label: "X" },
      ]);
    });

    it("should format special keys like Space, Return, and Up", () => {
      const display = formatAcceleratorDisplay("Alt+Return", false);
      expect(display).toEqual([
        { symbol: "Alt", label: "Alt" },
        { symbol: "↵", label: "Enter" },
      ]);
    });

    it("should handle empty or invalid input safely", () => {
      expect(formatAcceleratorDisplay("", false)).toEqual([]);
    });
  });
});
