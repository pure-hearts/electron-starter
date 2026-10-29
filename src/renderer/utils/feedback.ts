/**
 * @file feedback.ts
 * @description 基于 Naive UI createDiscreteApi 的全局脱离上下文反馈工具（Message & Notification）。
 * 采用惰性初始化策略，确保在无 DOM 的 Node 单元测试环境下不会触发 ReferenceError。
 */

import { createDiscreteApi, type MessageApi, type NotificationApi } from "naive-ui";

let discreteInst: { message: MessageApi; notification: NotificationApi } | null = null;

function getDiscrete() {
  if (typeof document === "undefined") {
    return null;
  }
  if (!discreteInst) {
    discreteInst = createDiscreteApi(["message", "notification"]);
  }
  return discreteInst;
}

export const feedback = {
  message: {
    info(content: string, duration = 2500) {
      getDiscrete()?.message.info(content, { duration });
    },
    success(content: string, duration = 2000) {
      getDiscrete()?.message.success(content, { duration });
    },
    warning(content: string, duration = 3000) {
      getDiscrete()?.message.warning(content, { duration });
    },
    error(content: string, duration = 3500) {
      getDiscrete()?.message.error(content, { duration });
    },
  },
  notification: {
    info(title: string, content?: string) {
      getDiscrete()?.notification.info({ title, content, duration: 4000 });
    },
    success(title: string, content?: string) {
      getDiscrete()?.notification.success({ title, content, duration: 4000 });
    },
    warning(title: string, content?: string) {
      getDiscrete()?.notification.warning({ title, content, duration: 4000 });
    },
    error(title: string, content?: string) {
      getDiscrete()?.notification.error({ title, content, duration: 4500 });
    },
  },
};
