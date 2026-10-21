/** 应用、窗口、持久化配置与自启动功能。 */
import { app } from 'electron'
import type { SettingKey } from '../../shared/ipc'
import { windowAction, openChild } from '../window'
import { getSetting, setSetting, deleteSetting } from '../modules/store'
import { getAutoStart, setAutoStart } from '../modules/startup'
import { requestQuit, requestRestart } from '../modules/lifecycle'
import type { HandlerGroup } from './types'
export const systemHandlers = {
  'app:version': () => app.getVersion(),
  'app:quit': () => requestQuit(),
  'app:restart': () => requestRestart(),
  // 必须使用发起消息的 e.sender，操作调用者所属的窗口而非随意指定窗口。
  'window:action': (e, [action]) => windowAction(e.sender, action as string),
  'window:open': (_e, [route]) => openChild(route as string),
  'store:get': (_e, [key]) => getSetting(key as SettingKey),
  'store:set': (_e, [key, value]) => setSetting(key as SettingKey, value as string | boolean),
  'store:delete': (_e, [key]) => deleteSetting(key as SettingKey),
  'startup:get': () => getAutoStart(),
  'startup:set': (_e, [value]) => setAutoStart(value as boolean),
} satisfies HandlerGroup
