import type { ZigMood } from '../components/brand/Mascot'

/**
 * Little things Zig notices.
 *
 * This replaces XP, levels, streaks and achievements — machinery that was built
 * here, then hidden behind a Settings toggle because it fought everything else
 * about the app. The reason it fought is worth writing down, because it decides
 * what this is allowed to be.
 *
 * A streak works by threatening you. Its power comes from what you lose by
 * stopping, which is why those apps get shrill: the number exists to be
 * protected. That is a terrible thing to point at someone's eating. A week
 * where you order pizza twice and skip the planner is a normal week, and an app
 * that reacts to it by resetting a counter to zero has made itself an unkind
 * presence in your kitchen.
 *
 * So the rules here are the opposite ones:
 *
 *  - **Nothing counts, so nothing can be lost.** No points, no levels, no
 *    totals. There is no number to protect.
 *  - **Nothing resets.** Every moment, once noticed, is kept. Going quiet for a
 *    month costs you none of them.
 *  - **Each is noticed once, ever.** These are firsts, not rewards you farm.
 *  - **It runs out.** Once you have settled in, Zig stops commenting. An app
 *    that congratulates you forever is managing you.
 *  - **One at a time, always dismissible, never in the way.**
 */

export type MomentKind =
  | 'first-day'
  | 'full-week'
  | 'from-the-archive'
  | 'cooked'
  | 'own-recipe'
  | 'own-food'
  | 'plenty-of-veg'
  | 'good-fibre'

export interface MomentDefinition {
  kind: MomentKind
  mood: ZigMood
  title: string
  note: string
}

/**
 * Eight, and that is the whole list.
 *
 * Written as observations rather than praise — "look at that" rather than
 * "great job!". Zig is a creature who lives in the app and noticed something,
 * not a coach with a clipboard.
 */
export const MOMENTS: Record<MomentKind, MomentDefinition> = {
  'first-day': {
    kind: 'first-day', mood: 'happy',
    title: 'A day, planned',
    note: 'That is the whole idea, really. Everything else here is in service of this bit.',
  },
  'full-week': {
    kind: 'full-week', mood: 'celebrate',
    title: 'A whole week',
    note: 'Seven days, all filled in. Zig is quietly delighted and will not make a fuss about it.',
  },
  'from-the-archive': {
    kind: 'from-the-archive', mood: 'thinking',
    title: 'Straight from the archive',
    note: 'One of the 14 weeks your dietician actually wrote, loaded in one tap.',
  },
  cooked: {
    kind: 'cooked', mood: 'chef',
    title: 'Something got cooked',
    note: 'Weighed out, made, eaten. The part the app cannot do for you.',
  },
  'own-recipe': {
    kind: 'own-recipe', mood: 'chef',
    title: 'Your own recipe',
    note: 'The library is not just the dietician’s any more.',
  },
  'own-food': {
    kind: 'own-food', mood: 'happy',
    title: 'A food of your own',
    note: 'One more thing the app knows the numbers for.',
  },
  'plenty-of-veg': {
    kind: 'plenty-of-veg', mood: 'happy',
    title: 'Plenty of vegetables',
    note: 'The Mediterranean guide asks for three servings a day. This week has them.',
  },
  'good-fibre': {
    kind: 'good-fibre', mood: 'celebrate',
    title: 'Fibre, sorted',
    note: 'A day at your fibre target. The least glamorous number and the one most worth hitting.',
  },
}

export interface MomentContext {
  plannedDays: number
  weekFullyPlanned: boolean
  loadedFromArchive: boolean
  cookedSomething: boolean
  ownRecipes: number
  ownFoods: number
  vegGoalMet: boolean
  fibreGoalMet: boolean
}

/** Nothing noticed. Callers that know about one thing spread this. */
export const EMPTY_CONTEXT: MomentContext = {
  plannedDays: 0,
  weekFullyPlanned: false,
  loadedFromArchive: false,
  cookedSomething: false,
  ownRecipes: 0,
  ownFoods: 0,
  vegGoalMet: false,
  fibreGoalMet: false,
}

/**
 * Which moments the current state warrants.
 *
 * Pure, and says nothing about what has already been noticed — the store owns
 * that. Keeping the two apart is what makes "once, ever" simple: this can
 * return the same answer every render without it meaning anything.
 */
export function noticeMoments(ctx: MomentContext): MomentKind[] {
  const noticed: MomentKind[] = []

  if (ctx.plannedDays > 0) noticed.push('first-day')
  if (ctx.weekFullyPlanned) noticed.push('full-week')
  if (ctx.loadedFromArchive) noticed.push('from-the-archive')
  if (ctx.cookedSomething) noticed.push('cooked')
  if (ctx.ownRecipes > 0) noticed.push('own-recipe')
  if (ctx.ownFoods > 0) noticed.push('own-food')
  // Only worth saying once there is enough of a week to mean it.
  if (ctx.plannedDays >= 3 && ctx.vegGoalMet) noticed.push('plenty-of-veg')
  if (ctx.fibreGoalMet) noticed.push('good-fibre')

  return noticed
}
