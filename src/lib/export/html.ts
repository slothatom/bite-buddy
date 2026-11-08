import { SLOT_LABELS } from '../../types'
import { ESTIMATES_NOTE } from '../estimates'
import { servingCount, IMPLAUSIBLE_RATIO } from '../mediterranean'
import type { DieticianSummary, SummaryDay, SummaryItem, SummaryWeek } from './summary'

/**
 * The dietician summary as HTML, for the screen, the printer and a file.
 *
 * One rendering for all three, so what you check on the phone is what gets
 * printed and what gets sent. The stylesheet reads the app's own colour tokens
 * where they exist and falls back to the light palette's values where they do
 * not, which is the case in a downloaded file opened on its own. Printing
 * always uses the light palette: paper is white whatever the phone is set to.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const tok = (name: string, fallback: string) => `var(--color-${name}, ${fallback})`

export const SUMMARY_CSS = `
.bbs { --bbs-ink: ${tok('ink-900', '#2D2320')}; --bbs-ink-2: ${tok('ink-700', '#514744')};
  --bbs-muted: ${tok('ink-500', '#79706D')}; --bbs-line: ${tok('border-200', '#E6DED5')};
  --bbs-paper: ${tok('paper', '#FFFDF9')}; --bbs-soft: ${tok('cream-50', '#FAF7F0')};
  --bbs-good: ${tok('leaf-700', '#096847')}; --bbs-warn: ${tok('mustard-800', '#8b661a')};
  --bbs-over: ${tok('coral-700', '#ce3a3a')};
  color: var(--bbs-ink); background: var(--bbs-paper);
  font: 500 14px/1.45 'Plus Jakarta Sans Variable', system-ui, sans-serif;
  max-width: 52rem; margin: 0 auto; }
.bbs h1 { font-size: 22px; line-height: 1.2; margin: 0 0 4px; font-weight: 800; }
.bbs h2 { font-size: 16px; margin: 24px 0 8px; font-weight: 800; }
.bbs h3 { font-size: 14px; margin: 0; font-weight: 700; }
.bbs p { margin: 0; }
.bbs .bbs-muted { color: var(--bbs-muted); }
.bbs .bbs-cap { font-size: 12px; color: var(--bbs-muted); }
.bbs .bbs-num { font-variant-numeric: tabular-nums; }
.bbs .bbs-day { border: 1px solid var(--bbs-line); border-radius: 12px; padding: 10px 12px;
  margin: 0 0 8px; break-inside: avoid; page-break-inside: avoid; }
.bbs .bbs-day-head { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline;
  justify-content: space-between; margin-bottom: 6px; }
.bbs ul { list-style: none; margin: 0; padding: 0; }
.bbs .bbs-items li { display: flex; gap: 8px; font-size: 13px; padding: 1px 0; }
.bbs .bbs-slot { flex: 0 0 5.5rem; font-size: 12px; font-weight: 700; color: var(--bbs-muted);
  text-transform: uppercase; letter-spacing: .03em; }
.bbs .bbs-state { flex: 0 0 auto; font-size: 12px; font-weight: 700; }
.bbs .bbs-eaten { color: var(--bbs-good); }
.bbs .bbs-skipped .bbs-name { text-decoration: line-through; color: var(--bbs-muted); }
.bbs .bbs-skipped .bbs-state, .bbs .bbs-not-ticked .bbs-state { color: var(--bbs-muted); }
.bbs .bbs-figures { display: flex; flex-wrap: wrap; gap: 2px 14px; margin-top: 6px; padding-top: 6px;
  border-top: 1px solid var(--bbs-line); font-size: 13px; }
.bbs .bbs-figures strong { font-weight: 700; }
.bbs .bbs-slightly-over { color: var(--bbs-warn); font-weight: 700; }
.bbs .bbs-over { color: var(--bbs-over); font-weight: 700; }
.bbs .bbs-on-track { color: var(--bbs-good); font-weight: 700; }
.bbs table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bbs th, .bbs td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--bbs-line); }
.bbs th { font-size: 12px; color: var(--bbs-muted); font-weight: 700; }
.bbs td.bbs-r, .bbs th.bbs-r { text-align: right; }
.bbs .bbs-note { background: var(--bbs-soft); border-radius: 10px; padding: 8px 12px; margin: 12px 0; }
.bbs .bbs-week { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
@media print {
  .bbs { --bbs-ink: #2d2320; --bbs-ink-2: #514744; --bbs-muted: #79706d; --bbs-line: #e6ded5;
    --bbs-paper: #ffffff; --bbs-soft: #faf7f0; --bbs-good: #096847; --bbs-warn: #8b661a; --bbs-over: #ce3a3a;
    max-width: none; font-size: 12px; }
  .bbs h2 { break-after: avoid; page-break-after: avoid; }
}
`

function longDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function shortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function n0(n: number): string {
  return Math.round(n).toLocaleString('en-GB')
}

const plus = (on: boolean) => (on ? '\u2009+' : '')

const OUTCOME_WORDS: Record<SummaryItem['outcome'], string> = {
  eaten: 'Eaten',
  skipped: 'Skipped',
  'not-ticked': 'Not ticked',
}

function dayHtml(day: SummaryDay, s: DieticianSummary): string {
  const head = `<div class="bbs-day-head"><h3>${escapeHtml(longDate(day.date))}</h3>${
    day.any ? `<span class="bbs-cap">${day.recorded ? 'Recorded' : 'Planned, nothing ticked yet'}</span>` : ''}</div>`
  if (!day.any) {
    return `<section class="bbs-day" data-summary-day="${day.date}">${head}<p class="bbs-muted">Nothing written down for this day.</p></section>`
  }

  const items = day.items.map((i) =>
    `<li class="bbs-${i.outcome}"><span class="bbs-slot">${escapeHtml(SLOT_LABELS[i.slot])}</span>` +
    `<span class="bbs-name">${escapeHtml(i.name)}</span>` +
    `<span class="bbs-state">${OUTCOME_WORDS[i.outcome]}</span></li>`).join('')

  const t = s.targets
  const n = day.nutrients
  const all = day.floors.all
  const status = day.calories.level === 'none' ? ''
    : ` <span class="bbs-${day.calories.level}">${escapeHtml(day.calories.label)}${
      day.calories.deltaLabel ? ` · ${escapeHtml(day.calories.deltaLabel)}` : ''}</span>`

  const figures = [
    `<span><strong class="bbs-num">${n0(n.calories)}${plus(all)}</strong> of ${n0(t.calories)} kcal${status}</span>`,
    `<span>Protein <strong class="bbs-num">${n0(n.protein)}${plus(all)}</strong> of ${n0(t.protein)} g</span>`,
    `<span>Carbs <strong class="bbs-num">${n0(n.carbs)}${plus(all)}</strong> of ${n0(t.carbs)} g</span>`,
    `<span>Fat <strong class="bbs-num">${n0(n.fat)}${plus(all)}</strong> of ${n0(t.fat)} g</span>`,
    `<span>Fibre <strong class="bbs-num">${n0(n.fiber ?? 0)}${plus(day.floors.fiber)}</strong>${
      t.fiber ? ` of ${n0(t.fiber)}` : ''} g</span>`,
  ].join('')

  const known = day.total
    ? `<p class="bbs-cap" data-summary-known>${day.known} of ${day.total} ${day.total === 1 ? 'entry' : 'entries'} fully known</p>`
    : ''

  return `<section class="bbs-day" data-summary-day="${day.date}">${head}<ul class="bbs-items">${items}</ul>` +
    `<div class="bbs-figures">${figures}</div>${known}</section>`
}

function weekHtml(week: SummaryWeek): string {
  const label = `${shortDate(week.dates[0])} to ${shortDate(week.dates[week.dates.length - 1])}`
  if (!week.plannedDays) {
    return `<div class="bbs-week"><h3>${escapeHtml(label)}</h3><p class="bbs-muted">Nothing planned to score.</p></div>`
  }
  const row = (g: SummaryWeek['goals'][number]) => {
    const word = g.isLimit ? (g.ratio > 1 ? 'Over' : 'Within') : (g.ratio >= 0.9 ? 'Met' : 'Short')
    const doubt = g.ratio > IMPLAUSIBLE_RATIO ? ' <span class="bbs-cap">(worth checking the data)</span>' : ''
    return `<tr><td>${escapeHtml(g.label)}</td><td class="bbs-cap">${g.isLimit ? 'at most ' : ''}${g.target} / ${g.period}</td>` +
      `<td class="bbs-r bbs-num">${servingCount(g.servings)} of ${servingCount(g.expected)}</td><td>${word}${doubt}</td></tr>`
  }
  const aim = week.goals.filter((g) => !g.isLimit).map(row).join('')
  const under = week.goals.filter((g) => g.isLimit).map(row).join('')
  const gaps = [
    week.gaps.noGoal.length
      ? `Not counted as servings, the guide has no serving size for: ${escapeHtml(week.gaps.noGoal.join(', '))}.`
      : '',
    week.gaps.lost
      ? `${week.gaps.lost} ${week.gaps.lost === 1 ? 'thing is' : 'things are'} missing from the library, so these counts are short.`
      : '',
  ].filter(Boolean).map((t) => `<p class="bbs-cap">${t}</p>`).join('')

  return `<div class="bbs-week" data-summary-week><h3>${escapeHtml(label)} <span class="bbs-cap">` +
    `${week.plannedDays} ${week.plannedDays === 1 ? 'day' : 'days'} planned</span></h3>` +
    `<table><thead><tr><th>Aim for</th><th>Goal</th><th class="bbs-r">Servings</th><th></th></tr></thead><tbody>${aim}</tbody>` +
    `<thead><tr><th>Keep under</th><th>Limit</th><th class="bbs-r">Servings</th><th></th></tr></thead><tbody>${under}</tbody></table>${gaps}</div>`
}

/** The summary's markup, without a document around it. */
export function summaryBody(s: DieticianSummary): string {
  const t = s.targets
  const avg = s.average
  const overview = avg
    ? `<p>Across <strong>${avg.days}</strong> ${avg.days === 1 ? 'day' : 'days'} with food on them` +
      ` (${avg.recorded} recorded, ${avg.days - avg.recorded} planned only), the average day came to ` +
      `<strong class="bbs-num">${n0(avg.nutrients.calories)} kcal</strong>, protein ${n0(avg.nutrients.protein)} g, ` +
      `carbs ${n0(avg.nutrients.carbs)} g, fat ${n0(avg.nutrients.fat)} g, fibre ${n0(avg.nutrients.fiber ?? 0)} g.</p>`
    : '<p class="bbs-muted">Nothing was planned or written down in this stretch.</p>'

  const target = `<p>Daily target: <strong class="bbs-num">${n0(t.calories)} kcal</strong>, protein ${n0(t.protein)} g, ` +
    `carbs ${n0(t.carbs)} g, fat ${n0(t.fat)} g${t.fiber ? `, fibre ${n0(t.fiber)} g` : ''} ` +
    `<span class="bbs-cap">(set ${t.source === 'from-plans' ? 'from your plans'
      : t.source === 'tdee' ? 'by the Mifflin-St Jeor calculator' : 'by hand'})</span>.</p>`

  const weights = s.weights.length
    ? `<table data-summary-weights><thead><tr><th>Date</th><th class="bbs-r">Weight</th><th>Note</th></tr></thead><tbody>${
      s.weights.map((w) => `<tr><td>${escapeHtml(longDate(w.date))}</td><td class="bbs-r bbs-num">${w.value} ${w.unit}</td>` +
        `<td class="bbs-cap">${escapeHtml(w.notes ?? '')}</td></tr>`).join('')}</tbody></table>`
    : '<p class="bbs-muted" data-summary-weights>No weight logged in this stretch.</p>'

  return `<article class="bbs" data-summary>` +
    `<header><h1>Food summary for ${escapeHtml(s.person.name)}</h1>` +
    `<p class="bbs-muted">${escapeHtml(longDate(s.from))} to ${escapeHtml(longDate(s.to))}</p>` +
    `<p class="bbs-cap">Prepared on ${escapeHtml(longDate(s.generatedOn))} with Bite Buddy.</p></header>` +
    `<p class="bbs-note bbs-cap" data-summary-note>${escapeHtml(ESTIMATES_NOTE)} ` +
    `A <strong>+</strong> after a figure means a floor, not a total: something in that day did not say how much it held.</p>` +
    `<h2>Overview</h2>${target}${overview}` +
    `<h2>Day by day</h2>${s.days.map((d) => dayHtml(d, s)).join('')}` +
    `<h2>Mediterranean servings</h2><p class="bbs-cap">Serving goals from the Mediterranean Diet guide, scored a week at a time.</p>` +
    s.weeks.map(weekHtml).join('') +
    `<h2>Weight</h2>${weights}` +
    `</article>`
}

/** A file that opens on its own, anywhere, with nothing to fetch. */
export function summaryDocument(s: DieticianSummary): string {
  const title = `Food summary for ${s.person.name}, ${shortDate(s.from)} to ${shortDate(s.to)}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; padding: 24px 16px; background: #FFFDF9; }
@page { margin: 14mm; }
@media print { body { padding: 0; background: #ffffff; } }
${SUMMARY_CSS}
</style>
</head>
<body>
${summaryBody(s)}
</body>
</html>
`
}

/** "bite-buddy-summary-oli-2026-08-31-to-2026-09-27.html" */
export function summaryFilename(s: DieticianSummary): string {
  const who = s.person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'summary'
  return `bite-buddy-summary-${who}-${s.from}-to-${s.to}.html`
}
