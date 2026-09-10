import { TrendsTab } from 'bite-buddy'

/*
 * What this tab can and cannot be shown as.
 *
 * TrendsTab takes no props. Everything it draws comes out of three Zustand
 * stores: the meal plan, the food and recipe library behind `useNutritionContext`,
 * and the user profile that holds the targets. None of those stores is exported
 * from `.design-sync/entry.tsx`, and the preview script runs after the bundle
 * has already created and rehydrated them, so there is no point at which a
 * preview file can put a plan into the store.
 *
 * With an empty plan the tab returns its empty state, and that is what these
 * cells are: the real, styled thing the app shows on a first run, not a stub.
 * The populated tab, with its span and nutrient chips, the average, the chart
 * and the foods list, cannot be reached from here. See .design-sync/learnings/B.md.
 */

/**
 * The tab on a first run, at the width the main column gives it on a desktop.
 *
 * An empty plan is the honest starting state: nothing has been ticked, so
 * there is nothing to trend and the tab says so rather than drawing a chart of
 * zeroes. The card names the span it would have read, which is the one thing
 * that tells you the filters exist at all.
 */
export function NothingToTrendYet() {
  return (
    <div style={{ width: 620 }}>
      <TrendsTab />
    </div>
  )
}

/**
 * The same empty state on a phone, which is where this tab is mostly read.
 *
 * Worth its own cell because the card's 40px padding and the 84px mascot are
 * fixed while the column is not: at 360 the heading and the sentence under it
 * are what has to give, and they do it by wrapping rather than by shrinking.
 */
export function OnAPhone() {
  return (
    <div style={{ width: 360 }}>
      <TrendsTab />
    </div>
  )
}
