import { FillGaps } from 'bite-buddy'

/**
 * A week whose days are already full, so the "nothing to fill" state is a
 * fact rather than an assertion.
 *
 * The plan lives in a store the preview cannot reach directly: a preview
 * module is compiled apart from the bundle, so importing the store here would
 * give a second copy of it that the shipped component has never heard of.
 * Browser storage is the way in, since that is what the stores read on the way
 * up. They read it once, before this file runs, so the first view of a card
 * puts the fixture in and reads the page again; every view after that finds it
 * already there, and the key is pinned so the app's own writes cannot take it
 * back out.
 *
 * The recipes the suggestions come from need no fixture at all: the library
 * ships inside the app.
 */
const KEY = 'bite-buddy-mealplan-v2'

const FULL = ['2024-05-27', '2024-05-28', '2024-05-29']

const SEED = JSON.stringify({
  version: 4,
  state: {
    templates: [],
    plan: FULL.map((date) => ({
      date,
      updatedAt: '2024-05-14T08:00:00.000Z',
      meals: ['breakfast', 'lunch', 'dinner'].map((slot) => ({
        id: `${date}-${slot}`,
        slot,
        entries: [],
      })),
    })),
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
} catch { /* a browser with no storage gets an empty plan, which is a fair state too */ }

/**
 * A box the size of the screen this covers.
 *
 * The card wraps each cell in a `transform`, which makes that wrapper the
 * containing block for anything `fixed`. Without a box of its own the dialog
 * would have nothing to be full-screen against and would come out flat.
 */
function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ height: 760 }}>{children}</div>
}

/**
 * What it is for: four empty days answered from your own library, each with a
 * reason you can check and an X to drop it.
 *
 * Nothing is written until the button at the bottom, and the button counts
 * what is left after the ones you have dropped.
 */
export function AWeekOffered() {
  return (
    <Screen>
      <FillGaps
        dates={['2024-05-16', '2024-05-17', '2024-05-18', '2024-05-19']}
        onClose={() => {}}
        onApply={() => {}}
      />
    </Screen>
  )
}

/**
 * The days asked about have already been and gone.
 *
 * One of three situations that used to arrive at the same sentence, "every
 * meal on these days already has something in it", which was untrue in two of
 * them. Nobody cooks last Tuesday.
 */
export function DaysThatHaveGone() {
  return (
    <Screen>
      <FillGaps
        dates={['2024-05-06', '2024-05-07', '2024-05-08', '2024-05-09']}
        onClose={() => {}}
        onApply={() => {}}
      />
    </Screen>
  )
}

/** Days still ahead, with every fillable slot on them already taken. */
export function NothingToFill() {
  return (
    <Screen>
      <FillGaps dates={FULL} onClose={() => {}} onApply={() => {}} />
    </Screen>
  )
}
