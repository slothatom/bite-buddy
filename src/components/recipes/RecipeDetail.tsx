import { useState, type ReactNode } from 'react'
import { useDialog } from '../../lib/useDialog'
import { formatAmount } from '../../lib/amounts'
import {
  Heart, ChevronLeft, ChefHat, Plus, Pencil, Combine, Undo2, Minus, ExternalLink, CalendarPlus,
} from 'lucide-react'
import type { Nutrients, Recipe, Targets } from '../../types'
import { DIFFICULTY_LABELS } from '../../types'
import { safeUrl, linkLabel } from '../../lib/links'
import { useRecipeStore, useMergedInto } from '../../store/useRecipeStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, reportPerServing, roundNutrients, saltFromSodium } from '../../lib/nutrition'
import { SourceLine, ChipCheck } from '../ui'
import Photo from './Photo'
import { variantLabel, type RecipeVariants } from '../../lib/recipeGroups'
import { CATEGORY_LABELS, quickFilterLabel } from '../../lib/dishCategories'
import { usePantry } from '../../store/usePantryStore'
import { availability, availabilityLabel, missingFoods } from '../../lib/pantry'
import { timeIsEstimated } from '../../lib/cookingTimes'
import { useUserStore } from '../../store/useUserStore'
import { PlanIntoDay } from './PlanIntoDay'

/**
 * One recipe, read in full.
 *
 * Two shapes of the same content. On a phone it is a screen of its own over the
 * list, with a back arrow, because a recipe is read standing at the counter and
 * wants the whole width. On a wide screen it is the right-hand pane beside the
 * list, so choosing between three soups is a click each rather than an open and
 * a close each.
 */
export function RecipeDetail({
  card, isMine, onEdit, onClose, startId, docked = false,
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
  /** Beside the list on a wide screen, rather than a screen of its own. */
  docked?: boolean
}) {
  const ctx = useNutritionContext()
  const { mergeRecipes, unmergeRecipe, favouriteIds, toggleFavourite } = useRecipeStore()
  const { profile } = useUserStore()
  const targets = profile.targets
  const [version, setVersion] = useState(() => {
    const at = card.variants.findIndex((r) => r.id === startId)
    return at >= 0 ? at : 0
  })
  const [confirmMerge, setConfirmMerge] = useState(false)

  // A dish is favourited, not one portion of it, so the heart covers every
  // wording of it. The same rule the list uses, because the two have to agree.
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
  const minutes = recipe.prepMinutes + recipe.cookMinutes

  /**
   * How many you are cooking, which is not always how many the recipe was
   * written for.
   *
   * Only the shopping changes: a portion is a portion however many you make,
   * so the per-serving figures are left alone and the quantities follow the
   * number you set. And it stops here: "Add to plan" asks its own question
   * about how much is eaten, starting at one.
   */
  const [wanted, setWanted] = useState(recipe.servings)
  const [planning, setPlanning] = useState(false)
  const scale = recipe.servings > 0 ? wanted / recipe.servings : 1
  const scaled = wanted !== recipe.servings

  const heartButton = (
    <button
      className={docked
        ? 'btn-icon bg-paper border border-border-200 text-ink-700 hover:border-bite-300'
        : 'btn-ghost btn-icon'}
      onClick={setFavourite}
      aria-pressed={favourite}
      aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
    >
      <Heart size={19} className={favourite ? 'fill-coral-700 text-coral-700' : ''} />
    </button>
  )

  const stepper = (
    <Stepper
      wanted={wanted}
      onLess={() => setWanted((n) => Math.max(1, n - 1))}
      onMore={() => setWanted((n) => Math.min(99, n + 1))}
      boxed={docked}
    />
  )

  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-[18px] text-ink-700">
      {recipe.category && (
        <span className="badge bg-bite-100 text-bite-700">{CATEGORY_LABELS[recipe.category]}</span>
      )}
      {recipe.difficulty && (
        <span className="badge bg-mustard-100 text-mustard-800">{DIFFICULTY_LABELS[recipe.difficulty]}</span>
      )}
      {(recipe.quickFilters ?? []).map((f) => (
        <span key={f} className="badge bg-cream-50 border border-border-200 text-ink-700">{quickFilterLabel(f)}</span>
      ))}
      <span>
        {[
          minutes > 0 ? `${timeIsEstimated(recipe) ? 'about ' : ''}${minutes} min` : null,
          `makes ${recipe.servings}`,
          recipe.timesPlanned ? `planned ${recipe.timesPlanned} ${recipe.timesPlanned === 1 ? 'time' : 'times'}` : null,
          mine ? 'yours' : null,
        ].filter(Boolean).join(' · ')}
      </span>
    </div>
  )

  const ingredients = (
    <ul>
      {recipe.components.map((c, i) => {
        const label = c.kind === 'food'
          ? ctx.foods.get(c.foodId)?.names.en ?? c.foodId
          : ctx.recipes.get(c.recipeId)?.name.en ?? c.recipeId
        const qty = c.kind === 'food'
          ? formatAmount(c.grams * scale, ctx.foods.get(c.foodId))
          // Half a batch of a nested dish is a real answer, so this one keeps a
          // decimal rather than rounding 0.5 away to nothing.
          : `${Math.round(c.servings * scale * 100) / 100}×`
        return (
          <li
            key={i}
            className={docked
              ? 'flex justify-between gap-3 py-1.5 border-b border-border-100 text-sm text-ink-900'
              : 'flex items-center justify-between gap-3 px-3.5 py-2 border-t border-border-100 first:border-t-0 text-sm text-ink-900'}
          >
            <span className="min-w-0 font-semibold">{label}</span>
            <span className="font-bold text-ink-700 shrink-0 tabular-nums">{qty}</span>
          </li>
        )
      })}
      {!recipe.components.length && (
        <li className={`text-sm text-ink-500 ${docked ? 'py-1.5' : 'px-3.5 py-2'}`}>Nothing listed yet.</li>
      )}
    </ul>
  )

  const scaledNote = scaled && recipe.components.length > 0 && (
    <p className={`text-xs text-ink-700 ${docked ? 'mt-2' : 'px-3.5 py-2 border-t border-border-100'}`}>
      Scaled from {recipe.servings}. The whole lot comes to{' '}
      <strong className="text-ink-900">
        {Math.round(perServing.calories * wanted).toLocaleString()} kcal
      </strong>
      , and a serving is unchanged.
    </p>
  )

  const steps = (
    <section aria-labelledby="recipe-method" className="flex flex-col gap-1.5">
      <h3 id="recipe-method" className="text-base md:text-[15px] font-extrabold text-ink-900">How to make it</h3>
      {recipe.steps.length > 0 ? (
        <ol className="flex flex-col gap-2.5">
          {recipe.steps.map((s, i) => (
            <li key={s.id} className="flex gap-3 text-sm text-ink-900">
              <span aria-hidden="true" className="shrink-0 w-6 h-6 rounded-full bg-bite-100 text-bite-700 text-xs font-extrabold grid place-items-center">
                {i + 1}
              </span>
              <span className="min-w-0">{s.instruction}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="flex items-start gap-2 text-xs text-ink-700">
          <ChefHat size={14} className="shrink-0 mt-0.5" />
          This one came straight from a plan, so it lists what goes in but not how. Edit it to
          write the method down the first time you cook it.
        </p>
      )}
    </section>
  )

  const body = (
    <>
      <div className="flex flex-col gap-2">
        {meta}
        {/* Which of them you are reading, when the plans wrote it more than once. */}
        {card.variants.length > 1 && (
          <p className="text-xs font-bold text-bite-700">{variantLabel(recipe, version)}</p>
        )}
        {recipe.name.ro || recipe.name.hu ? (
          <p className="text-xs text-ink-700">
            {recipe.name.ro && <span lang="ro">{recipe.name.ro}</span>}
            {recipe.name.ro && recipe.name.hu ? ' · ' : ''}
            {recipe.name.hu && <span lang="hu">{recipe.name.hu}</span>}
          </p>
        ) : null}
        {recipe.sourceLine ? (
          <div data-source-line>
            <p className="text-xs font-bold text-ink-700 mb-0.5">How your dietician wrote it</p>
            <SourceLine text={recipe.sourceLine} translate />
          </div>
        ) : null}
      </div>

      {/* The plans write the same dish more than once, sometimes at a different
          portion, more often just worded differently. One row in the list, and
          the wordings live in here. */}
      {card.variants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p id="recipe-versions" className="text-xs font-bold text-ink-700">
            Written {card.variants.length} times across the plans
          </p>
          <div role="group" aria-labelledby="recipe-versions" className="flex flex-wrap gap-2">
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
                  {variantLabel(v, i)}
                  <span className="tabular-nums">· {kcal}</span>
                </button>
              )
            })}
          </div>

          {/* Keeping the one you are looking at is the only sensible default,
              you chose it by flipping to it. */}
          {confirmMerge ? (
            <div className="card-soft p-3 space-y-2">
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
            <button className="btn-ghost text-ink-700 w-fit -ml-2" onClick={() => setConfirmMerge(true)}>
              <Combine size={15} /> Merge these into one
            </button>
          )}
        </div>
      )}

      {/* The other side of it: a recipe that has swallowed others says so, and
          offers the way back. */}
      {folded.length > 0 && (
        <div className="card-soft p-3 flex items-center gap-3">
          <Combine size={16} className="text-ink-500 shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-ink-700">
            {folded.length} other {folded.length === 1 ? 'version was' : 'versions were'} folded
            into this one.
          </p>
          <button className="btn-ghost shrink-0 text-ink-700" onClick={() => unmergeRecipe(recipe.id)}>
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}

      {recipe.photo && (
        <Photo path={recipe.photo} alt={card.name} className="w-full aspect-video rounded-2xl" />
      )}

      {recipe.description ? (
        <div className="card-soft p-3">
          <p className="text-xs font-bold text-ink-700 mb-1">Your notes</p>
          <p className="text-sm text-ink-900 whitespace-pre-line">{recipe.description}</p>
        </div>
      ) : null}

      {/* Checked again here rather than trusted from storage: a recipe can
          arrive from a backup file or from the other phone. */}
      {(() => {
        const link = safeUrl(recipe.sourceUrl)
        return link ? (
          <a href={link.href} target="_blank" rel="noreferrer noopener" className="btn-secondary w-fit">
            <ExternalLink size={15} /> {linkLabel(link)}
          </a>
        ) : null
      })()}

      <ShoppingNote recipe={recipe} />

      {docked ? (
        <>
          <div className="flex gap-3 items-stretch">
            <PerServing n={perServing} targets={targets} partial={report.partial} docked />
            <div className="shrink-0 border border-border-200 rounded-2xl px-2.5 py-2 flex flex-col justify-center gap-1">
              <span id="recipe-servings" className="text-xs font-bold text-ink-700">Servings</span>
              {stepper}
            </div>
          </div>
          <Footnote n={perServing} partial={report.partial} unresolved={report.unresolved} />
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-x-7 gap-y-5 border-t border-border-100 pt-4">
            <section aria-labelledby="recipe-ingredients" className="flex flex-col gap-1.5">
              <h3 id="recipe-ingredients" className="text-[15px] font-extrabold text-ink-900">
                Ingredients{' '}
                <span className="text-[13px] font-semibold text-ink-700">
                  for {wanted} {wanted === 1 ? 'serving' : 'servings'}
                </span>
              </h3>
              {ingredients}
              {scaledNote}
            </section>
            {steps}
          </div>
        </>
      ) : (
        <>
          <section aria-label="Per serving" className="bg-paper border border-border-200 rounded-3xl p-4 flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2">
              <span data-per-serving-kcal className="text-[28px] leading-7 font-extrabold text-ink-900 tabular-nums">
                {Math.round(perServing.calories)}
              </span>
              <span className="text-sm text-ink-700 flex-1">kcal per serving</span>
              <span className="text-xs text-ink-700">1 of {recipe.servings}</span>
            </div>
            <PerServing n={perServing} targets={targets} partial={report.partial} />
            <Footnote n={perServing} partial={report.partial} unresolved={report.unresolved} />
          </section>

          <div className="flex gap-2">
            <button className="btn-primary flex-1 min-h-12 text-[15px]" onClick={() => setPlanning(true)}>
              <CalendarPlus size={16} /> Add to plan
            </button>
          </div>

          <section aria-labelledby="recipe-ingredients" className="bg-paper border border-border-200 rounded-3xl overflow-hidden">
            <div className="flex items-center gap-2 pl-3.5 pr-1.5 py-1 border-b border-border-100">
              <h3 id="recipe-ingredients" className="flex-1 text-base font-extrabold text-ink-900">What goes in</h3>
              {stepper}
            </div>
            {ingredients}
            {scaledNote}
          </section>

          {steps}
        </>
      )}

      {planning && (
        <PlanIntoDay recipe={recipe} cooking={wanted} onClose={() => setPlanning(false)} />
      )}
    </>
  )

  if (docked) {
    return (
      <article
        data-recipe-detail
        aria-labelledby="recipe-title"
        className="flex-1 min-w-0 bg-paper border border-border-200 rounded-3xl p-6 flex flex-col gap-4
                   lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] overflow-y-auto"
      >
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 flex items-start gap-3">
            <span className="text-3xl leading-none" aria-hidden="true">{recipe.emoji}</span>
            <h2 id="recipe-title" className="text-[26px] leading-8 font-extrabold text-ink-900">{card.name}</h2>
          </div>
          <div className="flex gap-2 shrink-0">
            {heartButton}
            <button className="btn-secondary" onClick={() => onEdit(recipe)} aria-label="Edit recipe">
              <Pencil size={15} /> Edit
            </button>
            <button className="btn-primary" onClick={() => setPlanning(true)}>
              <CalendarPlus size={15} /> Add to plan
            </button>
          </div>
        </div>
        {body}
      </article>
    )
  }

  return (
    <Sheet onClose={onClose}>
      <header className="sticky top-0 z-10 bg-cream-50 min-h-15 flex items-center gap-1 pl-1 pr-2">
        <button className="btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Back to recipes">
          <ChevronLeft size={22} />
        </button>
        <h2 id="recipe-title" className="flex-1 min-w-0 text-xl leading-[26px] font-extrabold text-ink-900">
          {card.name}
        </h2>
        {heartButton}
        <button className="btn-ghost btn-icon" onClick={() => onEdit(recipe)} aria-label="Edit recipe">
          <Pencil size={19} />
        </button>
      </header>
      <div className="px-4 pb-8 flex flex-col gap-3">{body}</div>
    </Sheet>
  )
}

/** The phone's version: a screen of its own, over the list, that keeps its place. */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panel = useDialog<HTMLDivElement>(onClose)
  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-title"
      data-recipe-detail
      className="fixed inset-0 z-40 bg-cream-50 overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  )
}

/** The servings control: what the shopping is scaled to. */
function Stepper({ wanted, onLess, onMore, boxed }: {
  wanted: number
  onLess: () => void
  onMore: () => void
  boxed: boolean
}) {
  const button = boxed
    ? 'inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-xl border border-border-200 bg-paper text-ink-900 cursor-pointer hover:border-bite-300 disabled:opacity-45 disabled:cursor-not-allowed'
    : 'btn-ghost btn-icon text-bite-700'
  return (
    <div role="group" aria-labelledby={boxed ? 'recipe-servings' : undefined} aria-label={boxed ? undefined : 'Servings'} className="flex items-center gap-1.5">
      <button className={button} onClick={onLess} disabled={wanted <= 1} aria-label="One serving fewer">
        <Minus size={16} />
      </button>
      <output aria-live="polite" className={`text-center font-extrabold text-ink-900 tabular-nums whitespace-nowrap ${boxed ? 'min-w-7 text-lg' : 'min-w-20 text-sm'}`}>
        {boxed ? wanted : `${wanted} ${wanted === 1 ? 'serving' : 'servings'}`}
      </output>
      <button className={button} onClick={onMore} disabled={wanted >= 99} aria-label="One serving more">
        <Plus size={16} />
      </button>
    </div>
  )
}

/**
 * The per-serving figures as tiles, each with a thin bar against a day's
 * target, so a figure says whether this is a big dinner as well as what it is.
 */
function PerServing({ n, targets, partial, docked = false }: {
  n: Nutrients
  targets: Targets
  partial: readonly string[]
  docked?: boolean
}) {
  const tiles = [
    ...(docked ? [{ label: 'Energy', value: n.calories, unit: 'kcal', target: targets.calories, floor: false, lead: true }] : []),
    { label: 'Protein', value: n.protein, unit: 'g', target: targets.protein, floor: false, lead: false },
    { label: 'Carbs', value: n.carbs, unit: 'g', target: targets.carbs, floor: false, lead: false },
    { label: 'Fat', value: n.fat, unit: 'g', target: targets.fat, floor: false, lead: false },
    { label: 'Fibre', value: n.fiber ?? 0, unit: 'g', target: targets.fiber, floor: partial.includes('fiber'), lead: false },
  ]
  return (
    <dl className={`flex-1 grid gap-2 ${docked ? 'grid-cols-5' : 'grid-cols-4'}`}>
      {tiles.map((t) => {
        const fill = t.target && t.target > 0 ? Math.min(100, (t.value / t.target) * 100) : 0
        return (
          <div key={t.label} className={`rounded-2xl px-2.5 py-2 flex flex-col gap-0.5 min-w-0 ${t.lead ? 'bg-bite-100' : 'bg-cream-50'}`}>
            <dt className="text-xs text-ink-700 font-semibold">{t.label}</dt>
            <dd data-per-serving-kcal={t.lead || undefined} className={`font-extrabold text-ink-900 tabular-nums whitespace-nowrap ${docked ? 'text-xl leading-[26px]' : 'text-base leading-5'}`}>
              {Math.round(t.value)}{t.floor ? ' +' : ''}
              <span className="text-xs font-bold text-ink-700 ml-0.5">{t.unit === 'kcal' ? ' kcal' : ' g'}</span>
            </dd>
            <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-border-200 overflow-hidden">
              <div
                data-macro-fill
                className="h-full rounded-full bg-bite-500"
                style={{
                  width: `${fill}%`,
                  maskImage: t.floor ? 'linear-gradient(to right, black 55%, transparent 100%)' : undefined,
                  WebkitMaskImage: t.floor ? 'linear-gradient(to right, black 55%, transparent 100%)' : undefined,
                }}
              />
            </div>
          </div>
        )
      })}
    </dl>
  )
}

/** What the tiles mean, and what they cannot know. */
function Footnote({ n, partial, unresolved }: { n: Nutrients; partial: readonly string[]; unresolved: number }) {
  const salt = saltFromSodium(n.sodium)
  return (
    <p className="text-xs leading-4 text-ink-700">
      Per serving. Bars are one serving against a day&rsquo;s target, not against the recipe.
      {n.sugar != null && <> Sugar {Math.round(n.sugar * 10) / 10} g{partial.includes('sugar') ? ' +' : ''}.</>}
      {salt != null && <> Salt {salt.toFixed(2)} g{partial.includes('sodium') ? ' +' : ''}.</>}
      {partial.length > 0 && <> A <strong>+</strong> means a floor, not a total.</>}
      {unresolved > 0 && (
        <span className="text-coral-700">
          {' '}{unresolved === 1
            ? 'One thing here is missing from the library, so every figure is short.'
            : `${unresolved} things here are missing from the library, so every figure is short.`}
        </span>
      )}
    </p>
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
      <p className="text-xs font-bold text-ink-700 mb-1">
        {availabilityLabel(state)}
      </p>
      {missing.length > 0 && (
        <p className="text-sm text-ink-700">{missing.join(', ')}</p>
      )}
    </div>
  )
}
