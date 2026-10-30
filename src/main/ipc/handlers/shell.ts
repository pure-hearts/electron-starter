import type { HandlerGroup } from "./types";
import {
  showItemInFolder,
  openPath,
  openExternal,
  trashItem,
} from "../../modules/system/shell-module";

export const shellHandlers = {
  "shell:showItemInFolder": (_e, [p]) => showItemInFolder(p as string),
  "shell:openPath": (_e, [p]) => openPath(p as string),
  "shell:openExternal": (_e, [url]) => openExternal(url as string),
  "shell:trashItem": (_e, [p]) => trashItem(p as string),
} satisfies HandlerGroup;
