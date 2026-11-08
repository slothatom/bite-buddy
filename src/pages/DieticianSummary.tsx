import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
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

/**
 * A summary to take to the dietician.
 *
 * Pick a stretch and a person, read it here, then download it as a single
 * HTML file or print it (and save as PDF from the print dialog). The page is
 * built by lib/export, which uses the app's own rules for what a day came to,
 * which figures are a floor and how the Mediterranean goals are scored, so
 * nothing on it disagrees with the screens it summarises.
 *
 * Everything above the summary itself is marked `data-print-hide`; the print
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

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header data-print-hide className="space-y-1">
          <Link to="/progress" className="inline-flex items-center gap-1 text-sm font-semibold text-bite-700 hover:underline min-h-11">
            <ArrowLeft size={15} /> Progress
          </Link>
          <h1 className="display text-xl sm:text-2xl text-ink-900">For your dietician</h1>
          <p className="text-sm text-ink-700">
            What was eaten and skipped, the day's figures against your target, the Mediterranean
            servings and any weights, ready to print or send.
          </p>
        </header>

        <section data-print-hide className="card p-4 space-y-4">
          <div>
            <p className="label" id="summary-span">Which days</p>
            <div className="flex flex-wrap gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist" aria-labelledby="summary-span">
              {(Object.keys(EXPORT_SPAN_LABELS) as ExportSpan[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={span === s}
                  onClick={() => setSpan(s)}
                  className={span === s ? 'tab-on' : 'tab-off'}
                >
                  {EXPORT_SPAN_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {span === 'custom' && (
            <div className="grid grid-cols-2 gap-3 max-w-sm">
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
            <div>
              <p className="label" id="summary-person">Whose</p>
              <div className="flex flex-wrap gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist" aria-labelledby="summary-person">
                {people.map((p) => (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={personId === p.id}
                    onClick={() => setWho(p.id)}
                    className={personId === p.id ? 'tab-on' : 'tab-off'}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-primary" onClick={onDownload}>
              <Download size={15} /> Download
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print / Save as PDF
            </button>
          </div>
          {status && <p role="status" className="text-sm text-ink-700">{status}</p>}
        </section>

        {/* The summary itself: the same markup the downloaded file carries,
            built and escaped in lib/export/html.ts. */}
        <style>{SUMMARY_CSS}</style>
        <div data-print-root className="card p-4 sm:p-6" dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  )
}
