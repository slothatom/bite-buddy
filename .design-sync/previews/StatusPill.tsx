import { StatusPill } from 'bite-buddy'

/** A day inside its target. Tick plus the words, so the green is never the only signal. */
export function OnTrack() {
  return (
    <div style={{ width: 260 }}>
      <StatusPill level="on-track" label="On track" />
    </div>
  )
}

/**
 * All four levels, which is the thing worth looking at.
 *
 * Each one has its own mark: a tick, a plus, a warning triangle, and nothing at
 * all for a figure with no target behind it. Read the sheet in greyscale and
 * the four are still tellable apart.
 */
export function TheFourLevels() {
  return (
    <div style={{ width: 300, display: 'grid', gap: 8, justifyItems: 'start' }}>
      <StatusPill level="on-track" label="On track" />
      <StatusPill level="slightly-over" label="Slightly over · +250 kcal" />
      <StatusPill level="over" label="Over target · +680 kcal" />
      <StatusPill level="none" label="No target set" />
    </div>
  )
}

/**
 * The label the ring builds, which is a status and a delta joined by a middot.
 *
 * Long by pill standards, and the reason the component takes a string rather
 * than composing the delta itself.
 */
export function AsTheRingLabelsIt() {
  return (
    <div style={{ width: 320, display: 'grid', gap: 8, justifyItems: 'start' }}>
      <StatusPill level="slightly-over" label="Slightly over · +250 kcal" />
      <StatusPill level="over" label="Over target · +1,240 mg" />
    </div>
  )
}

/**
 * Pills beside the nutrients they judge.
 *
 * How they actually appear: at the end of a row, sized by their text, with the
 * figure doing the talking to their left.
 */
export function InARow() {
  return (
    <div style={{ width: 360, display: 'grid', gap: 10 }}>
      {[
        { name: 'Protein 118 g', level: 'on-track' as const, label: 'On track' },
        { name: 'Carbs 214 g', level: 'slightly-over' as const, label: 'Slightly over · +44 g' },
        { name: 'Salt 8.1 g', level: 'over' as const, label: 'Over target · +2.1 g' },
      ].map((row) => (
        <div key={row.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="text-sm text-ink-700">{row.name}</span>
          <StatusPill level={row.level} label={row.label} />
        </div>
      ))}
    </div>
  )
}
