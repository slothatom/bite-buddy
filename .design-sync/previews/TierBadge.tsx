import { TierBadge } from 'bite-buddy'

/** The four tiers the Mediterranean guide sorts a food into. */
export function TheFourTiers() {
  return (
    <div style={{ width: 260, display: 'grid', gap: 8, justifyItems: 'start' }}>
      <TierBadge tier="daily" />
      <TierBadge tier="weekly" />
      <TierBadge tier="moderate" />
      <TierBadge tier="rare" />
    </div>
  )
}

/**
 * Daily and weekly share a colour, which is deliberate.
 *
 * Both are the green end of the guide, so the badge separates them with the
 * symbol and the word instead: a filled dot against a half one. Worth checking
 * that the two still read apart at this size.
 */
export function ColourIsNotTheSignal() {
  return (
    <div style={{ width: 260, display: 'flex', gap: 10 }}>
      <TierBadge tier="daily" />
      <TierBadge tier="weekly" />
    </div>
  )
}

/**
 * On food rows, where these actually live.
 *
 * The badge sits in a fixed lane so "Moderation" does not shove the figures
 * left and leave every row starting somewhere different. 122 foods carry one of
 * these, so it has to stay quiet next to the name.
 */
export function OnAFoodRow() {
  return (
    <div style={{ width: 440 }}>
      <div className="card divide-y divide-border-100">
        {[
          { name: 'Pâine integrală', kcal: 247, tier: 'daily' as const },
          { name: 'Telemea de capră', kcal: 253, tier: 'moderate' as const },
          { name: 'Zabpehely', kcal: 379, tier: 'daily' as const },
          { name: 'Dulceață de caise', kcal: 278, tier: 'rare' as const },
        ].map((f) => (
          <div key={f.name} className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm font-bold text-ink-900 flex-1 min-w-0">{f.name}</span>
            <span style={{ width: 96, flexShrink: 0 }}>
              <TierBadge tier={f.tier} />
            </span>
            <span className="text-sm font-mono font-bold text-ink-900 shrink-0">
              {f.kcal}<span className="text-ink-500 font-normal text-xs"> kcal</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
