import { Sun, Calendar, BookOpen, TrendingUp, Settings as SettingsIcon } from 'lucide-react'

/**
 * Where everything lives: four places and a header.
 *
 * There used to be nine destinations, three on the phone's bar and six behind
 * a More sheet. Each old screen now sits inside the place you would look for
 * it, as a tab: the week, the shopping and the cooking are all "Plan"; recipes
 * and foods are both things you can eat; trends, movement and the dietician's
 * summary are all "how is it going". Settings is rarely needed, so it leaves
 * the bar for a gear in Today's header (phone) and the foot of the sidebar
 * (desktop). The sidebar and the phone's bar read this one list, so they
 * cannot drift apart.
 */
export interface NavSection {
  /** Where the link goes: the section's first tab. */
  to: string
  /** Every path under this prefix belongs to the section. */
  base: string
  label: string
  icon: typeof Sun
}

export const SECTIONS: readonly NavSection[] = [
  { to: '/',          base: '/',          label: 'Today',    icon: Sun },
  { to: '/plan/week', base: '/plan',      label: 'Plan',     icon: Calendar },
  { to: '/recipes',   base: '/recipes',   label: 'Recipes',  icon: BookOpen },
  { to: '/progress',  base: '/progress',  label: 'Progress', icon: TrendingUp },
]

export const SETTINGS = { to: '/settings', base: '/settings', label: 'Settings', icon: SettingsIcon }

export interface SectionTab {
  to: string
  label: string
}

/**
 * The tabs inside each section, in order. Every tab is its own route, so a
 * deep link, a notification and the back gesture all land on the right one.
 */
export const SECTION_TABS = {
  plan: {
    label: 'Plan views',
    tabs: [
      { to: '/plan/week',    label: 'Week' },
      { to: '/plan/grocery', label: 'Grocery' },
      { to: '/plan/cooking', label: 'Cooking' },
    ],
  },
  recipes: {
    label: 'Library',
    tabs: [
      { to: '/recipes',       label: 'Recipes' },
      { to: '/recipes/foods', label: 'Foods' },
    ],
  },
  progress: {
    label: 'Progress views',
    tabs: [
      { to: '/progress',          label: 'Overview' },
      { to: '/progress/movement', label: 'Movement' },
      { to: '/progress/summary',  label: 'Summary' },
    ],
  },
} as const satisfies Record<string, { label: string; tabs: readonly SectionTab[] }>

export type SectionKey = keyof typeof SECTION_TABS

/**
 * Every address the app has ever had, and where it lives now.
 *
 * Old bookmarks, a reminder notification sent before this release, the
 * nudges on Today and the end-to-end tests all know the old paths. A redirect
 * keeps the query string, so `/grocery?tab=cupboard` still opens the
 * cupboard.
 */
export const REDIRECTS: Readonly<Record<string, string>> = {
  '/home':              '/',
  '/today':             '/',
  '/plan':              '/plan/week',
  '/planner':           '/plan/week',
  '/week':              '/plan/week',
  '/grocery':           '/plan/grocery',
  '/shopping':          '/plan/grocery',
  '/schedule':          '/plan/cooking',
  '/cooking':           '/plan/cooking',
  '/foods':             '/recipes/foods',
  '/movement':          '/progress/movement',
  '/exercise':          '/progress/movement',
  '/activity':          '/progress/movement',
  '/analytics':         '/progress',
  '/analytics/summary': '/progress/summary',
  '/summary':           '/progress/summary',
  '/history':           '/settings/history',
}

/** Where an old path lives now, or null when it is not an old path. */
export function redirectFor(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return REDIRECTS[clean] ?? null
}

/** Whether a path is inside a section. Today matches only itself. */
export function isCurrent(base: string, pathname: string): boolean {
  if (base === '/') return pathname === '/'
  return pathname === base || pathname.startsWith(base + '/')
}

/** Settings screens have their own back button and no bottom bar. */
export function isSettings(pathname: string): boolean {
  return isCurrent(SETTINGS.base, pathname)
}
