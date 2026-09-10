import { ChipRow } from 'bite-buddy'

const CATEGORIES = [
  '🥬 Vegetables', '🍎 Fruit', '🌾 Grains', '🥛 Dairy', '🫘 Legumes', '🐟 Fish',
  '🍗 Poultry', '🥩 Meat', '🥚 Eggs', '🥜 Nuts', '🫒 Oils', '🌿 Herbs',
  '🍯 Sweets', '☕ Drinks', '🧂 Store cupboard',
]

/**
 * The Foods filter row, collapsed to its first six.
 *
 * Fifteen categories is 1,578px of chips. The toggle at the end is the part
 * worth looking at: it is the only thing on screen that says the other nine
 * exist.
 */
export function CollapsedToSix() {
  return (
    <div style={{ width: 560 }}>
      <ChipRow initial={6}>
        {CATEGORIES.map((c) => (
          <button key={c} className="chip-off">{c}</button>
        ))}
      </ChipRow>
    </div>
  )
}

/**
 * The active chip ordered to the front.
 *
 * Callers sort the live filter into the first `initial` themselves, because a
 * filter hidden behind "+9 more" is a screen quietly showing you a subset with
 * no way to tell.
 */
export function ActiveChipLeads() {
  const chosen = '🫘 Legumes'
  const ordered = [...CATEGORIES].sort((a, b) => Number(b === chosen) - Number(a === chosen))
  return (
    <div style={{ width: 560 }}>
      <ChipRow initial={6}>
        {ordered.map((c) => (
          <button key={c} className={c === chosen ? 'chip-on' : 'chip-off'}>{c}</button>
        ))}
      </ChipRow>
    </div>
  )
}

/** Fewer chips than the limit, so there is nothing to hide and no toggle. */
export function NothingToHide() {
  return (
    <div style={{ width: 560 }}>
      <ChipRow initial={6}>
        <button className="chip-on">Breakfast</button>
        <button className="chip-off">Lunch</button>
        <button className="chip-off">Dinner</button>
        <button className="chip-off">Snacks</button>
      </ChipRow>
    </div>
  )
}

/**
 * The same row in a narrow column, where it wraps rather than scrolling away.
 *
 * This is the case the component exists for: on a phone these used to run
 * sideways off the screen with about three of them visible.
 */
export function WrappedNarrow() {
  return (
    <div style={{ width: 300 }}>
      <ChipRow initial={8}>
        {CATEGORIES.map((c) => (
          <button key={c} className="chip-off">{c}</button>
        ))}
      </ChipRow>
    </div>
  )
}
