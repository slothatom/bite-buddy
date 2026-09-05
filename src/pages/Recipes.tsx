import { useMemo, useState, type ReactNode } from 'react'
import { useDialog } from '../lib/useDialog'
import { useSearchParams } from 'react-router-dom'
import WhenPicker from '../components/planner/WhenPicker'
import { slotNow } from '../lib/whenDates'
import {
  Search, Star, X, ChefHat, Plus, Pencil, Clock, Layers, Combine, Undo2,
  ChevronDown, SlidersHorizontal, Minus, ExternalLink, CalendarPlus, Check,
} from 'lucide-react'
import type { DishCategory, MealSlot, QuickFilter, Recipe } from '../types'
import { DIFFICULTY_LABELS, MEAL_SLOTS } from '../types'
import { safeUrl, linkLabel } from '../lib/links'
import { useRecipes, useRecipeStore, useMergedInto } from '../store/useRecipeStore'
import { useNutritionContext } from '../store/useNutrition'
import { today as todayDate } from '../store/useMealPlanStore'
import { recipePerServing, reportPerServing, roundNutrients } from '../lib/nutrition'
import { normaliseTerm } from '../lib/units'
import { NutrientSummary, EmptyState, SourceLine } from '../components/ui'
import RecipeEditor from '../components/recipes/RecipeEditor'
import {
  RECIPE_GROUPS, GROUP_LABELS, GROUP_BLURBS,
  groupsOf, groupForTime, groupVariants,
  type RecipeGroup, type RecipeVariants,
} from '../lib/recipeGroups'
import {
  DISH_CATEGORIES, CATEGORY_LABELS, QUICK_FILTERS, QUICK_FILTER_DEFINITIONS,
  hasQuickFilter, quickFilterLabel, mealTimesOf,
} from '../lib/dishCategories'
import { interchangeableGroups } from '../lib/mergeRecipes'
import { usePantry } from '../store/usePantryStore'
import { availability, availabilityLabel, missingFoods } from '../lib/pantry'
import { throughLens, lensReady, lensBlocker, LENSES, LENS_ORDER, type Lens } from '../lib/discovery'
import { timeIsEstimated } from '../lib/cookingTimes'
import { useUserStore } from '../store/useUserStore'
import { useMealPlanStore } from '../store/useMealPlanStore'

/**
 * The recipe library.
 *
 * This used to be one alphabetical grid of 228 cards behind thirteen filter
 * chips, every recipe in the app, in one undifferentiated wall, sorted by a
 * property nobody thinks in. Finding tomorrow's dinner meant scrolling past two
 * hundred things that were not dinner.
 *
 * Now it opens on a shelf: the meal you are most likely looking for at this hour,
 * with the rest a tap away. See lib/recipeGroups.ts for why the categories are
 * the two axes they are.
 */

/** "Yours" is a shelf too, but a different kind, it cuts across the meals. */
type Tab = RecipeGroup | 'mine'

export default function Recipes() {
  const recipes = useRecipes()
  const { favouriteIds, toggleFavourite, custom, mergeRecipes } = useRecipeStore()
  const ctx = useNutritionContext()

  const [tab, setTab] = useState<Tab>(() => groupForTime())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<DishCategory | null>(null)
  const [filters, setFilters] = useState<QuickFilter[]>([])
  const [favesOnly, setFavesOnly] = useState(false)
  const [sheet, setSheet] = useState<'category' | 'filters' | null>(null)
  // The name rather than the group itself: merging changes what the group
  // contains, and a sheet holding a snapshot went on listing versions that had
  // just been folded away.
  const [openName, setOpenName] = useState<string | null>(null)
  /**
   * A recipe named in the address, so a planned meal can open the thing it is.
   *
   * The planner had no way through to a recipe at all: you read "Cabbage soup
   * with wholemeal bread" on Tuesday, wanted to know what went in it, and had
   * to come here and search for it by name. An id rather than a name because
   * names get merged and re-worded, and the id also says which of the wordings
   * was the one planned.
   */
  const [params, setParams] = useSearchParams()
  const asked = params.get('recipe')
  const [editing, setEditing] = useState<Recipe | null | undefined>(undefined)

  const mine = useMemo(() => new Set(custom.map((r) => r.id)), [custom])
  const pantry = usePantry()
  const plan = useMealPlanStore((s) => s.plan)
  const { profile } = useUserStore()
  const today = todayDate()

  /**
   * The question being asked, rather than another thing to tick.
   *
   * Nobody stands in a kitchen at seven wondering about categories. They wonder
   * what is quick, what can be made from what is in, what needs using up. Each
   * of those is a different order as much as a different filter, so it is one
   * choice at a time and the rule is printed underneath rather than implied.
   */
  const [lens, setLens] = useState<Lens | null>(null)

  /** Everything the search and chips allow, before the shelf is chosen. */
  const matching = useMemo(() => {
    const n = normaliseTerm(query)
    return recipes.filter((r) => {
      if (favesOnly && !favouriteIds.includes(r.id)) return false
      if (category && r.category !== category) return false
      // Every ticked filter has to hold: they narrow together, they do not pile up.
      if (filters.some((f) => !hasQuickFilter(r, f))) return false

      if (!n) return true
      // The dietician's own line is searched too, so "telemea" finds the meals
      // that were written in Romanian.
      const haystack = normaliseTerm(
        [r.name.en, r.name.ro, r.name.hu, r.sourceLine].filter(Boolean).join(' '))
      return haystack.includes(n)
    })
  }, [recipes, query, category, filters, favesOnly, favouriteIds])

  const lensInput = useMemo(
    () => ({ recipes: matching, ctx, today, plan, pantry, targets: profile.targets }),
    [matching, ctx, today, plan, pantry, profile.targets],
  )

  /**
   * The lens applies last, over whatever the search and chips left, so the two
   * compose: "quick" inside "soups" is a sensible question and the alternative
   * would be two filters fighting each other.
   */
  const lensed = useMemo(
    () => (lens ? throughLens(lens, lensInput) : matching),
    [lens, lensInput, matching],
  )

  /**
   * The number on a tab counts cards, not recipes.
   *
   * Grouping the repeats means the two differ, Breakfast holds 77 recipes but
   * shows 49 cards, and a tab promising 77 things that then shows 49 is a tab
   * that lies. It counts what you will see.
   */
  const counts = useMemo(() => {
    const c = new Map<Tab, number>()
    for (const g of RECIPE_GROUPS) {
      c.set(g, groupVariants(lensed.filter((r) => groupsOf(r).includes(g))).length)
    }
    c.set('mine', groupVariants(lensed.filter((r) => mine.has(r.id))).length)
    return c
  }, [lensed, mine])

  /**
   * Searching looks past the shelf you happen to be on.
   *
   * The shelf you land on depends on the time of day, so searching "telemea"
   * at six in the evening searched dinner, found nothing, and said there was
   * nothing, when it is on the breakfast shelf. A search that answers "no"
   * about food you own is worse than a search that ignores a filter, so the
   * shelf gives way and the screen says it did.
   */
  const shown = useMemo(() => {
    const onShelf = tab === 'mine'
      ? lensed.filter((r) => mine.has(r.id))
      : lensed.filter((r) => groupsOf(r).includes(tab))

    const list = onShelf.length === 0 && query.trim() ? lensed : onShelf

    // Favourites first, then alphabetical: the handful you actually cook should
    // not be somewhere in the middle of seventy.
    return [...list].sort((a, b) => {
      const fav = Number(favouriteIds.includes(b.id)) - Number(favouriteIds.includes(a.id))
      return fav || a.name.en.localeCompare(b.name.en)
    })
  }, [lensed, tab, mine, favouriteIds, query])

  /** True when the shelf was set aside because it had no matches. */
  const searchedEverywhere = useMemo(() => {
    if (!query.trim()) return false
    const onShelf = tab === 'mine'
      ? lensed.filter((r) => mine.has(r.id))
      : lensed.filter((r) => groupsOf(r).includes(tab))
    return onShelf.length === 0 && matching.length > 0
  }, [lensed, matching, tab, mine, query])

  /** One card per dish, not one per portion. */
  const cards = useMemo(() => groupVariants(shown), [shown])

  const filtered = Boolean(query || category || filters.length || favesOnly)

  /**
   * Only the categories that are actually on this shelf, with their counts.
   *
   * Thirty-eight categories exist and this library uses nineteen of them.
   * Offering the other nineteen would be offering nineteen ways to see an empty
   * screen, which is the wall this page was rebuilt to get rid of. The full list
   * is still there when you are writing a recipe, where it belongs.
   */
  const categoryCounts = useMemo(() => {
    const onShelf = tab === 'mine'
      ? recipes.filter((r) => mine.has(r.id))
      : recipes.filter((r) => groupsOf(r).includes(tab))

    const counted = new Map<DishCategory, number>()
    for (const r of onShelf) {
      if (r.category) counted.set(r.category, (counted.get(r.category) ?? 0) + 1)
    }
    return DISH_CATEGORIES.filter((c) => counted.has(c)).map((c) => [c, counted.get(c)!] as const)
  }, [recipes, tab, mine])

  // Looked up across the whole library, not the current shelf, so changing a
  // filter underneath an open recipe does not shut it.
  const openCard = useMemo(() => {
    const cards = groupVariants(recipes)
    if (asked) return cards.find((c) => c.variants.some((r) => r.id === asked)) ?? null
    return openName ? cards.find((c) => c.name === openName) ?? null : null
  }, [openName, asked, recipes])

  // Closing a recipe that arrived from the address has to clear the address
  // too, or it reopens on the next render and cannot be shut at all.
  const closeRecipe = () => {
    setOpenName(null)
    if (asked) setParams({}, { replace: true })
  }

  /**
   * Repeats across the whole library, not just this shelf, where every
   * version comes to the same numbers. Those can be folded together without
   * anyone having to decide which portion to keep.
   */
  const tidyable = useMemo(
    () => interchangeableGroups(groupVariants(recipes), ctx),
    [recipes, ctx],
  )

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display text-xl sm:text-2xl text-ink-900">Recipes</h1>
            <p className="text-sm text-ink-700">
              Every meal from your dietician plans, plus the dishes behind them.
            </p>
          </div>
          {/* The label collapses to the icon on a phone, so the button keeps an
              explicit name, otherwise it has none at all for a screen reader. */}
          <button className="btn-primary shrink-0" aria-label="New recipe" onClick={() => setEditing(null)}>
            <Plus size={16} /> <span className="hidden sm:inline">New recipe</span>
          </button>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="input pl-9"
              placeholder="Search in English, Romanian or Hungarian…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* The shelves. Scrolls sideways on a phone rather than wrapping to
              three lines and pushing the recipes off the screen. */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
            <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-max">
              {([...RECIPE_GROUPS, 'mine'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`shrink-0 whitespace-nowrap ${tab === t ? 'tab-on' : 'tab-off'}`}
                >
                  {t === 'mine' ? 'Yours' : GROUP_LABELS[t]}
                  <span className="ml-1.5 text-xs opacity-60 font-mono">{counts.get(t) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/*
            Two buttons rather than fifty chips. Thirty-eight categories and
            fourteen filters laid out flat would be a wall taller than the
            recipes underneath it, so each opens a sheet and what you have picked
            comes back as a chip you can take off.
          */}
          {/* One question at a time, and the rule underneath it. A filter
              nobody can explain is a filter nobody trusts. */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
            <div className="flex gap-1.5 w-max pb-0.5">
              {LENS_ORDER.map((l) => {
                const ready = lensReady(l, lensInput)
                const on = lens === l
                return (
                  <button
                    key={l}
                    onClick={() => setLens(on ? null : l)}
                    aria-pressed={on}
                    className={`shrink-0 whitespace-nowrap ${
                      on ? 'chip bg-teal-700 text-white border border-teal-700'
                        : ready ? 'chip-off' : 'chip-off opacity-50'
                    }`}
                  >
                    {LENSES[l].emoji} {LENSES[l].label}
                  </button>
                )
              })}
            </div>
          </div>

          {lens && (
            <p className="text-xs text-ink-500">
              {lensReady(lens, lensInput) ? LENSES[lens].rule : lensBlocker(lens)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFavesOnly((v) => !v)}
              className={favesOnly ? 'chip bg-coral-700 text-white border border-coral-700' : 'chip-off'}
            >
              <Star size={12} className={favesOnly ? 'fill-current' : ''} /> Favourites
            </button>

            <button className={category ? 'chip-on' : 'chip-off'} onClick={() => setSheet('category')}>
              {category ? CATEGORY_LABELS[category] : 'Any dish'} <ChevronDown size={13} />
            </button>

            <button className={filters.length ? 'chip-on' : 'chip-off'} onClick={() => setSheet('filters')}>
              <SlidersHorizontal size={12} />
              {filters.length ? `${filters.length} filter${filters.length === 1 ? '' : 's'}` : 'Filters'}
            </button>

            {filters.map((f) => (
              <button key={f} className="chip-on" onClick={() => setFilters((s) => s.filter((x) => x !== f))}>
                {quickFilterLabel(f)} <X size={12} />
              </button>
            ))}
          </div>
        </div>

        {tidyable.length > 0 && !filtered && (
          <TidyBanner
            groups={tidyable}
            onTidy={() => {
              for (const g of tidyable) {
                mergeRecipes(g.variants[0].id, g.variants.slice(1).map((r) => r.id))
              }
            }}
          />
        )}

        {tab !== 'mine' && !filtered && (
          <p className="text-sm text-ink-500 -mt-1">{GROUP_BLURBS[tab]}</p>
        )}

        {searchedEverywhere && (
          <p className="text-sm text-ink-500 -mt-1">
            Nothing on this shelf, so this is every shelf.
          </p>
        )}

        {shown.length === 0 ? (
          <EmptyShelf
            tab={tab}
            filtered={filtered}
            onNew={() => setEditing(null)}
            onClear={() => {
              setQuery(''); setCategory(null); setFilters([]); setFavesOnly(false); setLens(null)
            }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <RecipeCard
                key={card.variants[0].id}
                card={card}
                mine={card.variants.some((r) => mine.has(r.id))}
                favourite={card.variants.some((r) => favouriteIds.includes(r.id))}
                onToggleFavourite={() => {
                  // A dish is favourited, not one portion of it: the star covers
                  // every version so it cannot end up half-lit.
                  const anyOn = card.variants.some((r) => favouriteIds.includes(r.id))
                  for (const r of card.variants) {
                    if (favouriteIds.includes(r.id) === anyOn) toggleFavourite(r.id)
                  }
                }}
                onOpen={() => setOpenName(card.name)}
                kcals={card.variants.map((r) => Math.round(recipePerServing(r, ctx).calories))}
              />
            ))}
          </div>
        )}
      </div>

      {openCard && (
        <RecipeDetail
          card={openCard}
          startId={asked ?? undefined}
          isMine={(r) => mine.has(r.id)}
          onEdit={(r) => { setEditing(r); closeRecipe() }}
          onClose={closeRecipe}
        />
      )}

      {sheet === 'category' && (
        <PickerSheet title="What kind of dish?" onClose={() => setSheet(null)}>
          <button
            className={`w-full text-left px-4 py-3 rounded-xl ${category ? 'hover:bg-cream-50' : 'bg-cream-50 font-semibold'}`}
            onClick={() => { setCategory(null); setSheet(null) }}
          >
            Any dish
          </button>
          {categoryCounts.map(([c, n]) => (
            <button
              key={c}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${category === c ? 'bg-cream-50 font-semibold' : 'hover:bg-cream-50'}`}
              onClick={() => { setCategory(category === c ? null : c); setSheet(null) }}
            >
              <span className="flex-1 min-w-0 text-left text-ink-900">{CATEGORY_LABELS[c]}</span>
              <span className="text-xs font-mono text-ink-500">{n}</span>
            </button>
          ))}
          {!categoryCounts.length && (
            <p className="px-4 py-6 text-sm text-ink-500 text-center">Nothing on this shelf yet.</p>
          )}
        </PickerSheet>
      )}

      {sheet === 'filters' && (
        <PickerSheet title="Filters" onClose={() => setSheet(null)}>
          {QUICK_FILTERS.map((f) => {
            const d = QUICK_FILTER_DEFINITIONS[f]
            const on = filters.includes(f)
            return (
              <button
                key={f}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left ${on ? 'bg-bite-50' : 'hover:bg-cream-50'}`}
                onClick={() => setFilters((s) => (on ? s.filter((x) => x !== f) : [...s, f]))}
              >
                <span className="text-lg leading-none mt-0.5">{d.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${on ? 'font-bold text-bite-700' : 'text-ink-900'}`}>{d.label}</span>
                  <span className="block text-xs text-ink-500">{d.note}</span>
                </span>
                {!d.derived && (
                  <span className="text-[10px] text-ink-500 shrink-0 mt-1">yours to apply</span>
                )}
              </button>
            )
          })}
          {filters.length > 0 && (
            <button className="btn-secondary w-full mt-2" onClick={() => setFilters([])}>Clear all</button>
          )}
        </PickerSheet>
      )}

      {editing !== undefined && (
        <RecipeEditor
          recipe={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => { if (editing === null) setTab(groupsOf(saved)[0]) }}
        />
      )}
    </div>
  )
}

function RecipeCard({
  card, mine, favourite, kcals, onToggleFavourite, onOpen,
}: {
  card: RecipeVariants
  mine: boolean
  favourite: boolean
  kcals: number[]
  onToggleFavourite: () => void
  onOpen: () => void
}) {
  const lead = card.variants[0]
  const minutes = lead.prepMinutes + lead.cookMinutes
  const low = Math.min(...kcals)
  const high = Math.max(...kcals)

  return (
    // The star is a sibling of the card button, not a child: nested buttons are
    // invalid and lose their click handler.
    <div className="card p-4 md:p-3.5 relative min-w-0 hover:border-bite-300 hover:shadow-e2 transition-all">
      <button
        onClick={onToggleFavourite}
        className="absolute top-1.5 right-1.5 p-3.5 text-ink-300 hover:text-coral-600 z-10"
        aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Star size={16} className={favourite ? 'fill-coral-600 text-coral-600' : ''} />
      </button>
      <button onClick={onOpen} data-recipe-card className="block w-full min-w-0 text-left">
        <span className="flex items-start gap-3 pr-10 min-w-0">
          <span className="text-2xl leading-none shrink-0">{lead.emoji}</span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-ink-900 text-sm leading-snug">{card.name}</span>
            {lead.sourceLine ? (
              <span className="block mt-1">
                <SourceLine text={lead.sourceLine} clamp={2} translate />
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-xs font-mono text-ink-700">
          <span className="font-bold text-ink-900">
            {low === high ? `${low} kcal` : `${low}–${high} kcal`}
          </span>
          {minutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={11} />{timeIsEstimated(lead) ? 'about ' : ''}{minutes} min
            </span>
          )}
          {card.variants.length > 1 && (
            <span className="flex items-center gap-1 text-ink-500">
              <Layers size={11} />{card.variants.length} versions
            </span>
          )}
          {mine && <span className="badge bg-bite-100 text-bite-700 not-italic">yours</span>}
        </span>
      </button>
    </div>
  )
}

/**
 * A list you pick from, on a sheet.
 *
 * On a phone this comes up from the bottom where a thumb is; on a desktop it is
 * a centred dialog. Same component, because the content is a list either way and
 * two implementations would drift.
 */
function PickerSheet({
  title, children, onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const panel = useDialog<HTMLDivElement>(onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-200">
          <h2 className="text-base font-extrabold text-ink-900">{title}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">{children}</div>
      </div>
    </div>
  )
}

/**
 * The offer to tidy up the repeats that are only repeats.
 *
 * Only appears for groups whose versions come to the same numbers, a dish
 * written at 259 kcal and 408 kcal is a real choice about portions and is never
 * swept up here. It disappears once there is nothing left to fold, which is the
 * point: this is a chore, not a feature you are meant to keep visiting.
 */
function TidyBanner({ groups, onTidy }: { groups: RecipeVariants[]; onTidy: () => void }) {
  const [done, setDone] = useState(false)
  const extra = groups.reduce((n, g) => n + g.variants.length - 1, 0)

  if (done) return null

  return (
    // Deliberately not `.card`: a card on this screen means a recipe, and this
    // is a notice about them.
    <div className="rounded-2xl border border-bite-200 bg-bite-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <Combine size={20} className="text-bite-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-900">
          {groups.length} {groups.length === 1 ? 'dish is' : 'dishes are'} written down more than once
        </p>
        <p className="text-xs text-ink-700 mt-0.5">
          Same ingredients, same numbers, just worded differently from one week to the next.
          Folding them together removes {extra} {extra === 1 ? 'copy' : 'copies'}. Days you have
          already planned keep working, and each one can be undone.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="btn-primary" onClick={onTidy}>Merge them</button>
        <button className="btn-ghost text-ink-500" onClick={() => setDone(true)}>Not now</button>
      </div>
    </div>
  )
}

/** What an empty shelf should say depends on why it is empty. */
function EmptyShelf({
  tab, filtered, onNew, onClear,
}: {
  tab: Tab
  filtered: boolean
  onNew: () => void
  onClear: () => void
}) {
  if (filtered) {
    // Three dimensions can combine into a corner with nothing in it and no
    // shelf to move to, every tab reading zero. Telling you to try another
    // shelf would be useless advice, so there is a way straight out.
    return (
      <EmptyState title="Nothing matching that just yet">
        <p>That combination has nothing in it.</p>
        <button className="btn-primary mt-4" onClick={onClear}>Clear the filters</button>
      </EmptyState>
    )
  }

  if (tab === 'mine') {
    return (
      <EmptyState title="Nothing of your own yet" mood="thinking">
        <p>Every recipe here can be edited. Change one and your version lands on this shelf, with the original safe underneath.</p>
        <button className="btn-primary mt-4" onClick={onNew}><Plus size={16} /> Write one</button>
      </EmptyState>
    )
  }

  // The snack shelf used to have a sentence of its own explaining why it was
  // permanently empty. It is not empty any more, so the explanation went with
  // the emptiness.

  return (
    <EmptyState title={`Nothing on the ${GROUP_LABELS[tab].toLowerCase()} shelf`} mood="thinking">
      <button className="btn-primary mt-2" onClick={onNew}><Plus size={16} /> Write one</button>
    </EmptyState>
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
    <div className={`card-soft p-3 ${state.missing.length ? '' : 'bg-teal-50'}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1">
        {availabilityLabel(state)}
      </p>
      {missing.length > 0 && (
        <p className="text-sm text-ink-700">{missing.join(', ')}</p>
      )}
    </div>
  )
}

function RecipeDetail({
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
              {recipe.name.ro || recipe.name.hu ? (
                <p className="text-xs text-ink-500">{[recipe.name.ro, recipe.name.hu].filter(Boolean).join(' · ')}</p>
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
                    >
                      {i + 1}
                      <span className="ml-1.5 font-mono opacity-70">{kcal}</span>
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
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 mb-1">How your dietician wrote it</p>
              <SourceLine text={recipe.sourceLine} translate />
            </div>
          ) : null}

          {recipe.description ? (
            <div className="card-soft p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 mb-1">Your notes</p>
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
            <NutrientSummary n={perServing} partial={report.partial} unresolved={report.unresolved} />
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
                <span className="text-sm font-mono text-ink-900 tabular-nums w-16 text-center">
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
                  ? `${Math.round(c.grams * scale)} g`
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
                    <span className="shrink-0 w-5 h-5 rounded-full bg-bite-100 text-bite-800 text-xs font-bold grid place-items-center">
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
              servings={wanted}
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
 * Putting a recipe into a day, from the recipe.
 *
 * The flow this replaces was: browse, decide, close the sheet, open the
 * planner, find the day, search for the same dish again. Five steps to act on
 * a decision you had already made.
 *
 * The days offered are the week on screen in the planner, and the servings are
 * whatever the sheet was scaled to, so scaling a recipe to feed four and then
 * planning it keeps the four rather than silently going back to one.
 */
function PlanIntoDay({
  recipe, servings, onClose,
}: {
  recipe: Recipe
  servings: number
  onClose: () => void
}) {
  const { plan, addEntry } = useMealPlanStore()
  const panel = useDialog<HTMLDivElement>(onClose)
  const [date, setDate] = useState(todayDate)
  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )

  /**
   * The recipe's own meal times, where it has them, and the clock otherwise.
   *
   * It used to fall back to 'dinner', which meant opening a dinner recipe from
   * the Dinner shelf in the evening and being offered Breakfast, because the
   * fallback ran before the recipe's own tags were consulted for a match.
   */
  const times = mealTimesOf(recipe).map(String)
  const [slot, setSlot] = useState<MealSlot>(
    () => MEAL_SLOTS.find((s) => times.includes(s)) ?? slotNow(),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        aria-modal="true"
        className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Put ${recipe.name.en} in a day`}
      >
        <h3 className="font-bold text-ink-900 mb-1">{recipe.emoji} {recipe.name.en}</h3>
        <p className="text-sm text-ink-700 mb-4">
          {servings === 1 ? 'One serving' : `${servings} servings`}, on a day of your choosing.
        </p>

        <WhenPicker date={date} onDate={setDate} slot={slot} onSlot={setSlot} busy={busy} />

        <div className="mt-5" />

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={() => {
              addEntry(date, slot, { kind: 'recipe', recipeId: recipe.id, servings })
              onClose()
            }}
          >
            <Check size={15} /> Put it in
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

