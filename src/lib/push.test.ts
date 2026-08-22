import { describe, expect, it } from 'vitest'
import { decodeKey, looksLikeAKey, deviceLabel } from './push'

/**
 * The parts of subscribing that can be wrong quietly.
 *
 * Whether a browser grants permission is not ours to decide and not ours to
 * test. Turning a key into the bytes a browser will accept is entirely ours,
 * and getting it subtly wrong produces a subscription that looks fine and
 * never receives anything.
 */

// A real VAPID public key is 65 bytes, base64url, unpadded.
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

describe('the signing key', () => {
  it('decodes to the 65 bytes a browser expects', () => {
    expect(decodeKey(KEY)).toHaveLength(65)
  })

  it('reads base64url, which is not base64', () => {
    // The two characters that differ are the whole point: a decoder that does
    // not swap them produces bytes that are wrong rather than an error.
    const decoded = decodeKey('-_-_')
    expect([...decoded]).toEqual([...atob('+/+/')].map((c) => c.charCodeAt(0)))
  })

  it('copes with a key that needs padding back on', () => {
    expect(() => decodeKey('AAA')).not.toThrow()
  })

  it('recognises a key of the right shape', () => {
    expect(looksLikeAKey(KEY)).toBe(true)
    expect(looksLikeAKey(` ${KEY} `)).toBe(true)
  })

  it('turns down anything else, before a browser has to', () => {
    expect(looksLikeAKey('')).toBe(false)
    expect(looksLikeAKey(null)).toBe(false)
    expect(looksLikeAKey('too-short')).toBe(false)
    // A pasted key with the padding left on, or quotes around it.
    expect(looksLikeAKey(`"${KEY}"`)).toBe(false)
  })
})

describe('naming a device', () => {
  it('says something a person would recognise', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android phone')
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iPhone')
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac')
  })

  it('falls back rather than guessing wrong', () => {
    expect(deviceLabel('something nobody has seen before')).toBe('This device')
  })
})
