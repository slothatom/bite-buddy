import { useMemo, useState } from 'react'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useDialog } from '../../lib/useDialog'
import WhenPicker from './WhenPicker'
import { formatDate } from '../../lib/planner/format'

/**
 * Copying a whole day onto another one.
 *
 * The same picker as everything else, without the slot, because a day carries
 * its own slots with it. It used to be a list of every date in the range, one
 * per row, which in month view was 42 rows of 1,452 px inside a 1,110 px
 * overlay: the heading was off the top and Cancel was off the bottom, with no
 * way to scroll to either.
 */
export function CopyDayDialog({
  from, onClose, onPick,
}: {
  from: string
  onClose: () => void
  onPick: (to: string) => void
}) {
  const plan = useMealPlanStore((s) => s.plan)
  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )
  const panel = useDialog<HTMLDivElement>(onClose)
  const [to, setTo] = useState<string | null>(null)

  // What it would land on, said before it lands. Copying onto a day that
  // already has meals is a legitimate thing to want and a horrible surprise.
  const onto = to ? plan.find((d) => d.date === to)?.meals.length ?? 0 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Copy a day"
        className="bg-paper rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink-900 mb-1">Copy {formatDate(from)}</h3>
        <p className="text-sm text-ink-700 mb-4">Pick the day to copy these meals into.</p>

        <WhenPicker
          date={to ?? from}
          onDate={setTo}
          busy={busy}
          disabled={(d) => d === from}
        />

        {onto > 0 && (
          <p className="text-sm text-coral-700 mt-4">
            That day already has {onto} {onto === 1 ? 'meal' : 'meals'} on it, and they would be
            replaced.
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!to}
            onClick={() => to && onPick(to)}
          >
            Copy it there
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
