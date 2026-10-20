/** Prevent concurrent update downloads and installation before verification. */
export class UpdateGate {
  private checking = false
  private ready = false
  get canInstall(): boolean { return this.ready }
  get isChecking(): boolean { return this.checking }
  start(): boolean {
    if (this.checking) return false
    this.checking = true
    this.ready = false
    return true
  }
  complete(): void { this.checking = false }
  markDownloaded(): void { this.checking = false; this.ready = true }
  invalidate(): void { this.checking = false; this.ready = false }
  assertInstallReady(): void {
    if (!this.ready) throw new Error('No verified update is ready to install')
  }
}
