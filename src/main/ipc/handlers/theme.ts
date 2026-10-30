import type { HandlerGroup } from "./types";
import { getSystemThemeInfo } from "../../modules/system/theme-module";

export const themeHandlers = {
  "theme:system:get": () => getSystemThemeInfo(),
} satisfies HandlerGroup;
