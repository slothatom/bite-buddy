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
  entry, struck = false, onAmount, meta,
}: {
  entry: Component
  struck?: boolean
  onAmount?: () => void
  /** A few words after the amount, such as where a tub is kept. */
  meta?: string
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

  /*
   * Two lines: the name, then what it is and how much.
   *
   * The amount is the control for changing it, so it reads as part of the
   * description rather than as a fourth button on the row. The calories sit
   * to the right on their own, where a column of them can be scanned.
   */
  const amount = detail || (entry.kind === 'food'
    ? formatAmount(0, ctx.foods.get(entry.foodId))
    : '1×')

  return (
    <>
      <span className="flex-1 min-w-0 flex flex-col">
        {/* Through to the recipe, where there is one. A weighed food has no
            page to open, and a link that sometimes goes nowhere is worse
            than no link. */}
        <Name
          to={opensTo}
          title={full === label ? undefined : full}
          className={`min-w-0 text-[15px] leading-5 font-bold ${isDeleted || struck ? 'text-ink-700' : 'text-ink-900'} ${
            struck ? 'line-through' : ''} ${opensTo ? 'hover:text-bite-700 hover:underline' : ''}`}
        >
          {label}
          {entry.kind === 'portion' && (
            <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-leaf-700">
              {portion?.storage === 'freezer' ? 'freezer' : 'fridge'}
            </span>
          )}
          {isDeleted && (
            <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-ink-700">
              deleted
            </span>
          )}
          {/* Skipped in a word as well as struck through, so it is not
              carried by a line and a grey alone. */}
          {struck && (
            <span className="inline-block ml-1.5 text-xs font-bold uppercase tracking-wide text-ink-700">
              skipped
            </span>
          )}
        </Name>
        <span className="text-xs leading-4 text-ink-700">
          {/* A thumb-sized hit area that costs no height: the padding makes
              the box, the negative margin gives the space back. */}
          <button
            type="button"
            className="tabular-nums py-3 -my-3 pr-2 hover:text-bite-700 underline decoration-dotted underline-offset-4"
            onClick={onAmount}
            aria-label={`Change how much: ${label}`}
          >
            {amount}
          </button>
          {meta && <span>{` · ${meta}`}</span>}
        </span>
      </span>
      <span className="shrink-0 text-sm font-extrabold text-ink-900 tabular-nums">
        {Math.round(kcal)}
      </span>
    </>
  )
}
