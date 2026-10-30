/**
 * @file shortcut.ts
 * @description 快捷键解析、格式化与跨平台按键转换工具库
 */

export interface ParsedShortcut {
  valid: boolean;
  inProgress: boolean;
  accelerator: string;
  error?: string;
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "Command", "Option", "AltGraph"]);

/**
 * 判断当前是否处于 macOS 平台
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/**
 * 将键盘按键事件（KeyboardEvent）解析为标准 Electron Accelerator 字符串
 */
export function parseKeyboardEvent(
  e: KeyboardEvent,
  isMac: boolean = isMacPlatform(),
): ParsedShortcut {
  const key = e.key;
  const code = e.code;

  // 如果按下的是纯修饰键
  if (MODIFIER_KEYS.has(key)) {
    return {
      valid: false,
      inProgress: true,
      accelerator: "",
    };
  }

  // 特殊键拦截：Esc 键用于取消，不作为快捷键组成
  if (key === "Escape") {
    return {
      valid: false,
      inProgress: false,
      accelerator: "",
      error: "已取消录制",
    };
  }

  const modifiers: string[] = [];

  // 修饰键判定：macOS 取 metaKey (Cmd)，Windows/Linux 取 ctrlKey
  const hasCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
  if (hasCmdOrCtrl) {
    modifiers.push("CommandOrControl");
  } else if (isMac && e.ctrlKey) {
    // macOS 上的 Control 键（如果用户显式按下 Control 键）
    modifiers.push("Control");
  }

  if (e.altKey) {
    modifiers.push("Alt");
  }

  if (e.shiftKey) {
    modifiers.push("Shift");
  }

  // 基础按键标准化
  let baseKey = "";

  if (code.startsWith("Key") && code.length === 4) {
    // 字母键 A-Z
    baseKey = code.slice(3).toUpperCase();
  } else if (code.startsWith("Digit") && code.length === 6) {
    // 数字键 0-9
    baseKey = code.slice(5);
  } else if (/^F[1-9]|F1[0-9]|F2[0-4]$/.test(code)) {
    // 功能键 F1-F24
    baseKey = code;
  } else {
    // 常用功能与导航键
    const specialKeyMap: Record<string, string> = {
      Space: "Space",
      Enter: "Return",
      Tab: "Tab",
      Backspace: "Backspace",
      Delete: "Delete",
      Insert: "Insert",
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      Minus: "-",
      Equal: "=",
      BracketLeft: "[",
      BracketRight: "]",
      Backslash: "\\",
      Semicolon: ";",
      Quote: "'",
      Comma: ",",
      Period: ".",
      Slash: "/",
      Backquote: "`",
    };

    if (specialKeyMap[code]) {
      baseKey = specialKeyMap[code];
    } else if (key && key.length === 1) {
      baseKey = key.toUpperCase();
    }
  }

  if (!baseKey) {
    return {
      valid: false,
      inProgress: false,
      accelerator: "",
      error: "未识别的按键",
    };
  }

  // 安全性规则：全局快捷键不能只包含单键或只包含 Shift+单键（防打字冲突）
  const hasPrimaryModifier =
    modifiers.includes("CommandOrControl") ||
    modifiers.includes("Alt") ||
    modifiers.includes("Control");
  if (!hasPrimaryModifier) {
    return {
      valid: false,
      inProgress: false,
      accelerator: "",
      error: "全局快捷键必须包含 Ctrl、Cmd 或 Alt 修饰键",
    };
  }

  modifiers.push(baseKey);
  const accelerator = modifiers.join("+");

  return {
    valid: true,
    inProgress: false,
    accelerator,
  };
}

/**
 * 将 Electron Accelerator 字符串转换为便于前端可视化的按键标签列表
 */
export function formatAcceleratorDisplay(
  accelerator: string,
  isMac: boolean = isMacPlatform(),
): { symbol: string; label: string }[] {
  if (!accelerator || typeof accelerator !== "string") {
    return [];
  }

  const parts = accelerator
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.map((part) => {
    switch (part.toLowerCase()) {
      case "commandorcontrol":
      case "cmdorctrl":
        return isMac ? { symbol: "⌘", label: "Cmd" } : { symbol: "Ctrl", label: "Ctrl" };
      case "command":
      case "cmd":
        return { symbol: "⌘", label: "Cmd" };
      case "control":
      case "ctrl":
        return isMac ? { symbol: "⌃", label: "Control" } : { symbol: "Ctrl", label: "Ctrl" };
      case "alt":
      case "option":
        return isMac ? { symbol: "⌥", label: "Option" } : { symbol: "Alt", label: "Alt" };
      case "shift":
        return isMac ? { symbol: "⇧", label: "Shift" } : { symbol: "Shift", label: "Shift" };
      case "return":
      case "enter":
        return { symbol: "↵", label: "Enter" };
      case "space":
        return { symbol: "␣", label: "Space" };
      case "up":
        return { symbol: "↑", label: "Up" };
      case "down":
        return { symbol: "↓", label: "Down" };
      case "left":
        return { symbol: "←", label: "Left" };
      case "right":
        return { symbol: "→", label: "Right" };
      case "backspace":
        return { symbol: "⌫", label: "Backspace" };
      case "delete":
        return { symbol: "⌦", label: "Delete" };
      default:
        return { symbol: part, label: part };
    }
  });
}
