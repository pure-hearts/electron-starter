import { app } from 'electron'
/** Linux desktop environments may ignore setLoginItemSettings; report actual state. */
export function getAutoStart() { return app.getLoginItemSettings().openAtLogin }
export function setAutoStart(enabled: boolean) {
  app.setLoginItemSettings({ openAtLogin: enabled })
  return getAutoStart()
}
