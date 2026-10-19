import type { WebContents } from 'electron'
export async function printers(webContents: WebContents) {
  return (await webContents.getPrintersAsync()).map(p => ({ name: p.name, displayName: p.displayName }))
}
export function printCurrentPage(webContents: WebContents): Promise<{success:boolean;failureReason?:string}> {
  return new Promise(resolve => webContents.print({ silent: false, printBackground: true }, (success, failureReason) => resolve({ success, failureReason })))
}
