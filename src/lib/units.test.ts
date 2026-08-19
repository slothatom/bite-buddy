import { describe, expect, it } from 'vitest'
import { detectState, parseFragment, parseNumber, splitComponents, normaliseTerm } from './units'

/**
 * The parsing vocabulary is the part of this app most likely to be wrong in a
 * way nobody notices: a mis-parsed fragment still produces a number, just the
 * wrong one. These cases are taken verbatim from the dietician's documents.
 */

describe('parseNumber', () => {
  it('reads decimal commas the way the plans write them', () => {
    expect(parseNumber('1,5')).toBe(1.5)
  })
  it('reads fractions and the half symbol', () => {
    expect(parseNumber('1/2')).toBe(0.5)
    expect(parseNumber('½')).toBe(0.5)
  })
  it('takes the midpoint of a range', () => {
    expect(parseNumber('2-3')).toBe(2.5)
  })
})

describe('splitComponents', () => {
  it('splits on commas and plus signs', () => {
    expect(splitComponents('50 g paine int, 100 g humus + legume')).toEqual([
      '50 g paine int', '100 g humus', 'legume',
    ])
  })

  it('keeps parenthetical groups whole', () => {
    // The inner commas describe one dish, not three components.
    expect(splitComponents('pasta de ton (135 g ton, 50 g branza, ceapa), 40 g paine'))
      .toEqual(['pasta de ton (135 g ton, 50 g branza, ceapa)', '40 g paine'])
  })

  it('treats a comma between digits as a decimal point', () => {
    // "iaurt 1,5-3,5%" is one component. Splitting it produced junk terms
    // like "5 3" and "5" before this was handled.
    expect(splitComponents('150 g iaurt 1,5-3,5%')).toEqual(['150 g iaurt 1,5-3,5%'])
  })
})

describe('detectState', () => {
  it('marks grains weighed uncooked as dry', () => {
    // 50 g of dry bulgur is roughly three times 50 g of cooked bulgur.
    expect(detectState('50 g bulgur nefiert')).toBe('dry')
    expect(detectState('40 g linte nefiarta')).toBe('dry')
  })

  it('marks meat weighed uncooked as raw', () => {
    expect(detectState('100 g piept de pui crud')).toBe('raw')
    expect(detectState('300 g cartofi dulci cruzi')).toBe('raw')
  })

  it('reads the Hungarian marker', () => {
    expect(detectState('50 g teljes kiorlesu laska nyersen')).toBe('dry')
  })

  it('treats grains as dry by default, since that is how the plans weigh them', () => {
    expect(detectState('40 g fulgi de ovaz')).toBe('dry')
  })

  it('leaves foods with no marker unstated', () => {
    expect(detectState('50 g telemea')).toBeUndefined()
  })
})

describe('parseFragment', () => {
  it('reads an explicit weight and strips the state word from the term', () => {
    const r = parseFragment('100 g piept de pui crud')
    expect(r.grams).toBe(100)
    expect(r.term).toBe('piept de pui')
    expect(r.state).toBe('raw')
    expect(r.estimated).toBe(false)
  })

  it('reads millilitres as grams', () => {
    expect(parseFragment('330 ml kefir').grams).toBe(330)
  })

  it('converts Romanian spoon measures', () => {
    expect(parseFragment('o lingurita de ulei de masline').grams).toBe(5)
    expect(parseFragment('2 lg de iaurt').grams).toBe(30)
  })

  it('converts Hungarian spoon measures', () => {
    expect(parseFragment('1 tk. olivaolaj').grams).toBe(5)
    expect(parseFragment('1 ek. olivaolaj').grams).toBe(15)
  })

  it('resolves the vague portions the plans use freely', () => {
    expect(parseFragment('jumatate de farfurie de legume').grams).toBe(150)
    expect(parseFragment('fel tanyer zoldseg').grams).toBe(150)
    expect(parseFragment('salata de cruditati').grams).toBe(200)
  })

  it('weighs countable items', () => {
    expect(parseFragment('1 mar').grams).toBe(150)
    expect(parseFragment('1 alma').grams).toBe(150)
  })

  it('marks estimated quantities as estimated', () => {
    expect(parseFragment('o lingurita de ulei').estimated).toBe(true)
    expect(parseFragment('50 g telemea').estimated).toBe(false)
  })
})

describe('normaliseTerm', () => {
  it('matches across diacritics, so Romanian spellings collapse together', () => {
    expect(normaliseTerm('pâine integrală')).toBe(normaliseTerm('paine integrala'))
    expect(normaliseTerm('țelină')).toBe('telina')
  })
})
