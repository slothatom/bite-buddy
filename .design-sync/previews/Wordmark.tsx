import { Wordmark } from 'bite-buddy'

/** The default: Bandit at 38px with the name and the line under it. */
export function Default() {
  return (
    <div style={{ width: 260 }}>
      <Wordmark />
    </div>
  )
}

/**
 * In the sidebar header, which is where it spends most of its life.
 *
 * Cream panel, a rule under it, 224px of width to sit in. Worth checking the
 * mascot and the two lines of text stay on the same optical centre.
 */
export function InTheSidebar() {
  return (
    <div style={{ width: 224 }}>
      <div className="bg-cream-50 border border-border-200">
        <div className="px-4 py-4 border-b border-border-200">
          <Wordmark />
        </div>
        <div className="px-3 py-3 space-y-1">
          <p className="text-sm font-bold text-ink-900">Home</p>
          <p className="text-sm text-ink-700">Planner</p>
          <p className="text-sm text-ink-700">Foods</p>
        </div>
      </div>
    </div>
  )
}

/**
 * The phone header size.
 *
 * Bandit is one big dark mask rather than a set of details, so he still reads
 * at 26px next to a menu button and an add button.
 */
export function InTheMobileHeader() {
  return (
    <div style={{ width: 360 }}>
      <div className="card px-3 py-2 flex items-center gap-3">
        <span className="text-ink-700 text-lg">☰</span>
        <div className="flex-1 min-w-0">
          <Wordmark size={26} />
        </div>
        <span className="rounded-full bg-bite-500 text-on-brand font-bold text-sm px-3.5 py-2">Meal</span>
      </div>
    </div>
  )
}

/** The onboarding size, where the mascot is the point and the text rides along. */
export function Large() {
  return (
    <div style={{ width: 320 }}>
      <Wordmark size={72} />
    </div>
  )
}
