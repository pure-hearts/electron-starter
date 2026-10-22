/**
 * 打印功能使用发起 IPC 的 WebContents，而不是任意选择别的窗口。
 * getPrintersAsync 查询当前系统打印机；print 发起系统打印任务。
 */
import type { WebContents } from 'electron'

// 返回打印机名称与显示名称，让页面可以列出可选打印设备。
export async function printers(webContents: WebContents) {
  // Electron 返回的原始打印机对象可能包含更多字段，这里只提供 UI 所需的信息。
  return (await webContents.getPrintersAsync()).map(p => ({ name: p.name, displayName: p.displayName }))
}

/** 打印发起请求的当前页面，Promise 返回系统报告的成功状态或错误原因。 */
export function printCurrentPage(webContents: WebContents): Promise<{success:boolean;failureReason?:string}> {
  // silent:false 会显示系统打印对话框；printBackground:true 会打印 CSS 背景。
  // print 的回调在打印任务返回时触发，不代表纸张已经从物理打印机输出。
  return new Promise(resolve => webContents.print({ silent: false, printBackground: true }, (success, failureReason) => resolve({ success, failureReason })))
}
