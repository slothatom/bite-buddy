import type { ReleaseNote } from '../types'

const RELEASES: ReleaseNote[] = [
  {
    version: '0.3.0',
    date: '2026-03-28',
    title: 'Nutrition APIs, Mobile & Analytics',
    changes: [
      { type: 'feature', text: 'USDA FoodData Central integration — search 500k+ foods by name with auto-filled macros' },
      { type: 'feature', text: 'Open Food Facts integration — search branded products worldwide' },
      { type: 'feature', text: 'Barcode scanner — scan any product barcode to instantly fetch nutrition data' },
      { type: 'feature', text: 'Mobile-friendly layout — full bottom navigation, responsive weekly planner' },
      { type: 'feature', text: 'Analytics page — weekly nutrition charts, calorie bars, macro averages' },
      { type: 'feature', text: 'Weight & body measurement tracker with sparkline graphs' },
      { type: 'feature', text: 'Cook schedule — plan when to cook and which recipes' },
      { type: 'feature', text: '2 snack slots per day (Snack 1 + Snack 2)' },
      { type: 'feature', text: 'Micronutrient tracking — fiber, sugar, sodium, vitamins, minerals per ingredient' },
      { type: 'feature', text: 'Unit selector for ingredients (g, ml, kg, L, oz, cup, tbsp…)' },
      { type: 'improvement', text: 'Macros auto-recalculate when ingredient amount changes' },
      { type: 'improvement', text: 'Ingredient search shows USDA vs Open Food Facts source badge' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-03-28',
    title: 'Bug fixes & TypeScript cleanup',
    changes: [
      { type: 'fix', text: 'Removed unused imports causing TypeScript build failures' },
      { type: 'fix', text: 'Resolved all strict-mode TypeScript errors' },
      { type: 'improvement', text: 'Updated GitHub Actions to Node 24' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-03-28',
    title: 'Initial Release',
    changes: [
      { type: 'feature', text: 'Weekly meal planner with 7-day grid view' },
      { type: 'feature', text: 'Recipe management — create, edit, delete with full macro tracking' },
      { type: 'feature', text: 'Auto-generated grocery list from weekly plan (A–Z grouped)' },
      { type: 'feature', text: 'Guided prep mode with step-by-step instructions and countdown timers' },
      { type: 'feature', text: 'XP system, level progression, streak tracker, and 9 achievements' },
      { type: 'feature', text: '5 seed recipes pre-loaded to get started immediately' },
      { type: 'feature', text: 'All data persisted locally via Zustand + localStorage' },
    ],
  },
]

const TYPE_STYLES = {
  feature:     'badge-green',
  fix:         'badge-red',
  improvement: 'badge-purple',
}
const TYPE_LABELS = { feature: 'New', fix: 'Fix', improvement: 'Improved' }

export default function Changelog() {
  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 space-y-6">
        <div>
          <h1 className="page-title">What's New</h1>
          <p className="text-sm text-gray-400 mt-1">Release history for Bite Buddy</p>
        </div>

        {RELEASES.map((release) => (
          <div key={release.version} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">v{release.version}</span>
                  {RELEASES[0].version === release.version && (
                    <span className="badge-green">Latest</span>
                  )}
                </div>
                <p className="font-semibold text-gray-700 mt-0.5">{release.title}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-4">
                {new Date(release.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <ul className="space-y-2">
              {release.changes.map((change, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`${TYPE_STYLES[change.type]} shrink-0 mt-0.5`}>{TYPE_LABELS[change.type]}</span>
                  <span className="text-sm text-gray-700">{change.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
