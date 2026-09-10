/*
 * What the design system exports.
 *
 * Bite Buddy is an application, not a published component library: there is no
 * `dist/` of components and no `.d.ts` tree for the converter to read a
 * component list from. This file is that list, written by hand so the names in
 * the design tool are the names the code actually uses. Two of them would
 * otherwise be wrong, because the file and the export disagree: `Mascot.tsx`
 * exports `Zig`, and `Chart.tsx` exports `DayChart`.
 *
 * Add a component here and in `componentSrcMap` in config.json, and it appears
 * in the design system on the next sync.
 */

import type React from 'react'
import { MemoryRouter } from 'react-router-dom'

export {
  MacroBar, CalorieRing, StatusPill, NutrientSummary, TierBadge,
  SourceLine, EmptyState, SectionHeading, ChipRow,
} from '../src/components/ui'

export { default as Zig, Wordmark } from '../src/components/brand/Mascot'
export { default as DayChart, Legend } from '../src/components/trends/Chart'

export { default as BodyChart } from '../src/components/body/BodyChart'
export { default as TrendsTab } from '../src/components/trends/TrendsTab'

export { default as AddFoodModal } from '../src/components/foods/AddFoodModal'
export { default as FoodEditor } from '../src/components/foods/FoodEditor'

export { default as ErrorBoundary } from '../src/components/layout/ErrorBoundary'
export { default as MobileNav } from '../src/components/layout/MobileNav'
export { default as Sidebar } from '../src/components/layout/Sidebar'
export { default as StorageBanner } from '../src/components/layout/StorageBanner'
export { default as UndoBar } from '../src/components/layout/UndoBar'

export { default as AddEntryModal } from '../src/components/planner/AddEntryModal'
export { default as FillGaps } from '../src/components/planner/FillGaps'
export { default as WeekTemplates } from '../src/components/planner/WeekTemplates'
export { default as WhenPicker } from '../src/components/planner/WhenPicker'

export { default as BarcodeScanner } from '../src/components/recipes/BarcodeScanner'
export { default as Photo } from '../src/components/recipes/Photo'
export { default as RecipeEditor } from '../src/components/recipes/RecipeEditor'

export { PlanArchive } from '../src/components/settings/PlanArchive'

/**
 * The context every preview is rendered inside.
 *
 * Three of these components are navigation and call react-router hooks, which
 * throw outside a router: not a wrong-looking card, a card that is an error
 * message. The app mounts a HashRouter at its root, so this is the same
 * arrangement with a router that needs no URL.
 *
 * Wired up as `provider` in config.json, and excluded from the component list
 * there: it is scaffolding for the previews, not a piece of the design system.
 */
export function PreviewShell({ children }: { children?: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
}
