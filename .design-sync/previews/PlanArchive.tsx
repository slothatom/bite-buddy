import { useEffect, useRef } from 'react'
import { PlanArchive } from 'bite-buddy'

/**
 * The archive as Settings shows it: every week she wrote, newest first, nothing
 * open.
 *
 * It takes no props at all, it reads the plans out of the app's own data, so
 * every card here is a real week the dietician wrote. The average beside each
 * one is this app's reading of her lines rather than a figure she gave, which
 * is why it sits in the quiet second line and not next to the label.
 */
export function TheArchive() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <PlanArchive />
    </div>
  )
}

/**
 * One week unfolded, which is the part of the archive worth designing.
 *
 * Her wording leads and the English sits under it, the opposite of everywhere
 * else in the app: this is the one screen whose subject is her weeks rather
 * than tonight's dinner. Each day and each meal can be lifted out and put on
 * any day, so Take appears twice at two different scopes.
 *
 * The archive opens nothing by itself, so this cell presses the top row on
 * mount the way a finger would. Nothing else about it is arranged.
 */
export function AWeekOpened() {
  const held = useRef<HTMLDivElement>(null)
  useEffect(() => {
    held.current?.querySelector<HTMLButtonElement>('article button')?.click()
  }, [])
  return (
    <div ref={held} style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <PlanArchive />
    </div>
  )
}

/**
 * The same list in the phone column it is usually read in.
 *
 * The row has a flag, a two-line label and a Load button competing for about
 * 330 px, and this is where that either holds or truncates the week's name.
 */
export function OnAPhone() {
  return (
    <div style={{ width: 390, margin: '0 auto', padding: '16px 12px' }}>
      <PlanArchive />
    </div>
  )
}
