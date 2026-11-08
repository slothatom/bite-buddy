import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { Targets } from '../../types'

/**
 * Targets typed in by hand.
 *
 * Its own component so the draft in the fields lives with the fields. Held in
 * the parent it survived every re-render of the whole settings screen, which
 * is how a half-typed figure used to reappear after saving.
 */
export function ManualTargets({
  initial, onSave,
}: {
  initial: Targets
  onSave: (targets: Targets) => void
}) {
  const [manual, setManual] = useState<Targets>(initial)

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Pencil size={18} className="text-bite-700 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <h3 className="font-semibold text-ink-900 text-sm">Or set them yourself</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([
              ['calories', 'kcal'], ['protein', 'Protein'], ['carbs', 'Carbs'],
              ['fat', 'Fat'], ['fiber', 'Fibre'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min={0} className="input px-2"
                  value={manual[key] ?? 0}
                  onChange={(e) => setManual({ ...manual, [key]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => onSave({ ...manual, source: 'manual' })}>
            Save targets
          </button>
        </div>
      </div>
    </div>
  )
}
