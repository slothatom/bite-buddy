import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Component } from '../../types'
import { useDeletedIds } from '../../store/useRecipeStore'
import { useNutritionContext } from '../../store/useNutrition'
import { componentsNutrients } from '../../lib/nutrition'
import { formatAmount } from '../../lib/amounts'
import { baseName } from '../../lib/recipeGroups'
import { entryName } from '../../lib/entryLabel'

/**
 * A meal's name, as a link when there is something behind it.
 *
 * Two renderings rather than a link with no destination, because an anchor
 * with no href is not a link to a screen reader or to a keyboard and reads as
 * one to everybody else.
 */
function Name({
  to, title, className, children,
}: {
  to?: string
  title?: string
  className: string
  children: ReactNode
}) {
  if (!to) {
    return <span title={title} data-entry-name className={className}>{children}</span>
  }
  /*
   * Padded to a thumb, then pulled back out of the layout.
   *
   * A meal name is one line of text, so the link around it was 20px tall: half
   * the 40px this app holds itself to, and a real miss on a phone rather than
   * a rule being observed. The negative margin cancels the padding for layout,
   * so the row keeps its height and only the target grows. It went unnoticed
   * because the day view used to be two taps in; it is the landing view now.
   */
  return (
    <Link to={to} title={title} data-entry-name className={`${className} inline-block py-2.5 -my-2.5`}>
      {children}
    </Link>
  )
}

export function EntryLine({
  entry, struck = false, onAmount,
}: {
  entry: Component
  struck?: boolean
  onAmount?: () => void
}) {
  const ctx = useNutritionContext()
  const deleted = useDeletedIds()
  const kcal = componentsNutrients([entry], ctx).calories

  // A recipe you deleted still resolves here, so the day keeps its meal and its
  // calories. It is marked rather than hidden: the record is what happened, and
  // silently dropping it would rewrite it.
  const isDeleted = entry.kind === 'recipe' && deleted.has(entry.recipeId)

  // Which tub it is, for the fridge-or-freezer tag and the recipe it points
  // at. The name itself comes from the shared helper, which already knows that
  // a portion says where it came from rather than what it is made of.
  const portion = entry.kind === 'portion' ? ctx.portions?.get(entry.portionId) : undefined

  // A portion points at one too: the tub is a batch of something, and what
  // went into it is the same question.
  const opensId = entry.kind === 'recipe'
    ? entry.recipeId
    : entry.kind === 'portion' ? portion?.recipeId : undefined
  const opensTo = opensId && ctx.recipes.has(opensId)
    ? `/recipes?recipe=${encodeURIComponent(opensId)}`
    : undefined

  const full = entryName(entry, ctx)

  // The dish, without the portion. The importer keeps the two apart now, so
  // this is already the dish for anything the app shipped; the strip is still
  // here for a recipe of yours saved from a build that put the portion in the
  // name. Here the ingredients are written out directly underneath, weights
  // and all, so the portion would be saying it twice, and saying it in the one
  // place where a second line costs a slot its place on the screen.
  const label = baseName(full)

  const detail = entry.kind === 'food'
    ? formatAmount(entry.grams, ctx.foods.get(entry.foodId))
    : entry.servings === 1 ? '' : `${entry.servings}×`

  // The names are long, 46 characters at the median, 77 at the longest, and in
  // a three-column day on a laptop this row gets about 320px, which the tick,
  // the two meal buttons, the amount and the calories take 250 of. The name
  // was left with 70px and broke one word per line: "Eggplant / spread / with
  // / wholemeal / bread & / mixed / vegetables", seven lines for one meal,
  // which pushed Snack 2 and Dinner off the bottom of a 950px laptop.
  //
  // So the row wraps instead, and the two numbers travel together. The name
  // takes its natural width and will not be squeezed below 7rem, so a short
  // one keeps the numbers beside it and a long one sends them to a second
  // line rather than shrinking to nothing. Two lines at worst, one whenever
  // the column is wide enough, which is what a phone gives it.
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      {/* The name in its own box, so it wraps against the row's edge rather
          than against whatever sits beside it.

          A glyph used to lead every line: the recipe's own emoji, a tub for a
          portion, and a bare interpunct for a weighed food, because foods have
          no emoji of their own. That last case is why this went: three lines
          of one meal read "🍲 soup, · bread, · mozzarella", so the column was
          decorated on some rows and punctuated on others. Giving foods their
          category's emoji instead would have made the column uniform and made
          it lie, since a category emoji describes the food group rather than
          the food: 🧀 for yogurt, 🍫 for banana bread. The names are what the
          row is for, and they now start in one place. */}
      <span className="flex-auto min-w-28 flex items-baseline gap-2">
      {/* Through to the recipe, which the planner could not do at all. You
          read "Cabbage soup with wholemeal bread" on Tuesday, wondered what
          went in it, and had to go to Recipes and search for it by name. Only
          the ones that are a recipe: a weighed food has no page to open, and
          a link that sometimes goes nowhere is worse than no link. */}
      <Name
        to={opensTo}
        title={full === label ? undefined : full}
        className={`min-w-0 ${isDeleted || struck ? 'text-ink-500' : 'text-ink-900'} ${
          struck ? 'line-through' : ''} ${opensTo ? 'hover:text-bite-700 hover:underline' : ''}`}
      >
        {label}
        {entry.kind === 'portion' && (
          <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-leaf-700">
            {portion?.storage === 'freezer' ? 'freezer' : 'fridge'}
          </span>
        )}
        {isDeleted && (
          <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            deleted
          </span>
        )}
        {/* Skipped in a word as well as struck through, so it is not carried
            by a line and a grey alone. */}
        {struck && (
          <span className="inline-block ml-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            skipped
          </span>
        )}
      </Name>
      </span>
      {/* The amount is the control. Tapping the line's name would fight with
          reading it, and a separate button would be a fourth thing in a row
          that already has three. Kept in one box with the calories so the two
          numbers wrap as a pair instead of stacking one above the other. */}
      <span className="flex items-baseline gap-2 shrink-0 ml-auto">
      <button
        // A thumb-sized hit area that costs no height: the padding makes the
        // box, the negative margin gives the space back to the layout. Sized
        // to fill it instead pushed the fifth slot of a day below the fold.
        className="text-xs text-ink-500 font-mono shrink-0 tabular-nums min-w-11 px-1 py-3 -my-3
                   hover:text-bite-700 underline decoration-dotted underline-offset-4"
        onClick={onAmount}
        aria-label={`Change how much: ${label}`}
      >
        {detail || (entry.kind === 'food'
          ? formatAmount(0, ctx.foods.get(entry.foodId))
          : '1×')}
      </button>
      <span className="text-xs text-ink-700 font-mono shrink-0 tabular-nums w-10 sm:w-14 text-right">
        {Math.round(kcal)}
      </span>
      </span>
    </div>
  )
}
