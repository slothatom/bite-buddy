/**
 * Each person's colour, the same on every screen and every device.
 *
 * Fixed rather than chosen: there is no colour picker and no column for one.
 * The two original people keep theirs by key, so Arany is turquoise and Oli
 * is mustard whichever order the household lists them in; anybody else takes
 * the colour for their place in the household.
 *
 * The text on every fill is `on-brand`, a literal dark green that does not
 * invert. `ink-900` turns nearly white after dark, which on mustard would be
 * unreadable. Each string names its fill and its ink together so
 * `npm run check:contrast` measures the pair.
 */
const TONES = [
  'bg-bite-500 text-on-brand',
  'bg-mustard-500 text-on-brand',
  'bg-coral-300 text-on-brand',
  'bg-leaf-300 text-on-brand',
] as const

const BY_KEY: Readonly<Record<string, number>> = { arany: 0, oli: 1 }

/** Classes for a person's avatar: their fill and the ink on it. */
export function personTone(personKey: string, index = 0): string {
  const slot = BY_KEY[personKey] ?? index
  return TONES[((slot % TONES.length) + TONES.length) % TONES.length]
}

/** The letter in the circle: the first letter of the name, else of the key. */
export function personInitial(name: string | undefined, personKey: string): string {
  const source = name?.trim() || personKey
  return (source.match(/\p{L}|\p{N}/u)?.[0] ?? '?').toLocaleUpperCase()
}
