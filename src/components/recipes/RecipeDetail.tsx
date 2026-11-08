import { useState } from 'react'
import { useDialog } from '../../lib/useDialog'
import { formatAmount } from '../../lib/amounts'
import {
  Star, X, ChefHat, Plus, Pencil, Combine, Undo2, Minus, ExternalLink, CalendarPlus,
} from 'lucide-react'
import type { Recipe } from '../../types'
import { DIFFICULTY_LABELS } from '../../types'
import { safeUrl, linkLabel } from '../../lib/links'
import { useRecipeStore, useMergedInto } from '../../store/useRecipeStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, reportPerServing, roundNutrients } from '../../lib/nutrition'
import { NutrientSummary, SourceLine, ChipCheck } from '../ui'
import Photo from './Photo'
import { variantLabel, type RecipeVariants } from '../../lib/recipeGroups'
import { CATEGORY_LABELS, quickFilterLabel } from '../../lib/dishCategories'
import { usePantry } from '../../store/usePantryStore'
import { availability, availabilityLabel, missingFoods } from '../../lib/pantry'
import { timeIsEstimated } from '../../lib/cookingTimes'
import { useUserStore } from '../../store/useUserStore'
import { PlanIntoDay } from './PlanIntoDay'

export function RecipeDetail({
  card, isMine, onEdit, onClose, startId,
}: {
  card: RecipeVariants
  isMine: (recipe: Recipe) => boolean
  onEdit: (recipe: Recipe) => void
  onClose: () => void
  /**
   * Which wording to open on, when the sheet was opened from a planned meal.
   *
   * The plans write the same dish several ways and the day names one of them.
   * Landing on version 1 when Tuesday says version 3 would show a different
   * portion and different calories from the ones on the day you came from.
   */
  startId?: string
}) {
  const ctx = useNutritionContext()
  const { mergeRecipes, unmergeRecipe, favouriteIds, toggleFavourite } = useRecipeStore()
  const { profile } = useUserStore()
  const targets = profile.targets
  const [version, setVersion] = useState(() => {
    const at = card.variants.findIndex((r) => r.id === startId)
    return at >= 0 ? at : 0
  })
  const panel = useDialog<HTMLDivElement>(onClose)
  const [confirmMerge, setConfirmMerge] = useState(false)

  // A dish is favourited, not one portion of it, so the star covers every
  // wording of it. The same rule the card uses, because the two have to agree:
  // starring here and finding the card unstarred would read as a bug.
  const favourite = card.variants.some((r) => favouriteIds.includes(r.id))
  const setFavourite = () => {
    for (const r of card.variants) {
      if (favouriteIds.includes(r.id) === favourite) toggleFavourite(r.id)
    }
  }

  const recipe = card.variants[Math.min(version, card.variants.length - 1)]
  const folded = useMergedInto(recipe.id)
  const mine = isMine(recipe)
  const report = reportPerServing(recipe, ctx)
  const perServing = roundNutrients(report.total)

  /**
   * How many you are cooking, which is not always how many the recipe was
   * written for.
   *
   * Only the shopping changes: a portion is a portion however many you make,
   * so the per-serving figures above are left alone and the quantities below
   * follow the number you set. Scaling the per-serving numbers as well is the
   * mistake worth avoiding, it would say a double batch is twice as filling.
   *
   * And it stops here. This used to be handed to "Put it in a day" as the
   * amount eaten, so cooking three portions booked all three against one lunch
   * and the day read 790 kcal. Cooking three and eating one is the ordinary
   * case; the dialog asks its own question now and starts at one.
   */
  const [wanted, setWanted] = useState(recipe.servings)
  const [planning, setPlanning] = useState(false)
  const scale = recipe.servings > 0 ? wanted / recipe.servings : 1
  const scaled = wanted !== recipe.servings

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-paper flex items-start justify-between gap-2 px-5 py-4 border-b border-border-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl leading-none">{recipe.emoji}</span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-ink-900 leading-snug">{card.name}</h2>
              {/* Which of them you are reading. The header showed the shared
                  name alone, so flipping between versions changed the numbers
                  underneath and nothing said why. */}
              {card.variants.length > 1 && (
                <p className="text-xs font-semibold text-bite-700">{variantLabel(recipe, version)}</p>
              )}
              {recipe.name.ro || recipe.name.hu ? (
                <p className="text-xs text-ink-500">
                  {recipe.name.ro && <span lang="ro">{recipe.name.ro}</span>}
                  {recipe.name.ro && recipe.name.hu ? ' · ' : ''}
                  {recipe.name.hu && <span lang="hu">{recipe.name.hu}</span>}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* The star was only ever on the card, so deciding you like
                something while reading it meant closing the sheet to say so. */}
            <button
              className="btn-ghost btn-icon"
              onClick={setFavourite}
              aria-pressed={favourite}
              aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Star size={17} className={favourite ? 'fill-coral-600 text-coral-600' : ''} />
            </button>
            <button className="btn-ghost btn-icon" onClick={() => onEdit(recipe)} aria-label="Edit recipe"><Pencil size={17} /></button>
            <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </header>

        {/* Full width and under the header rather than inside it: a picture of
            a dinner is the one thing on this sheet worth looking at before
            reading, and squeezing it into the title row would make it a
            thumbnail of something already named. */}
        {recipe.photo && (
          <Photo path={recipe.photo} alt={card.name} className="w-full aspect-video" />
        )}

        <div className="p-5 space-y-5">
          {/* The plans write the same dish more than once, sometimes at a
              different portion, more often just worded differently ("supă de
              fasole verde" one week, "ciorbă de fasole verde" the next). One
              card, and the wordings live in here. */}
          {card.variants.length > 1 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">
                Written {card.variants.length} times across the plans
              </p>
              <div className="flex flex-wrap gap-1.5">
                {card.variants.map((v, i) => {
                  const kcal = Math.round(recipePerServing(v, ctx).calories)
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVersion(i)}
                      className={i === version ? 'chip-on' : 'chip-off'}
                      aria-pressed={i === version}
                    >
                      <ChipCheck on={i === version} />
                      {/* What this version is, rather than where it sits in
                          the row. These said "1", "2", "3", "4", so the one
                          thing you came here to decide, which portion, was the
                          one thing they would not tell you, and the importer's
                          answer was being computed and then thrown away. */}
                      {variantLabel(v, i)}
                      <span className="ml-1.5 font-mono">{kcal}</span>
                    </button>
                  )
                })}
              </div>

              {/* Keeping the one you are looking at is the only sensible
                  default, you chose it by flipping to it. */}
              {confirmMerge ? (
                <div className="card-soft p-3 mt-3 space-y-2">
                  <p className="text-sm text-ink-900">
                    Keep version {version + 1} and fold the other {card.variants.length - 1} into it?
                  </p>
                  <p className="text-xs text-ink-700">
                    Days already planned with the others will show this one instead. Nothing is
                    deleted, so you can put them back.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary flex-1"
                      onClick={() => {
                        mergeRecipes(recipe.id, card.variants.filter((v) => v.id !== recipe.id).map((v) => v.id))
                        setConfirmMerge(false)
                        setVersion(0)
                      }}
                    >
                      Merge into this one
                    </button>
                    <button className="btn-secondary flex-1" onClick={() => setConfirmMerge(false)}>
                      Leave them
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-ghost text-ink-500 mt-2 -ml-2" onClick={() => setConfirmMerge(true)}>
                  <Combine size={15} /> Merge these into one
                </button>
              )}
            </div>
          )}

          {/* The other side of it: a recipe that has swallowed others says so,
              and offers the way back. */}
          {folded.length > 0 && (
            <div className="card-soft p-3 flex items-center gap-3">
              <Combine size={16} className="text-ink-500 shrink-0" />
              <p className="flex-1 min-w-0 text-xs text-ink-700">
                {folded.length} other {folded.length === 1 ? 'version was' : 'versions were'} folded
                into this one.
              </p>
              <button className="btn-ghost shrink-0 text-ink-500" onClick={() => unmergeRecipe(recipe.id)}>
                <Undo2 size={14} /> Undo
              </button>
            </div>
          )}

          {recipe.sourceLine ? (
            <div className="card-soft p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1">How your dietician wrote it</p>
              <SourceLine text={recipe.sourceLine} translate />
            </div>
          ) : null}

          {recipe.description ? (
            <div className="card-soft p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1">Your notes</p>
              <p className="text-sm text-ink-900 whitespace-pre-line">{recipe.description}</p>
            </div>
          ) : null}

          {/* Checked again here rather than trusted from storage: a recipe can
              arrive from a backup file or from the other phone, and neither
              went through this device's editor. */}
          {(() => {
            const link = safeUrl(recipe.sourceUrl)
            return link ? (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary w-fit"
              >
                <ExternalLink size={15} /> {linkLabel(link)}
              </a>
            ) : null
          })()}

          <ShoppingNote recipe={recipe} />

          <div>
            <p className="text-3xl font-extrabold font-mono text-ink-900">
              {Math.round(perServing.calories)}<span className="text-base font-semibold text-ink-500 ml-1">kcal</span>
            </p>
            <p className="text-xs text-ink-500 mb-3">
              per serving · written for {recipe.servings}
              {recipe.prepMinutes || recipe.cookMinutes
                ? ` · ${timeIsEstimated(recipe) ? 'about ' : ''}${recipe.prepMinutes + recipe.cookMinutes} min`
                : ''}
              {mine ? ' · yours' : ''}
            </p>
            {/* Against the day's target, so a bar means something.
                Per-serving figures were printed above four bars with no
                reference value at all, which computed a zero fill every time:
                Protein 12 g over an empty bar, on every recipe in the app. A
                serving read against the day answers the question you are
                actually asking here, which is whether this is a big dinner. */}
            <NutrientSummary
              n={perServing}
              targets={targets}
              partial={report.partial}
              unresolved={report.unresolved}
            />
            <p className="text-xs text-ink-500 mt-2">
              Bars are one serving against a day&rsquo;s target, not against the recipe.
            </p>
          </div>

          {/* What it is, and what it asks of you, the two axes that are not
              the shelf it sits on. */}
          <div className="flex flex-wrap gap-1.5">
            {recipe.category && (
              <span className="chip bg-bite-100 text-bite-700 border border-bite-200">
                {CATEGORY_LABELS[recipe.category]}
              </span>
            )}
            {recipe.difficulty && (
              <span className="chip bg-mustard-100 text-mustard-800 border border-mustard-200">
                {DIFFICULTY_LABELS[recipe.difficulty]}
              </span>
            )}
            {(recipe.quickFilters ?? []).map((f) => (
              <span key={f} className="chip-off pointer-events-none">{quickFilterLabel(f)}</span>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">What goes in</p>
              <div className="flex items-center gap-1">
                <button
                  className="btn-ghost btn-icon text-ink-500"
                  onClick={() => setWanted((n) => Math.max(1, n - 1))}
                  disabled={wanted <= 1}
                  aria-label="One serving fewer"
                >
                  <Minus size={15} />
                </button>
                {/* 4rem held "2 servings" on two lines in the middle of a
                    control whose whole job is to be read at a glance between
                    two buttons. */}
                <span className="text-sm font-mono text-ink-900 tabular-nums min-w-24 text-center whitespace-nowrap">
                  {wanted} {wanted === 1 ? 'serving' : 'servings'}
                </span>
                <button
                  className="btn-ghost btn-icon text-ink-500"
                  onClick={() => setWanted((n) => Math.min(99, n + 1))}
                  disabled={wanted >= 99}
                  aria-label="One serving more"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <ul className="space-y-1">
              {recipe.components.map((c, i) => {
                const label = c.kind === 'food'
                  ? ctx.foods.get(c.foodId)?.names.en ?? c.foodId
                  : ctx.recipes.get(c.recipeId)?.name.en ?? c.recipeId
                const qty = c.kind === 'food'
                  ? formatAmount(c.grams * scale, ctx.foods.get(c.foodId))
                  // Half a batch of a nested dish is a real answer, so this one
                  // keeps a decimal rather than rounding 0.5 away to nothing.
                  : `${Math.round(c.servings * scale * 100) / 100}×`
                return (
                  <li key={i} className="flex justify-between gap-3 text-sm text-ink-900">
                    <span className="min-w-0">{label}</span>
                    <span className="font-mono text-ink-700 shrink-0">{qty}</span>
                  </li>
                )
              })}
              {!recipe.components.length && (
                <li className="text-sm text-ink-500">Nothing listed yet.</li>
              )}
            </ul>

            {scaled && recipe.components.length > 0 && (
              <p className="text-xs text-ink-500 mt-2">
                Scaled from {recipe.servings}. The whole lot comes to{' '}
                <strong className="font-mono text-ink-700">
                  {Math.round(perServing.calories * wanted).toLocaleString()} kcal
                </strong>
                , and a serving is unchanged.
              </p>
            )}
          </div>

          {recipe.steps.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">How to make it</p>
              <ol className="space-y-2">
                {recipe.steps.map((s, i) => (
                  <li key={s.id} className="flex gap-3 text-sm text-ink-900">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-bite-100 text-bite-700 text-xs font-bold grid place-items-center">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{s.instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2">
            {/* The obvious thing to want, and until now the one thing this
                sheet could not do. You browsed, decided, closed it, opened the
                planner, found the day and searched for the same dish again. */}
            <button className="btn-primary flex-1" onClick={() => setPlanning(true)}>
              <CalendarPlus size={15} /> Put it in a day
            </button>
            <button className="btn-secondary" onClick={() => onEdit(recipe)}>
              <Pencil size={15} /> Edit
            </button>
          </div>

          {planning && (
            <PlanIntoDay
              recipe={recipe}
              cooking={wanted}
              onClose={() => setPlanning(false)}
            />
          )}

          {recipe.steps.length === 0 && (
            <p className="flex items-start gap-2 text-xs text-ink-500">
              <ChefHat size={14} className="shrink-0 mt-0.5" />
              This one came straight from a plan, so it lists what goes in but not how. Edit it to
              write the method down the first time you cook it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * What this recipe would still cost you a trip for.
 *
 * Shown only when the cupboard has something to say, and worded as a list
 * rather than a verdict: whether three missing things is a lot depends
 * entirely on which three, and you are the one who can see them.
 */
function ShoppingNote({ recipe }: { recipe: Recipe }) {
  const ctx = useNutritionContext()
  const pantry = usePantry()
  if (!pantry.size) return null

  const state = availability(recipe, ctx, pantry)
  if (!state.have.length && !state.missing.length) return null

  const missing = missingFoods(state, ctx.foods)

  return (
    <div className={`card-soft p-3 ${state.missing.length ? '' : 'bg-leaf-50'}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1">
        {availabilityLabel(state)}
      </p>
      {missing.length > 0 && (
        <p className="text-sm text-ink-700">{missing.join(', ')}</p>
      )}
    </div>
  )
}
