/** 聚合所有 IPC 业务域 Handler */
import type { HandlerGroup } from "./types";
import { systemHandlers } from "./system";
import { transferHandlers } from "./transfer";
import { serviceHandlers } from "./services";
import { shellHandlers } from "./shell";
import { themeHandlers } from "./theme";
import { settingsHandlers } from "./settings";

export {
  systemHandlers,
  transferHandlers,
  serviceHandlers,
  shellHandlers,
  themeHandlers,
  settingsHandlers,
};

export const allHandlers: HandlerGroup = {
  ...systemHandlers,
  ...transferHandlers,
  ...serviceHandlers,
  ...shellHandlers,
  ...themeHandlers,
  ...settingsHandlers,
};
