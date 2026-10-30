import { describe, it, expect } from "vite-plus/test";

function isValidAccelerator(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 100) return false;
  const parts = trimmed.split("+").map((s) => s.trim());
  if (parts.length < 1) return false;
  return parts.every((p) => p.length > 0);
}

describe("Global shortcut accelerator validation", () => {
  it("accepts valid electron accelerators", () => {
    expect(isValidAccelerator("CommandOrControl+Shift+X")).toBe(true);
    expect(isValidAccelerator("Ctrl+Alt+K")).toBe(true);
    expect(isValidAccelerator("F11")).toBe(true);
    expect(isValidAccelerator("CommandOrControl+Alt+Left")).toBe(true);
  });

  it("rejects empty, invalid or oversized accelerators", () => {
    expect(isValidAccelerator("")).toBe(false);
    expect(isValidAccelerator("   ")).toBe(false);
    expect(isValidAccelerator("Ctrl++X")).toBe(false);
    expect(isValidAccelerator("A".repeat(101))).toBe(false);
  });
});
