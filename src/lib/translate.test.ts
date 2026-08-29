import { describe, expect, it } from 'vitest'
import { buildDictionary, toEnglish, coverage } from './translate'
import { FOODS } from '../data/foods'
import { SOURCE_PLANS } from '../data/generated/sourcePlans'

const dict = buildDictionary(FOODS)
const say = (line: string) => toEnglish(line, dict)

describe('reading the dietician in English', () => {
  it('translates a plain weighed line', () => {
    expect(say('200 g capsuni')).toBe('200 g strawberries')
    expect(say('150 g mere, 10 g caju')).toBe('150 g apple, 10 g cashews')
  })

  it('keeps the numbers and the punctuation exactly where they were', () => {
    expect(say('50 g paine int, 100 g humus, legume'))
      .toBe('50 g wholemeal bread, 100 g hummus, vegetables')
  })

  it('reads a dish name as a dish rather than word by word', () => {
    // "salad of raw things" is what a word-at-a-time translation produces.
    expect(say('salata de cruditati')).toBe('Raw vegetable salad')
    expect(say('jumatate de farfurie de legume')).toBe('Half a plate of vegetables')
  })

  it('puts the preparation where English puts it', () => {
    expect(say('40 g bulgur nefiert')).toBe('40 g uncooked bulgur')
    expect(say('50 g quinoa nefiarta')).toBe('50 g uncooked quinoa')
  })

  it('never translates its own output', () => {
    // Substituting in place, "chiamagos puding" became "chia pudding" and then
    // the alias for chia turned that into "chia seeds pudding". Likewise
    // "chili con carne" became "chilli con meat".
    expect(say('chiamagos puding')).toBe('Chia pudding')
    expect(say('chili con carne')).toBe('Chilli con carne')
  })

  it('reads Hungarian as well as Romanian', () => {
    expect(say('1 alma + 10 g dio')).toBe('1 apple + 10 g walnuts')
    // The food database's own name for it, gloss and all, because that is what
    // the food is called on every other screen in the app.
    expect(say('vegyes salata + 50 g telemea + 1 tk. olivaolaj'))
      .toBe('Mixed salad + 50 g telemea (brined cheese) + a teaspoon of olive oil')
  })

  it('leaves a word it does not know exactly as it was written', () => {
    // A visible gap beats a plausible invention: the original is the record,
    // and somebody has to be able to see where the reading stops.
    expect(say('150 g qwertyuiop')).toBe('150 g qwertyuiop')
  })

  it('reads almost all of the archive', () => {
    const seen = new Set<string>()
    const lines: string[] = []
    for (const plan of SOURCE_PLANS) {
      for (const day of plan.days) {
        for (const meal of day.meals) {
          if (meal.text && !seen.has(meal.text)) { seen.add(meal.text); lines.push(meal.text) }
        }
      }
    }

    const { words, untranslated } = coverage(lines, dict)

    expect(words).toBeGreaterThan(2000)
    // Two proper nouns in one Hungarian line. Everything else reads.
    expect(untranslated.length).toBeLessThanOrEqual(4)
  })
})
