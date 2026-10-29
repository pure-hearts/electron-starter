import type { DesktopBridge } from "../shared/ipc";

export interface ExtendedDesktopBridge extends DesktopBridge {
  __isWebShim?: boolean;
}

declare global {
  interface Window {
    $ipcBridge: ExtendedDesktopBridge;
    process?: {
      versions?: {
        electron?: string;
      };
    };
  }
}
export {};
