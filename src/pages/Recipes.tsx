import { useMemo, useState } from 'react'
import { offerUndo } from '../store/useUndo'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { DishCategory, QuickFilter, Recipe } from '../types'
import { useRecipes, useRecipeStore } from '../store/useRecipeStore'
import { useNutritionContext } from '../store/useNutrition'
import { today as todayDate } from '../store/useMealPlanStore'
import { recipePerServing } from '../lib/nutrition'
import { SearchField } from '../components/ui'
import RecipeEditor from '../components/recipes/RecipeEditor'
import {
  RECIPE_GROUPS, GROUP_LABELS, GROUP_BLURBS, groupsOf, groupForTime, groupVariants,
} from '../lib/recipeGroups'
import { QUICK_FILTERS, hasQuickFilter } from '../lib/dishCategories'
import { interchangeableGroups } from '../lib/mergeRecipes'
import { usePantry } from '../store/usePantryStore'
import { throughLens, type Lens } from '../lib/discovery'
import { useUserStore } from '../store/useUserStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import {
  categoriesOnShelf, favouritesFirst, matchRecipes, onShelf, type RecipeTab as Tab,
} from '../lib/recipes/shelf'
import { RecipeCard } from '../components/recipes/RecipeCard'
import { TidyBanner } from '../components/recipes/TidyBanner'
import { EmptyShelf } from '../components/recipes/EmptyShelf'
import { RecipeDetail } from '../components/recipes/RecipeDetail'
import { LensBar } from '../components/recipes/LensBar'
import { FilterChips } from '../components/recipes/FilterChips'
import { CategorySheet } from '../components/recipes/CategorySheet'
import { FiltersSheet } from '../components/recipes/FiltersSheet'

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

export default function Recipes() {
  const recipes = useRecipes()
  const { favouriteIds, toggleFavourite, custom, mergeRecipes, removeRecipe } = useRecipeStore()
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
  const matching = useMemo(
    () => matchRecipes(recipes, { query, category, filters, favesOnly, favouriteIds }),
    [recipes, query, category, filters, favesOnly, favouriteIds],
  )

  /**
   * What each filter would leave, on the shelf you are looking at.
   *
   * A filter with no number beside it is a guess: ticking one and watching a
   * list of forty change to a list of thirty-eight, somewhere below the fold,
   * tells you nothing. Counted against everything the search and the other
   * chips already allow, so the numbers answer "and this one too?".
   */
  const filterCounts = useMemo(() => {
    const pool = onShelf(matching, tab, mine)
    return new Map(QUICK_FILTERS.map((f) =>
      [f, groupVariants(pool.filter((r) => hasQuickFilter(r, f))).length]))
  }, [matching, tab, mine])

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
    const shelf = onShelf(lensed, tab, mine)

    const list = shelf.length === 0 && query.trim() ? lensed : shelf

    // A lens is an order as much as a filter. "Not lately" means longest gap
    // first and "Quick tonight" means quickest first, and re-sorting the
    // result alphabetically threw that away: turning one on changed the
    // caption and the count while the list underneath stayed in exactly the
    // order it was already in, which is indistinguishable from nothing having
    // happened.
    if (lens) return list

    // Favourites first, then alphabetical: the handful you actually cook should
    // not be somewhere in the middle of seventy.
    return favouritesFirst(list, favouriteIds)
  }, [lensed, tab, mine, favouriteIds, query, lens])

  /** True when the shelf was set aside because it had no matches. */
  const searchedEverywhere = useMemo(() => {
    if (!query.trim()) return false
    return onShelf(lensed, tab, mine).length === 0 && matching.length > 0
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
  const categoryCounts = useMemo(
    () => categoriesOnShelf(onShelf(recipes, tab, mine)),
    [recipes, tab, mine],
  )

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
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
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
          <SearchField
            placeholder="Search in English, Romanian or Hungarian…"
            value={query}
            onChange={setQuery}
          />

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

          <LensBar lens={lens} lensInput={lensInput} onLens={setLens} />

          {/*
            Two buttons rather than fifty chips. Thirty-eight categories and
            fourteen filters laid out flat would be a wall taller than the
            recipes underneath it, so each opens a sheet and what you have picked
            comes back as a chip you can take off.
          */}
          <FilterChips
            favesOnly={favesOnly}
            category={category}
            filters={filters}
            onToggleFaves={() => setFavesOnly((v) => !v)}
            onSheet={setSheet}
            onRemoveFilter={(f) => setFilters((s) => s.filter((x) => x !== f))}
          />
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
            query={query}
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
        <CategorySheet
          category={category}
          categoryCounts={categoryCounts}
          onPick={setCategory}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'filters' && (
        <FiltersSheet
          filters={filters}
          filterCounts={filterCounts}
          onFilters={setFilters}
          onClose={() => setSheet(null)}
        />
      )}

      {editing !== undefined && (
        <RecipeEditor
          recipe={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            /*
             * Where a recipe you just wrote can actually be found.
             *
             * This used to open the shelf its tags put it on, and a new recipe
             * has no meal tags, so `groupsOf` answered "dish" and the form
             * closed on Dishes: a screen of the fourteen weeks' batch cooking,
             * with the thing you had spent five minutes writing nowhere in
             * sight. Yours holds it whatever it is tagged, which is the one
             * answer that is always true.
             */
            if (editing === null) {
              setTab('mine')
              offerUndo(`Saved ${saved.name.en}`, () => removeRecipe(saved.id))
            }
          }}
        />
      )}
    </div>
  )
}
