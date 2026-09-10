import { useEffect, useRef, type ReactNode } from 'react'
import { FoodEditor } from 'bite-buddy'

const nothing = () => {}

/*
 * Every cell here sits in a box with a height on it, and one of them starts
 * part-way down the sheet.
 *
 * The height first: the sheet is `position: fixed`, and the card wrapper each
 * story renders into carries a transform, which makes that wrapper the
 * containing block rather than the window. A cell whose only child is fixed is
 * 0px tall and photographs flat.
 *
 * The scroll second: the editor is taller than the card, so `show` puts a named
 * section at the top of the panel's own scroller, which is what a finger does
 * on the way to the numbers. Nothing else about the component is arranged.
 */
function Sheet({ children, show }: { children?: ReactNode; show?: string }) {
  const held = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!show) return
    const body = held.current?.querySelector<HTMLElement>('[role="dialog"] .overflow-y-auto')
    if (!body) return
    const heading = Array.from(body.querySelectorAll<HTMLElement>('p'))
      .find((el) => el.textContent?.trim() === show)
    if (!heading) return
    body.scrollTop += heading.getBoundingClientRect().top - body.getBoundingClientRect().top - 12
  }, [show])
  return <div ref={held} style={{ height: 760 }}>{children}</div>
}

/** One of the 122 foods that ship in code, opened from the Foods screen. */
const telemea = {
  id: 'telemea',
  names: { en: 'Telemea (brined cheese)', ro: 'telemea' },
  aliases: ['telemea', 'telemea razuita'],
  category: 'dairy',
  medTier: 'moderate',
  state: 'as-sold',
  per100g: { calories: 250, protein: 17, carbs: 1, fat: 20, fiber: 0, sodium: 1200 },
  units: [],
  source: 'curated',
}

/** A tub scanned in the shop, with everything Open Food Facts said kept on it. */
const scannedYogurt = {
  id: 'custom-off-5941',
  names: { en: 'Greek yogurt 2%', ro: 'iaurt grecesc 2%', hu: 'görög joghurt 2%' },
  aliases: ['iaurt grecesc', 'gorog joghurt'],
  category: 'dairy',
  medTier: 'daily',
  state: 'as-sold',
  per100g: { calories: 73, protein: 9.1, carbs: 3.9, fat: 2, fiber: 0, sugar: 3.9, sodium: 41 },
  units: [{ label: 'pot', grams: 150 }],
  source: 'off',
  provenance: {
    source: 'off',
    externalId: '5941234500178',
    sourceName: 'Iaurt grecesc 2% grăsime',
    basePortion: { amount: 100, unit: 'g' },
    retrievedAt: '2026-09-04T18:12:00.000Z',
    saltAsGiven: { kind: 'salt', value: 0.1, unit: 'g' },
  },
  createdAt: '2026-09-04T18:12:00.000Z',
}

/** Typed off a bakery label that only stated the four macros. */
const bakeryBread = {
  id: 'custom-mfxq2b',
  names: { en: 'Bakery rye loaf', ro: 'pâine de secară de la brutărie' },
  aliases: ['paine de secara'],
  category: 'grains',
  medTier: 'daily',
  state: 'as-sold',
  per100g: { calories: 232, protein: 7.4, carbs: 44, fat: 1.6 },
  units: [{ label: 'slice', grams: 35 }],
  source: 'custom',
  createdAt: '2026-09-08T07:40:00.000Z',
}

/**
 * A curated food being corrected.
 *
 * The commonest edit in this app: the numbers on the packet in your fridge are
 * not the numbers in the code. Editing one keeps your own copy with the
 * original underneath, which is why the salt line sits under sodium and why
 * Delete is its own button rather than a corner of Save.
 */
export function ACuratedFood() {
  return (
    <Sheet>
      <FoodEditor food={telemea} onClose={nothing} />
    </Sheet>
  )
}

/**
 * A food that came off a barcode, scrolled to its numbers.
 *
 * The provenance card under them is the only one on this sheet, and it is what
 * stops a wrong figure being untraceable: the source, the barcode it was read
 * from, and the date the numbers were fetched, because nutrition data gets
 * revised. Delete sits below it, well away from Save changes.
 */
export function FromABarcode() {
  return (
    <Sheet show="Per 100 g">
      <FoodEditor food={scannedYogurt} onClose={nothing} />
    </Sheet>
  )
}

/**
 * A food whose label said nothing about fibre, sugar or salt.
 *
 * Those three boxes are empty rather than zero, and the salt line under them
 * is absent because there is no sodium to convert. Unknown and none are
 * different claims and the editor has to keep them apart.
 */
export function FiguresNobodyStated() {
  return (
    <Sheet>
      <FoodEditor food={bakeryBread} onClose={nothing} />
    </Sheet>
  )
}
