import type { Nutrients, Targets } from '../../types'

/**
 * What has been had of each macro, against its target. Only what was ticked:
 * the same "so far" as the day card beside it.
 */
export default function MacrosSoFar({ had, targets, className = '' }: {
  had: Nutrients
  targets: Targets
  className?: string
}) {
  const rows = [
    { label: 'Protein', value: had.protein, target: targets.protein },
    { label: 'Carbs', value: had.carbs, target: targets.carbs },
    { label: 'Fat', value: had.fat, target: targets.fat },
    { label: 'Fibre', value: had.fiber ?? 0, target: targets.fiber },
  ].filter((r) => r.target && r.target > 0)

  if (!rows.length) return null

  return (
    <section aria-labelledby="macros-h" className={`bg-paper border border-border-200 rounded-card px-[18px] py-4 ${className}`}>
      <h2 id="macros-h" className="text-base leading-6 font-extrabold text-ink-900 mb-2.5">Macros so far</h2>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const pct = Math.min(100, (r.value / (r.target ?? 1)) * 100)
          return (
            <li key={r.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-[13px]">
                <span className="font-bold text-ink-900">{r.label}</span>
                <span className="text-ink-700">
                  <span className="font-extrabold text-ink-900 tabular-nums">{Math.round(r.value)} g</span> of {Math.round(r.target ?? 0)} g
                </span>
              </div>
              <div className="h-2 rounded-full bg-border-100 overflow-hidden" aria-hidden="true">
                <div className="h-2 bg-leaf-500" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
