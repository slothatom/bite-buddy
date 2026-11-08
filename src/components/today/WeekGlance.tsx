import { Link } from 'react-router-dom'
import { AlertTriangle, Check } from 'lucide-react'
import type { Nutrients } from '../../types'
import { targetStatus, STATUS_STYLES } from '../../lib/status'

/**
 * The week you are in, a column a day: what each came to, against the target.
 *
 * What each day came to rather than what was hoped for it, the same rule as the
 * day card above: a day ticked off counts what was had, a day ahead counts its
 * plan. Under it, the two things the old tiles said about the week, how much
 * of it is planned and how much of the guide it keeps to.
 */
export default function WeekGlance({
  days, today, target, plannedDays, average, guide,
}: {
  days: { date: string; nutrients: Nutrients; recorded: boolean }[]
  today: string
  target: number
  plannedDays: number
  average: number
  guide: { met: number; of: number }
}) {
  return (
    <section aria-labelledby="week-h" className="flex flex-col gap-1.5 lg:gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="week-h" className="text-base leading-6 font-extrabold text-ink-900">This week at a glance</h2>
        <Link to="/progress" className="text-[13px] font-bold text-bite-700 hover:underline min-h-11 lg:min-h-0 flex items-center">
          See progress
        </Link>
      </div>
      <ul className="bg-paper border border-border-200 rounded-card overflow-hidden grid grid-cols-7">
        {days.map(({ date, nutrients, recorded }, i) => {
          const kcal = Math.round(nutrients.calories)
          const isToday = date === today
          const status = targetStatus(kcal, target)
          const when = new Date(date + 'T12:00:00')
          const name = when.toLocaleDateString('en-GB', { weekday: 'short' })
          const long = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
          const width = target > 0 ? Math.min(100, (kcal / target) * 100) : 0
          const pill = isToday
            ? { cls: 'bg-bite-100 text-bite-700', text: 'Today', icon: null }
            : !kcal
              ? { cls: 'bg-cream-50 text-ink-700', text: 'Empty', icon: null }
              : status.level === 'on-track' || status.level === 'none'
                ? { cls: `${STATUS_STYLES['on-track'].surface} ${STATUS_STYLES['on-track'].text}`, text: 'On track', icon: 'check' as const }
                : { cls: `${STATUS_STYLES[status.level].surface} ${STATUS_STYLES[status.level].text}`, text: `+ ${status.delta}`, icon: status.level === 'over' ? 'alert' as const : null }
          return (
            <li
              key={date}
              aria-label={`${long}: ${kcal.toLocaleString('en-GB')} kcal${kcal ? (recorded ? ', recorded' : ', planned') : ''}, ${pill.text.toLowerCase()}`}
              className={`min-w-0 px-1 sm:px-2 py-2.5 flex flex-col gap-1.5 items-center sm:items-start
                          ${i ? 'border-l border-border-100' : ''} ${isToday ? 'bg-bite-50' : ''}`}
            >
              <span aria-hidden="true" className={`text-xs font-bold ${isToday ? 'text-bite-700' : 'text-ink-700'}`}>
                {name}<span className="hidden sm:inline"> {when.getDate()}</span>
              </span>
              <span aria-hidden="true" className="text-xs sm:text-[15px] font-extrabold text-ink-900 tabular-nums">
                {kcal.toLocaleString('en-GB')}
              </span>
              <span aria-hidden="true" className="w-full h-1.5 rounded-full bg-border-100 overflow-hidden flex">
                <span className={kcal ? STATUS_STYLES[status.level === 'none' ? 'on-track' : status.level].fill : ''} style={{ width: `${width}%` }} />
              </span>
              <span aria-hidden="true" className={`hidden xl:inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-xs leading-4 font-bold whitespace-nowrap ${pill.cls}`}>
                {pill.icon === 'check' && <Check size={12} strokeWidth={3} />}
                {pill.icon === 'alert' && <AlertTriangle size={12} />}
                {pill.text}
              </span>
              {/* Narrow columns keep the meaning as a mark rather than a word. */}
              <span aria-hidden="true" className={`xl:hidden text-xs font-extrabold leading-none h-3 ${
                isToday ? 'text-bite-700' : kcal ? STATUS_STYLES[status.level].text : 'text-ink-500'}`}>
                {isToday ? '•' : kcal ? (status.symbol || '✓') : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-700 px-1">
        <p>
          <strong className="text-ink-900 tabular-nums">{plannedDays}</strong> of {days.length} days planned
          {plannedDays > 0 && <>, averaging <strong className="text-ink-900 tabular-nums">{average.toLocaleString('en-GB')}</strong> kcal</>}
          <span aria-hidden="true" className="hidden xl:inline"> ·</span>
        </p>
        <Link to="/progress" className="min-h-11 xl:min-h-0 inline-flex items-center text-bite-700 font-bold hover:underline">
          Mediterranean:&nbsp;<span className="tabular-nums">{guide.met} of {guide.of}</span>&nbsp;goals reached
        </Link>
      </div>
    </section>
  )
}
