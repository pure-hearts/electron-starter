/** 应用生命周期控制：区分“关闭窗口到托盘”和“真正退出整个程序”。 */
import { app } from 'electron'
// quitting 标记供窗口 close 事件判断：真正退出时不能再拦截关闭并隐藏窗口。
let quitting = false
/** 查询是否正在彻底退出，避免托盘模式阻止应用关闭。 */
export function isQuitting(): boolean { return quitting }
/** 在调用 app.quit 前将标记置为 true，通知窗口关闭逻辑不要隐藏窗口。 */
export function markQuitting(): void { quitting = true }
/** 主动退出：设置标记后调用 Electron app.quit() 结束应用生命周期。 */
export function requestQuit(): void { markQuitting(); app.quit() }
/** 重启应用：app.relaunch 计划启动新进程，随后退出当前实例。 */
export function requestRestart(): void { app.relaunch(); requestQuit() }
