import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import SectionTabs from './SectionTabs'
import { SECTION_TABS, type SectionKey } from './nav'

/**
 * A section with tabs: Plan, Recipes or Progress.
 *
 * The tabs sit above whichever screen the route picked, and stay put while
 * that screen's chunk loads, so switching tabs never blanks the control you
 * just pressed. The screens themselves are unchanged and still own their
 * headings.
 */
export default function SectionLayout({ section }: { section: SectionKey }) {
  const { label, tabs } = SECTION_TABS[section]

  return (
    <>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 md:pt-6" data-print-hide>
        <SectionTabs label={label} tabs={tabs} />
      </div>
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Outlet />
      </Suspense>
    </>
  )
}
