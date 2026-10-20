import { describe, expect, it } from 'vite-plus/test'
import { DeepLinkInbox } from '../src/main/modules/deep-link-inbox'

describe('native deep-link launch contract', () => {
  it('stores cold-start links until renderer subscribes', () => {
    const inbox = new DeepLinkInbox('electron-starter')
    expect(inbox.accept('electron-starter://open/settings')).toBeTruthy()
    expect(inbox.drain()).toEqual(['electron-starter://open/settings'])
    expect(inbox.drain()).toEqual([])
  })
})
