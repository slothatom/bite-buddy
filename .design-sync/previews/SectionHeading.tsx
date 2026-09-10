import { SectionHeading } from 'bite-buddy'

/** The plain case: a word or two over the card it names. */
export function OverACard() {
  return (
    <div style={{ width: 420 }}>
      <SectionHeading>Today</SectionHeading>
      <div className="card p-4">
        <p className="text-sm text-ink-700">
          Breakfast, Lunch and Dinner planned. Snacks still empty.
        </p>
      </div>
    </div>
  )
}

/**
 * A count riding along with the heading rather than under it.
 *
 * The children are a whole node, so a quiet figure can sit beside the words
 * without a second line and without shrinking the heading itself.
 */
export function WithACount() {
  return (
    <div style={{ width: 420 }}>
      <SectionHeading>
        Recent sessions
        <span className="ml-2 text-sm font-normal text-ink-500">184 min across 4</span>
      </SectionHeading>
      <div className="card p-4">
        <p className="text-sm text-ink-700">Walk, 52 min · Wednesday</p>
      </div>
    </div>
  )
}

/**
 * The `action` slot, which pins a control to the right of the heading.
 *
 * Anything can go in it. A button is the usual thing, and it stays on the
 * heading's baseline rather than pushing the section down a row.
 */
export function WithAnAction() {
  return (
    <div style={{ width: 420 }}>
      <SectionHeading action={<button className="btn-secondary">Fill the gaps</button>}>
        This week
      </SectionHeading>
      <div className="card p-4">
        <p className="text-sm text-ink-700">4 of 7 days planned, averaging 1,712 kcal.</p>
      </div>
    </div>
  )
}

/**
 * A grocery category heading, emoji and all.
 *
 * The children carry their own layout here, so the heading has to take a flex
 * row without the emoji knocking the text off centre.
 */
export function WithACategoryIcon() {
  return (
    <div style={{ width: 420 }}>
      <SectionHeading>
        <span className="flex items-center gap-2 text-base">🥬 Vegetables</span>
      </SectionHeading>
      <div className="card p-4">
        <p className="text-sm text-ink-700">Telină, morcovi, pătrunjel, ceapă</p>
      </div>
    </div>
  )
}
