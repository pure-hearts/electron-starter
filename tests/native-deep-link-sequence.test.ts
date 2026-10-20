import { describe, expect, it } from 'vite-plus/test'
import { DeepLinkInbox } from '../src/main/modules/deep-link-inbox'
describe('native deep link handoff regressions', () => {
  it('buffers multiple cold-launch activations in order, exactly once', () => {
    const inbox = new DeepLinkInbox('electron-starter')
    expect(inbox.accept('electron-starter://open/one')).toBeTruthy()
    expect(inbox.accept('electron-starter://open/two')).toBeTruthy()
    expect(inbox.drain()).toEqual(['electron-starter://open/one', 'electron-starter://open/two'])
    expect(inbox.drain()).toEqual([])
  })
  it('rejects another application protocol and enforces queue cap', () => {
    const inbox = new DeepLinkInbox('electron-starter', 2)
    expect(inbox.accept('other-app://open/one')).toBeNull()
    for (const key of ['one','two','three']) inbox.accept('electron-starter://open/' + key)
    expect(inbox.drain()).toEqual(['electron-starter://open/two', 'electron-starter://open/three'])
  })
})
