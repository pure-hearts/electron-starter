import { describe, expect, it } from 'vite-plus/test'
import { validateUpdateFeedUrl } from '../src/main/modules/update/full/feed-url'
describe('full update feed URL policy', () => {
  it('accepts canonical HTTPS feeds', () => {
    expect(() => validateUpdateFeedUrl('https://updates.example.com/stable/')).not.toThrow()
  })
  it('rejects unsafe and ambiguous update endpoints', () => {
    for (const input of [
      'http://updates.example.com/stable/',
      'https://alice:secret@updates.example.com/',
      'https://updates.example.com/#fragment',
      'https://updates.example.com:443/stable/',
      'https://updates.example.com/stable/\n',
      'file:///etc/passwd'
    ]) expect(() => validateUpdateFeedUrl(input)).toThrow('Invalid update feed URL')
  })
})
