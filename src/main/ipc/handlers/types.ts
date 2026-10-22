/** 所有 IPC 业务处理器的统一签名；底层已完成来源与参数校验。 */
import type { IpcMainInvokeEvent } from 'electron'
import type { InvokeChannel } from '../../../shared/ipc'

export type Handler = (event: IpcMainInvokeEvent, args: unknown[]) => unknown
export type HandlerGroup = Partial<Record<InvokeChannel, Handler>>
