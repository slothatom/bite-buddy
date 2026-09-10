import { useEffect } from 'react'
import { WeekTemplates } from 'bite-buddy'

/**
 * A planned week and two saved ones.
 *
 * Both live in a store the preview cannot reach directly: a preview module is
 * compiled apart from the bundle, so importing the store here would give a
 * second copy of it that the shipped component has never heard of. Browser
 * storage is the way in, since that is what the stores read on the way up.
 * They read it once, before this file runs, so the first view of a card puts
 * the fixture in and reads the page again; every view after that finds it
 * already there, and the key is pinned so the app's own writes cannot take it
 * back out.
 */
const KEY = 'bite-buddy-mealplan-v2'

/** The week on screen: Monday to Sunday, four of the days planned. */
const WEEK = [
  '2024-05-13', '2024-05-14', '2024-05-15', '2024-05-16',
  '2024-05-17', '2024-05-18', '2024-05-19',
]

/** A week nobody has touched. */
const EMPTY_WEEK = [
  '2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06',
  '2024-06-07', '2024-06-08', '2024-06-09',
]

const SEED = JSON.stringify({
  version: 4,
  state: {
    plan: WEEK.slice(0, 4).map((date) => ({
      date,
      updatedAt: '2024-05-12T19:30:00.000Z',
      meals: ['breakfast', 'lunch', 'dinner'].map((slot) => ({
        id: `${date}-${slot}`,
        slot,
        entries: [],
      })),
    })),
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
} catch { /* a browser with no storage gets the empty states, which are real too */ }

/**
 * A box the size of the screen this covers.
 *
 * The card wraps each cell in a `transform`, which makes that wrapper the
 * containing block for anything `fixed`, so the dialog needs a box to be
 * full-screen against or it comes out flat.
 */
function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ height: 760 }}>{children}</div>
}

/** Presses the first button with this wording, once the dialog is up. */
function Press({ label }: { label: string }) {
  useEffect(() => {
    const id = setTimeout(() => {
      const buttons = [...document.querySelectorAll('button')]
      buttons.find((b) => b.textContent?.trim() === label)?.click()
    }, 0)
    return () => clearTimeout(id)
  }, [label])
  return null
}

/**
 * The resting state: save the week you are on, or drop one you kept earlier.
 *
 * Saving is offered first because you arrive here from a week you have just
 * finished planning far more often than from an empty one, and the field is
 * pre-filled with the week it came from rather than with "Saved week".
 */
export function SavedWeeks() {
  return (
    <Screen>
      <WeekTemplates weekDates={WEEK} onClose={() => {}} />
    </Screen>
  )
}

/**
 * The second tap, which is the part worth looking at.
 *
 * Applying replaces the week rather than merging into it, so what it costs is
 * counted before anything happens and counted again on the button itself.
 */
export function AboutToReplace() {
  return (
    <Screen>
      <WeekTemplates weekDates={WEEK} onClose={() => {}} />
      <Press label="Use it" />
    </Screen>
  )
}

/**
 * The same dialog opened on a week nobody has planned yet.
 *
 * There is nothing to save, so the field and its button are replaced by a line
 * saying so rather than left there to fail.
 */
export function AWeekWithNothingOnIt() {
  return (
    <Screen>
      <WeekTemplates weekDates={EMPTY_WEEK} onClose={() => {}} />
    </Screen>
  )
}
