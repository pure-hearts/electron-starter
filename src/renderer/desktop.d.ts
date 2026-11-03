import type { DesktopBridge } from "../shared/ipc";

declare global {
  interface Window {
    $ipcBridge?: DesktopBridge;
    process?: {
      versions?: {
        electron?: string;
      };
    };
  }
}
export {};
