import { describe, expect, it } from 'vitest'
import { personInitial, personTone } from './personTone'

describe('personTone', () => {
  it('keeps the two original people on their colours whatever the order', () => {
    expect(personTone('arany', 5)).toContain('bg-bite-500')
    expect(personTone('oli', 0)).toContain('bg-mustard-500')
  })

  it('colours anybody else by their place in the household', () => {
    expect(personTone('me', 0)).toContain('bg-bite-500')
    expect(personTone('sam', 1)).toContain('bg-mustard-500')
    expect(personTone('kit', 2)).toContain('bg-coral-300')
    expect(personTone('jo', 6)).toBe(personTone('kit', 2))
  })

  it('always writes in the ink that does not invert after dark', () => {
    for (let i = 0; i < 4; i++) expect(personTone('x', i)).toContain('text-on-brand')
  })
})

describe('personInitial', () => {
  it('takes the first letter of the name, upper case', () => {
    expect(personInitial('arany', 'arany')).toBe('A')
    expect(personInitial('  Oli', 'oli')).toBe('O')
    expect(personInitial('élise', 'e')).toBe('É')
  })

  it('falls back to the key, then to a question mark', () => {
    expect(personInitial('', 'sam')).toBe('S')
    expect(personInitial(undefined, '--')).toBe('?')
  })
})
