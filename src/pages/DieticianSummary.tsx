import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useMealPlanStore, today as todayDate } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useUiStore } from '../store/useUiStore'
import { useBodyStore } from '../store/useBodyStore'
import { usePeople, useResolvedPerson } from '../store/useHousehold'
import { useNutritionContext } from '../store/useNutrition'
import { personName } from '../lib/people'
import { EXPORT_SPAN_LABELS, spanDates, type ExportSpan } from '../lib/export/range'
import { buildSummary } from '../lib/export/summary'
import { SUMMARY_CSS, summaryBody, summaryDocument, summaryFilename } from '../lib/export/html'
import { saveTextFile } from '../lib/download'
import ProgressHeader from '../components/progress/ProgressHeader'
import { PersonAvatar } from '../components/ui/PersonAvatar'

/**
 * A summary to take to the dietician.
 *
 * Pick a stretch and a person, read it here, then download it as a single
 * HTML file or print it (and save as PDF from the print dialog). The page is
 * built by lib/export, which uses the app's own rules for what a day came to,
 * which figures are a floor and how the Mediterranean goals are scored, so
 * nothing on it disagrees with the screens it summarises.
 *
 * Everything around the summary itself is marked `data-print-hide`; the print
 * stylesheet in index.css prints only the summary.
 */
export default function DieticianSummary() {
  const plan = useMealPlanStore((s) => s.plan)
  const { profile } = useUserStore()
  const weights = useBodyStore((s) => s.weightEntries)
  const people = usePeople()
  const viewing = useResolvedPerson(useUiStore((s) => s.viewingAs))
  const ctx = useNutritionContext()
  const today = todayDate()

  const [span, setSpan] = useState<ExportSpan>('this-week')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [who, setWho] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const personId = who && people.some((p) => p.id === who) ? who : viewing
  const person = useMemo(
    // A copy on its own has one person called "Me", which is not a name to
    // put at the top of something a dietician reads, so the profile's is used.
    () => ({
      id: personId,
      name: people.length <= 1 && profile.name.trim() ? profile.name.trim() : personName(people, personId),
    }),
    [people, personId, profile.name],
  )

  const dates = useMemo(
    () => spanDates(span, { today, weekStartsOn: profile.weekStartsOn, from, to }),
    [span, today, profile.weekStartsOn, from, to],
  )

  const summary = useMemo(() => buildSummary({
    dates, plan, ctx, targets: profile.targets, person, weights,
    weightUnit: profile.weightUnit, generatedOn: today,
  }), [dates, plan, ctx, profile.targets, person, weights, profile.weightUnit, today])

  const body = useMemo(() => summaryBody(summary), [summary])

  async function onDownload() {
    const outcome = await saveTextFile(summaryFilename(summary), summaryDocument(summary), 'text/html')
    setStatus(
      outcome === 'saved' ? 'Summary saved.'
        : outcome === 'declined' ? 'Save cancelled.'
          : "This browser wouldn't save the file. Try Print instead and save it as a PDF.",
    )
  }

  // The same two actions in two places: in the header from md up, as the
  // mockup has them, and under the summary on a phone, where a thumb is.
  const download = (label: string, className: string) => (
    <button className={className} onClick={onDownload}>
      <Download size={15} /> {label}
    </button>
  )
  const print = (className: string) => (
    <button className={className} onClick={() => window.print()}>
      <Printer size={15} /> Print or save as PDF
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl md:max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-3 md:pt-6 space-y-3 md:space-y-4">
        <ProgressHeader
          subtitle="For your dietician, ready to send"
          actions={<>{print('btn-secondary')}{download('Export summary', 'btn-primary')}</>}
        />

        <div className="grid gap-3 md:gap-4 md:grid-cols-[300px_minmax(0,1fr)] md:items-start">
          <section
            data-print-hide
            aria-labelledby="pick-h"
            className="card p-4 md:p-[18px] flex flex-col gap-3 md:gap-[18px]"
          >
            <h2 id="pick-h" className="sr-only md:not-sr-only text-base font-extrabold text-ink-900">What to show</h2>

            <div className="flex flex-col gap-1.5">
              <span id="summary-span" className="text-xs md:text-[13px] font-bold text-ink-700">Which days</span>
              <div
                role="group"
                aria-labelledby="summary-span"
                className="grid grid-cols-3 gap-1 p-1 bg-border-100 rounded-lg"
              >
                {(Object.keys(EXPORT_SPAN_LABELS) as ExportSpan[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={span === s}
                    onClick={() => setSpan(s)}
                    className={`${span === s ? 'segment-on' : 'segment-off'} px-2`}
                  >
                    {EXPORT_SPAN_LABELS[s]}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-700">{spanLine(dates)}</span>
            </div>

            {span === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="summary-from">From</label>
                  <input id="summary-from" type="date" className="input" value={from}
                    onChange={(e) => setFrom(e.target.value || today)} />
                </div>
                <div>
                  <label className="label" htmlFor="summary-to">To</label>
                  <input id="summary-to" type="date" className="input" value={to}
                    onChange={(e) => setTo(e.target.value || today)} />
                </div>
              </div>
            )}

            {/* Only asked when there is somebody to choose between. The food is
                the household's; the weights and the name on the page are not. */}
            {people.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <span id="summary-person" className="text-xs md:text-[13px] font-bold text-ink-700">Whose</span>
                <div role="group" aria-labelledby="summary-person" className="flex flex-wrap gap-1.5">
                  {people.map((p, i) => {
                    const on = personId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setWho(p.id)}
                        className={`flex-1 inline-flex items-center gap-2 min-h-11 md:min-h-10 pl-2 pr-3 rounded-full border text-sm ${
                          on ? 'border-bite-700 bg-bite-100 text-bite-700 font-extrabold'
                            : 'border-border-200 bg-paper text-ink-900 font-bold'}`}
                      >
                        <PersonAvatar person={p} index={i} className="w-6 h-6 text-xs" />
                        {p.name}
                      </button>
                    )
                  })}
                </div>
                <span className="text-xs text-ink-700">
                  The food is shared. Weights and targets are {person.name}{'’'}s.
                </span>
              </div>
            )}

            <p className="hidden md:block pt-3 border-t border-border-100 text-xs text-ink-700">
              Export saves one file you can email or print. Nothing is sent from here.
            </p>
          </section>

          <div className="space-y-3 min-w-0">
            {/* The summary itself: the same markup the downloaded file carries,
                built and escaped in lib/export/html.ts. */}
            <style>{SUMMARY_CSS}</style>
            <div data-print-root className="card p-4 sm:p-6" dangerouslySetInnerHTML={{ __html: body }} />

            <div data-print-hide className="flex gap-2 md:hidden">
              {download('Download', 'btn-primary flex-1 min-h-12')}
              {print('btn-secondary min-h-12')}
            </div>
            {status && <p data-print-hide role="status" className="text-sm text-ink-700">{status}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/** "12 Oct to 8 Nov 2026, 28 days". */
function spanLine(dates: string[]): string {
  if (!dates.length) return ''
  const fmt = (d: string, year: boolean) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}),
  })
  const a = dates[0]
  const b = dates[dates.length - 1]
  const days = `${dates.length} ${dates.length === 1 ? 'day' : 'days'}`
  return a === b
    ? `${fmt(a, true)}, ${days}`
    : `${fmt(a, a.slice(0, 4) !== b.slice(0, 4))} to ${fmt(b, true)}, ${days}`
}
