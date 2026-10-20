import { app } from 'electron'
let quitting = false
export function isQuitting(): boolean { return quitting }
export function markQuitting(): void { quitting = true }
export function requestQuit(): void { markQuitting(); app.quit() }
