/**
 * 整包更新状态门禁：避免同时检查多个更新，且下载未完成时禁止安装。
 * checking 表示正在检查/下载；ready 表示更新包已由更新器报告下载完成。
 * 注意：这里不独立验证安装包签名，签名验证属于底层更新/发布链路。
 */
export class UpdateGate {
  // 是否存在正在进行的更新检查；用于拦截重复请求。
  private checking = false
  // 是否允许调用安装；检查失败或新一轮开始时必须清零。
  private ready = false
  /** 用于界面控制“安装更新”按钮的可用性。 */
  get canInstall(): boolean { return this.ready }
  /** 用于界面或调用方判断是否仍在检查更新。 */
  get isChecking(): boolean { return this.checking }
  /** 开始检查；返回 false 表示当前已有检查在执行。 */
  start(): boolean {
    // 同时运行两个检查可能产生状态竞争，直接拒绝第二个请求。
    if (this.checking) return false
    this.checking = true
    // 新检查开始后，上次下载的安装就绪状态不再被信任。
    this.ready = false
    return true
  }
  /** 没有可安装更新时结束检查，但不把状态误判为可安装。 */
  complete(): void { this.checking = false }
  /** 下载完成事件将状态从“检查中”切换到“可安装”。 */
  markDownloaded(): void { this.checking = false; this.ready = true }
  /** 下载失败、异常或状态无效时同时清理两个标记。 */
  invalidate(): void { this.checking = false; this.ready = false }
  /** 在执行 quitAndInstall 前强制检查，避免安装不存在的更新包。 */
  assertInstallReady(): void {
    if (!this.ready) throw new Error('No verified update is ready to install')
  }
}
