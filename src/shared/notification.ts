/** 主进程与 Renderer 共用的通知业务协议；不暴露 Electron 原生对象。 */
export type NotificationKind = "info" | "success" | "warning" | "error";
export interface NotificationOptions {
  title: string;
  body: string;
  kind?: NotificationKind;
  dedupeKey?: string;
  // 只允许应用内部路径，绝不能作为外部网址或命令执行。
  action?: string;
}
export interface NotificationReceipt {
  id: string;
  accepted: boolean;
  reason?: "unsupported" | "duplicate" | "rate-limited";
}
export interface NotificationActivation {
  id: string;
  kind: NotificationKind;
  action?: string;
  sourceWindowId?: number;
}

/** 通知退出生命周期：关闭/失败事件由主进程发出，不能代表系统实际展示成功。 */
export interface NotificationSettled {
  id: string;
  reason: "closed" | "failed";
}
