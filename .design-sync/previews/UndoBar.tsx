import { useEffect } from 'react'
import { UndoBar, WeekTemplates } from 'bite-buddy'

/**
 * How this cell gets an offer to show.
 *
 * The bar renders nothing until something has been deleted, and the slot it
 * reads lives in a store the preview cannot reach: a preview module is
 * compiled separately from the bundle, so importing the store here would give
 * a second copy of it that the shipped `UndoBar` has never heard of. What it
 * can do is delete something for real, through a component that is in the
 * bundle, and let the store fill itself in. `WeekTemplates` is that component:
 * forgetting a saved week is one of the deletions this bar exists for.
 *
 * The saved weeks themselves are seeded into browser storage, which the stores
 * read once, before this file runs. So the first view of a card puts the
 * fixture in and reads the page again; every view after that finds it already
 * there, and the key is pinned so the app's own writes cannot take it back out.
 */
const KEY = 'bite-buddy-mealplan-v2'

const SEED = JSON.stringify({
  version: 4,
  state: {
    plan: [],
    templates: [
      {
        id: 'week-batch',
        name: 'Batch cook week',
        savedAt: '2024-04-29T18:12:00.000Z',
        days: [0, 1, 2, 3, 4].map((offset) => ({
          offset,
          meals: [{ slot: 'lunch', entries: [] }, { slot: 'dinner', entries: [] }],
        })),
      },
      {
        id: 'week-shift',
        name: 'Oli on shifts, everything cold and portable',
        savedAt: '2024-05-06T20:40:00.000Z',
        days: [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
          offset,
          meals: [{ slot: 'breakfast', entries: [] }, { slot: 'lunch', entries: [] }],
        })),
      },
    ],
  },
})

try {
  const seeded = localStorage.getItem(KEY) === SEED
  localStorage.setItem(KEY, SEED)
  if (!seeded) {
    location.reload()
  } else {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k !== KEY) write.call(this, k, v)
    }
  }
} catch { /* a browser with no storage gets the resting state, which is nothing */ }

/**
 * Forgets one saved week, out of sight.
 *
 * The dialog is what does the deleting, not what is being previewed, so it is
 * kept out of the picture. A button in a hidden subtree still takes a click.
 */
function Forget({ name }: { name: string }) {
  useEffect(() => {
    const id = setTimeout(() => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Forget ${name}"]`)?.click()
    }, 0)
    return () => clearTimeout(id)
  }, [name])

  return (
    <div style={{ display: 'none' }}>
      <WeekTemplates weekDates={['2024-05-13']} onClose={() => {}} />
    </div>
  )
}

/**
 * The week the bar sits over, so the slab has a page to be transient against.
 *
 * Tall on purpose. The card wraps each cell in a `transform`, which makes that
 * wrapper the containing block for anything `fixed`, so the bar lands a
 * thumb's reach from the bottom of this box rather than of the window.
 */
function Screen() {
  return (
    <div style={{ height: 600 }}>
      <div style={{ width: 520 }}>
        <h1 className="display text-xl text-ink-900">Saved weeks</h1>
        <p className="text-sm text-ink-700 mt-1">A week you eat often, ready to drop on another one.</p>
        <div className="card p-4 mt-4">
          <p className="text-sm font-semibold text-ink-900">Week of 6 May</p>
          <p className="text-xs text-ink-500 mt-0.5">14 meals across 7 days</p>
        </div>
      </div>
    </div>
  )
}

/**
 * The offer as it stands: what happened in the past tense, naming the thing,
 * and a drain bar rather than a ticking number.
 */
export function AnOfferStanding() {
  return (
    <>
      <Screen />
      <Forget name="Batch cook week" />
      <UndoBar />
    </>
  )
}

/**
 * A sentence long enough to wrap.
 *
 * Worth looking at because the wording is whatever the deletion called the
 * thing, which can be as long as somebody's own name for a week, and Undo has
 * to keep its size and stay reachable when it is.
 */
export function ALongerSentence() {
  return (
    <>
      <Screen />
      <Forget name="Oli on shifts, everything cold and portable" />
      <UndoBar />
    </>
  )
}
