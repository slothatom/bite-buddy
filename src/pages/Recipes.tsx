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
import { throughLens, LENSES, type Lens } from '../lib/discovery'
import { useUserStore } from '../store/useUserStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import {
  categoriesOnShelf, favouritesFirst, matchRecipes, onShelf, type RecipeTab as Tab,
} from '../lib/recipes/shelf'
import { RecipeRow } from '../components/recipes/RecipeRow'
import { TidyBanner } from '../components/recipes/TidyBanner'
import { EmptyShelf } from '../components/recipes/EmptyShelf'
import { RecipeDetail } from '../components/recipes/RecipeDetail'
import { LensRule } from '../components/recipes/LensBar'
import { FilterChips } from '../components/recipes/FilterChips'
import { CategorySheet } from '../components/recipes/CategorySheet'
import { FiltersSheet } from '../components/recipes/FiltersSheet'
import SectionTabs from '../components/layout/SectionTabs'
import { SECTION_TABS } from '../components/layout/nav'
import { useMediaQuery } from '../lib/useMediaQuery'

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
 * the two axes they are. The shelf is a list rather than a grid of cards, so a
 * phone shows six dishes at a time instead of three, and on a wide screen the
 * recipe you pick opens beside the list rather than over it.
 */

export default function Recipes() {
  const recipes = useRecipes()
  const { favouriteIds, custom, mergeRecipes, removeRecipe } = useRecipeStore()
  const ctx = useNutritionContext()
  // Two panes, the list and the recipe, once there is room for both.
  const wide = useMediaQuery('(min-width: 1024px)', false)

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
   * An id rather than a name because names get merged and re-worded, and the
   * id also says which of the wordings was the one planned.
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
   * What each filter would leave, on the shelf you are looking at, counted
   * against everything the search and the other chips already allow, so the
   * numbers answer "and this one too?".
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
   * compose: "quick" inside "soups" is a sensible question.
   */
  const lensed = useMemo(
    () => (lens ? throughLens(lens, lensInput) : matching),
    [lens, lensInput, matching],
  )

  /**
   * The number on a shelf counts rows, not recipes: grouping the repeats means
   * the two differ, and a shelf promising 77 things that then shows 49 lies.
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
   * at six in the evening searched dinner and said there was nothing, when it
   * is on the breakfast shelf. So the shelf gives way and the screen says so.
   */
  const shown = useMemo(() => {
    const shelf = onShelf(lensed, tab, mine)

    const list = shelf.length === 0 && query.trim() ? lensed : shelf

    // A lens is an order as much as a filter, so its order is kept.
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

  /** One row per dish, not one per portion. */
  const cards = useMemo(() => groupVariants(shown), [shown])

  const filtered = Boolean(query || category || filters.length || favesOnly)

  /**
   * Only the categories that are actually on this shelf, with their counts:
   * offering the other nineteen would be offering nineteen empty screens.
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

  const openRecipe = (name: string) => {
    setOpenName(name)
    if (asked) setParams({}, { replace: true })
  }

  /**
   * Repeats across the whole library, not just this shelf, where every
   * version comes to the same numbers, which can be folded together without
   * anyone having to decide which portion to keep.
   */
  const tidyable = useMemo(
    () => interchangeableGroups(groupVariants(recipes), ctx),
    [recipes, ctx],
  )

  const clearAll = () => {
    setQuery(''); setCategory(null); setFilters([]); setFavesOnly(false); setLens(null)
  }

  const detail = openCard && (
    <RecipeDetail
      key={`${openCard.name}:${asked ?? ''}`}
      card={openCard}
      startId={asked ?? undefined}
      isMine={(r) => mine.has(r.id)}
      onEdit={(r) => { setEditing(r); closeRecipe() }}
      onClose={closeRecipe}
      docked={wide}
    />
  )

  return (
    <div className="flex-1 min-w-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3.5 md:pt-6 flex flex-col gap-3 md:gap-3.5">

        <header className="flex items-center gap-2 md:gap-3">
          <h1 className="flex-1 min-w-0 text-[22px] leading-7 md:text-2xl md:leading-8 font-extrabold text-ink-900">
            Recipes
          </h1>
          {/* The label collapses to the icon on a phone, so the button keeps an
              explicit name, otherwise it has none at all for a screen reader. */}
          <button className="btn-primary shrink-0" aria-label="New recipe" onClick={() => setEditing(null)}>
            <Plus size={16} /> <span className="hidden sm:inline">New recipe</span>
          </button>
        </header>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="md:w-60 md:shrink-0 md:[&>nav]:grid md:[&>nav]:auto-cols-fr">
            {/* Inside the screen's header, as the mockups have it, rather than
                above it: the title, then the library's two halves. */}
            <SectionTabs label={SECTION_TABS.recipes.label} tabs={SECTION_TABS.recipes.tabs} />
          </div>
          <SearchField
            aria-label="Search recipes"
            placeholder="Search in English, Romanian or Hungarian…"
            value={query}
            onChange={setQuery}
          />
        </div>

        {/* The shelves: the meal you are most likely looking for at this hour,
            with the rest a tap away. Two rows of three on a phone, so every
            shelf is in sight rather than some of them scrolled off the edge. */}
        <div
          role="group"
          aria-label="Shelves"
          className="grid grid-cols-3 sm:flex sm:w-fit gap-1 p-1 bg-border-100 rounded-2xl"
        >
          {([...RECIPE_GROUPS, 'mine'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              data-shelf={tab === t ? 'on' : undefined}
              className={`whitespace-nowrap rounded-xl px-2 sm:px-4 ${tab === t ? 'segment-on' : 'segment-off'}`}
            >
              {t === 'mine' ? 'Yours' : GROUP_LABELS[t]}
              <span className="ml-1.5 text-xs text-ink-700 font-semibold tabular-nums">{counts.get(t) ?? 0}</span>
            </button>
          ))}
        </div>

        <FilterChips
          favesOnly={favesOnly}
          category={category}
          filters={filters}
          lens={lens}
          lensInput={lensInput}
          filtered={filtered || Boolean(lens)}
          onToggleFaves={() => setFavesOnly((v) => !v)}
          onSheet={setSheet}
          onRemoveFilter={(f) => setFilters((s) => s.filter((x) => x !== f))}
          onLens={setLens}
          onClear={clearAll}
        />

        <LensRule lens={lens} lensInput={lensInput} />

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
          <p className="text-sm text-ink-700">{GROUP_BLURBS[tab]}</p>
        )}

        {searchedEverywhere && (
          <p className="text-sm text-ink-700">
            Nothing on this shelf, so this is every shelf.
          </p>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          {shown.length === 0 ? (
            <div className="lg:w-80 xl:w-95 lg:shrink-0">
              <EmptyShelf
                tab={tab}
                filtered={filtered}
                query={query}
                onNew={() => setEditing(null)}
                onClear={clearAll}
              />
            </div>
          ) : (
            <section
              aria-labelledby="recipes-count"
              className="lg:w-80 xl:w-95 lg:shrink-0 min-w-0 bg-paper border border-border-200 rounded-3xl overflow-hidden"
            >
              <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-border-100">
                <h2 id="recipes-count" className="text-base lg:text-[15px] leading-6 font-extrabold text-ink-900">
                  {cards.length} {cards.length === 1 ? 'recipe' : 'recipes'}
                </h2>
                <span className="text-xs text-ink-700 text-right">
                  {lens ? `${LENSES[lens].label}, in its order` : 'Favourites first'}
                </span>
              </div>
              <ul aria-label="Recipes">
                {cards.map((card) => (
                  <RecipeRow
                    key={card.variants[0].id}
                    card={card}
                    mine={card.variants.some((r) => mine.has(r.id))}
                    favourite={card.variants.some((r) => favouriteIds.includes(r.id))}
                    current={wide && openCard?.name === card.name}
                    onOpen={() => openRecipe(card.name)}
                    kcals={card.variants.map((r) => Math.round(recipePerServing(r, ctx).calories))}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Beside the list on a wide screen, so choosing between three soups
              is a click each rather than an open and a close each. */}
          {wide && (detail || (
            <div className="flex-1 min-w-0 min-h-60 flex items-center justify-center bg-paper border-2 border-dashed border-border-200 rounded-3xl p-6 text-center">
              <p className="text-sm text-ink-700">Pick a recipe to read it here.</p>
            </div>
          ))}
        </div>
      </div>

      {!wide && detail}

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
             * A new recipe has no meal tags, so the shelf its tags put it on is
             * Dishes, with the thing you had spent five minutes writing nowhere
             * in sight. Yours holds it whatever it is tagged.
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
