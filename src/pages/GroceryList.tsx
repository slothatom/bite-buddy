import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Trash2, ShoppingBasket, Plus, X, Check, Share2, Copy, ChevronDown } from 'lucide-react'
import type { GroceryItem, MedCategory, PantryItem } from '../types'
import { useMealPlanStore, getRangeDates, today } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import { offerUndo } from '../store/useUndo'
import { useNutritionContext } from '../store/useNutrition'
import { EmptyState, SectionHeading, ChipCheck, SearchField } from '../components/ui'
import { PlanHeader } from '../components/planner/PlanHeader'
import { CATEGORY_LABELS } from '../lib/categories'
import { formatGrams, householdAmount, listAsText } from '../lib/grocery'
import { copyToClipboard } from '../lib/clipboard'
import { useMediaQuery } from '../lib/useMediaQuery'
import { usePantry, usePantryItems, usePantryStore } from '../store/usePantryStore'
import { useFoods } from '../store/useFoodStore'

/**
 * The shopping list.
 *
 * Grouped by the food categories rather than alphabetically, because that is
 * the order a market or supermarket is actually walked. On a phone what is
 * already in the basket drops to the bottom, out of the way of what is left;
 * on a wide screen, where the whole list is in view at once, a picked-up line
 * stays in its aisle and says so.
 *
 * Two things it has to allow, because a real shop does: choosing which days
 * you are buying for, since nobody shops for a whole month at once, and
 * changing the list afterwards. A list you cannot correct is a list you stop
 * trusting the first time it is wrong about an onion.
 */
export default function GroceryList() {
  const {
    groceryItems, generateGroceryList, toggleGroceryItem, addGroceryItem,
    updateGroceryItem, removeGroceryItem, clearCheckedItems, clearGroceryList,
    restoreGroceryItems, plan, cupboardCovered,
  } = useMealPlanStore()
  const thisWeek = useThisWeek()
  const ctx = useNutritionContext()
  const wide = useMediaQuery('(min-width: 768px)')
  const [justBuilt, setJustBuilt] = useState(false)
  /*
   * Which half of this screen, readable from the address, so "Open the
   * cupboard" elsewhere in the app can land on the cupboard rather than on
   * the list.
   */
  const [params, setParams] = useSearchParams()
  const tab: 'list' | 'cupboard' = params.get('tab') === 'cupboard' ? 'cupboard' : 'list'
  const setTab = (next: 'list' | 'cupboard') => {
    // Replaced rather than pushed: flipping a tab is not a place you want the
    // back button to walk you through one at a time.
    setParams(next === 'cupboard' ? { tab: 'cupboard' } : {}, { replace: true })
  }
  const [emptying, setEmptying] = useState(false)
  const pantry = usePantry()
  const { keep, drop: dropFromCupboard } = usePantryStore()

  /**
   * A fortnight of choices, starting today. Nobody shops backwards, so the
   * days that have gone are not offered.
   */
  const offered = useMemo(
    () => getRangeDates(thisWeek[0], 'fortnight')
      .filter((d) => d >= today()),
    [thisWeek],
  )

  const mealsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of plan) map.set(day.date, day.meals.length)
    return map
  }, [plan])

  // Days with food in them, to start with. Ticking an empty day adds nothing,
  // and starting with every day ticked would mean unticking most of them.
  const [days, setDays] = useState<string[]>(() =>
    offered.filter((d) => plan.find((p) => p.date === d)?.meals.length))
  /** Whether the days are open for changing. Open while there is no list. */
  const [choosing, setChoosing] = useState(false)

  // Ticked on Sunday night, still ticked on Monday morning, and by then it is
  // yesterday. Read the choice through the window rather than trusting it.
  const picked = useMemo(() => days.filter((d) => offered.includes(d)), [days, offered])

  const sortedGroups = (items: GroceryItem[]) => {
    const map = new Map<MedCategory, GroceryItem[]>()
    for (const item of items) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return [...map].sort((a, b) => CATEGORY_LABELS[a[0]].localeCompare(CATEGORY_LABELS[b[0]]))
  }

  const checked = groceryItems.filter((i) => i.checked)
  const typed = groceryItems.filter((i) => i.manual)
  const left = groceryItems.length - checked.length
  // A phone takes the picked-up lines out of their aisles and into a basket at
  // the bottom; a wide screen leaves them where they were.
  const grouped = useMemo(
    () => sortedGroups(wide ? groceryItems : groceryItems.filter((i) => !i.checked)),
    [groceryItems, wide],
  )
  const recipeCount = new Set(groceryItems.flatMap((i) => i.fromRecipeIds)).size

  /**
   * Takes lines off the list and offers them back for a few seconds, in the
   * order the list was in.
   */
  function drop(items: GroceryItem[], what: string, remove: () => void) {
    if (!items.length) return
    const before = groceryItems
    remove()
    offerUndo(what, () => restoreGroceryItems(before))
  }
  const clearPicked = () => drop(checked, `Cleared ${checked.length} picked up`, clearCheckedItems)
  const plannedMeals = picked.reduce((n, d) => n + (mealsByDate.get(d) ?? 0), 0)
  /**
   * Why the button is grey, when the button is grey: a plan that is entirely
   * in the past has nothing ahead to shop for, and saying so beats a disabled
   * button with no explanation.
   */
  const behind = useMemo(
    () => plan.some((d) => d.date < today() && d.meals.length),
    [plan],
  )
  const nothingToBuild = !plannedMeals && (behind ? 'behind' : 'nothing')

  function build() {
    generateGroceryList(ctx, { dates: picked, pantry })
    setJustBuilt(true)
    setChoosing(false)
    setTimeout(() => setJustBuilt(false), 1500)
  }

  const hasList = groceryItems.length > 0
  const buildLabel = hasList ? 'Rebuild' : 'Build list'
  const span = picked.length
    ? `${shortDay(picked[0])} to ${shortDay(picked[picked.length - 1])}`
    : 'no days yet'

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <PlanHeader
        actions={tab === 'list' && (
          <>
            {hasList && <CopyList items={groceryItems} label="Copy list" />}
            {hasList && <ShareList items={groceryItems} label="Share list" />}
            <button type="button" className="btn-primary min-h-11" onClick={build} disabled={!picked.length}>
              <RefreshCw size={16} aria-hidden="true" className={justBuilt ? 'animate-spin' : ''} />
              {hasList ? 'Rebuild from plan' : 'Build list'}
            </button>
          </>
        )}
      >
        <div className="flex gap-1 p-1 bg-border-100 rounded-lg w-fit">
          {(['list', 'cupboard'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? 'true' : undefined}
              className={tab === t ? 'segment-on' : 'segment-off'}
            >
              {t === 'list' ? 'To buy' : 'Cupboard'}
              {t === 'cupboard' && pantry.size > 0 && (
                <span className="ml-1.5 text-xs text-ink-700 tabular-nums">{pantry.size}</span>
              )}
            </button>
          ))}
        </div>
      </PlanHeader>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-3 md:pt-4 space-y-3">
        {tab === 'cupboard' && <Cupboard />}

        {tab === 'list' && (
          <>
            {/* How the shop is going. */}
            <section aria-label="How the shop is going" className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[15px] font-extrabold text-ink-900">
                    {hasList
                      ? `${checked.length} of ${groceryItems.length} picked up`
                      : nothingToBuild === 'behind'
                        ? 'Everything planned is on a day that has gone.'
                        : `Ready to build from ${plannedMeals} ${plannedMeals === 1 ? 'meal' : 'meals'}.`}
                    {hasList && wide && <span className="font-bold text-ink-700">{` · ${left} left`}</span>}
                  </span>
                  <span className="text-xs leading-4 text-ink-700">
                    {hasList && recipeCount > 0 && `From ${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}, `}
                    shopping for {span}
                  </span>
                </div>
                {hasList && (
                  <span className="flex items-center gap-1 md:hidden">
                    <CopyList items={groceryItems} label="Copy" />
                    <ShareList items={groceryItems} label="Share" primary />
                  </span>
                )}
              </div>
              {hasList && (
                <div
                  role="progressbar"
                  aria-label="Picked up"
                  aria-valuemin={0}
                  aria-valuemax={groceryItems.length}
                  aria-valuenow={checked.length}
                  className="h-2 rounded-full bg-border-100 overflow-hidden"
                >
                  <div
                    className="h-full bg-leaf-500 rounded-full transition-all duration-500"
                    style={{ width: `${(checked.length / groceryItems.length) * 100}%` }}
                  />
                </div>
              )}
            </section>

            {/* Which days, and building from them. Open while there is no
                list, since choosing the days is the first thing to do. */}
            <DayPicker
              open={!hasList || choosing}
              onOpen={() => setChoosing(!choosing)}
              span={span}
              dates={offered}
              picked={picked}
              mealsByDate={mealsByDate}
              onToggle={(date) =>
                setDays((d) => (d.includes(date) ? d.filter((x) => x !== date) : [...d, date]))}
              onAll={() => setDays(offered.filter((d) => mealsByDate.get(d)))}
              onNone={() => setDays([])}
              build={(
                <button
                  type="button"
                  className="btn-primary min-h-11 md:hidden"
                  onClick={build}
                  disabled={!picked.length}
                >
                  <RefreshCw size={15} aria-hidden="true" className={justBuilt ? 'animate-spin' : ''} />
                  {buildLabel}
                </button>
              )}
            />

            {/* Above the list, not below it: under forty lines it was off the
                bottom of the screen, and nobody could find it. */}
            <div className="flex flex-wrap items-center gap-2">
              <AddItem onAdd={(name, amount) => addGroceryItem({ name, amount })} />
              {wide && hasList && (
                <button type="button" className="btn-ghost min-h-11" disabled={!checked.length} onClick={clearPicked}>
                  Clear picked up
                </button>
              )}
            </div>

            {!hasList ? (
              <EmptyState title="Nothing on the list yet">
                {plannedMeals
                  ? 'Pick the days you are shopping for, then build it.'
                  : nothingToBuild === 'behind'
                    ? 'The meals you have planned are on days that have already gone, and a shopping list is for days ahead. Plan something for this week, or type a line in above.'
                    : 'Plan some meals first, then build the list from them, or type a line in above.'}
              </EmptyState>
            ) : (
              // One card on a phone; on a wide screen a card an aisle, laid out
              // as masonry so a short aisle does not leave a hole.
              <div className="md:columns-2 xl:columns-3 md:gap-4">
                <div className="card overflow-hidden md:contents">
                  {grouped.map(([category, items], i) => {
                    const toBuy = items.filter((x) => !x.checked).length
                    return (
                      <section
                        key={category}
                        aria-label={CATEGORY_LABELS[category]}
                        className={`${i ? 'border-t border-border-100' : ''} md:border md:border-border-200 md:bg-paper
                                    md:rounded-3xl md:shadow-e1 md:break-inside-avoid md:mb-4 md:overflow-hidden`}
                      >
                        <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-0.5 md:pt-3">
                          <h2 className="flex-1 text-xs leading-4 font-extrabold uppercase tracking-[0.06em] text-ink-700">
                            {CATEGORY_LABELS[category]}
                            {!wide && ` · ${items.length}`}
                          </h2>
                          {wide && (
                            <span className="text-xs font-bold text-ink-700">
                              {toBuy ? `${toBuy} left` : 'All picked up'}
                            </span>
                          )}
                        </div>
                        <ul className="pb-1">
                          {items.map((item) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              onToggle={() => toggleGroceryItem(item.id)}
                              onSave={(updates) => updateGroceryItem(item.id, updates)}
                              onRemove={() => drop([item], `Removed ${item.name}`,
                                () => removeGroceryItem(item.id))}
                              onHaveIt={item.foodId ? () => {
                                // Into the cupboard rather than merely off the
                                // list, with the amount that was on the line,
                                // so the next list does not ask again and a
                                // tap about today's tomatoes is not a claim
                                // about every future week.
                                keep({ foodId: item.foodId, grams: item.grams || undefined })
                                removeGroceryItem(item.id)
                              } : undefined}
                            />
                          ))}
                        </ul>
                      </section>
                    )
                  })}

                  {!wide && checked.length > 0 && (
                    <Basket
                      items={checked}
                      first={grouped.length === 0}
                      onClear={clearPicked}
                      row={(item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          onToggle={() => toggleGroceryItem(item.id)}
                          onSave={(updates) => updateGroceryItem(item.id, updates)}
                          onRemove={() => drop([item], `Removed ${item.name}`,
                            () => removeGroceryItem(item.id))}
                        />
                      )}
                    />
                  )}
                </div>
              </div>
            )}

            {/* What the cupboard took off, said out loud, and each one can be
                put back: a list that comes back shorter with no explanation is
                a list you stop trusting. */}
            {cupboardCovered.length > 0 && (
              <div className="space-y-2">
                <p className="text-[13px] text-ink-700">
                  <strong className="font-bold text-ink-900">
                    {cupboardCovered.length} {cupboardCovered.length === 1 ? 'thing is' : 'things are'}
                  </strong>{' '}
                  not on the list because your cupboard already covers{' '}
                  {cupboardCovered.length === 1 ? 'it' : 'them'}.{' '}
                  <button type="button" className="font-bold text-bite-700 underline min-h-11" onClick={() => setTab('cupboard')}>
                    Open the cupboard
                  </button>
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {cupboardCovered.map((c) => (
                    <li key={c.foodId}>
                      <button
                        type="button"
                        onClick={() => { dropFromCupboard(c.foodId); build() }}
                        className="chip-off"
                        aria-label={`Take ${c.name} out of the cupboard and put it back on the list`}
                      >
                        {c.name} <span className="text-ink-700">· put back</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasList && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="flex-1 min-w-60 flex items-start gap-2 text-xs text-ink-700">
                  <ShoppingBasket size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
                  Weights are raw, the way your plans are written: grains and meat before cooking.
                </p>
                {emptying ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => {
                        drop(
                          groceryItems,
                          `Emptied the list, ${groceryItems.length} ${groceryItems.length === 1 ? 'line' : 'lines'}`,
                          clearGroceryList)
                        setEmptying(false)
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Throw away {groceryItems.length}{' '}
                      {groceryItems.length === 1 ? 'line' : 'lines'}
                    </button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEmptying(false)}>
                      Keep them
                    </button>
                    {/* A typed line cannot be rebuilt from the plan, so it is
                        counted out rather than folded into a total that reads
                        as recoverable. */}
                    {typed.length > 0 && (
                      <span className="w-full text-xs text-coral-700">
                        {typed.length === 1
                          ? `1 of those is a line you typed (${typed[0].name}), and rebuilding will not bring it back.`
                          : `${typed.length} of those are lines you typed, and rebuilding will not bring them back.`}
                      </span>
                    )}
                  </span>
                ) : (
                  <button type="button" className="btn-ghost text-sm text-coral-700 min-h-11" onClick={() => setEmptying(true)}>
                    <Trash2 size={14} aria-hidden="true" /> Empty list
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** "Mon 9", the way a span of shopping days is said. */
function shortDay(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()}`
}

/**
 * What is already in the basket, on a phone.
 *
 * Out of the aisles and at the bottom, so what is left to find is what you
 * see. One line shows and the rest fold away behind a count; they are still
 * ticked off one at a time if a line went back on the shelf.
 */
function Basket({ items, first, onClear, row }: {
  items: GroceryItem[]
  first: boolean
  onClear: () => void
  row: (item: GroceryItem) => ReactNode
}) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 1)
  const hidden = items.length - shown.length

  return (
    <section aria-label="In the basket" className={first ? '' : 'border-t border-border-100'}>
      <div className="flex items-center gap-2 pl-3.5 pr-1.5 pt-1">
        <h2 className="flex-1 text-xs leading-4 font-extrabold uppercase tracking-[0.06em] text-leaf-700">
          In the basket · {items.length}
        </h2>
        <button type="button" className="min-h-11 px-2 text-[13px] font-bold text-bite-700" onClick={onClear}>
          Clear picked up
        </button>
      </div>
      <ul className="pb-1">{shown.map(row)}</ul>
      {(hidden > 0 || all) && items.length > 1 && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          className="w-full min-h-11 border-t border-border-100 text-[13px] font-bold text-bite-700 inline-flex items-center justify-center gap-1"
        >
          {all ? 'Show fewer' : `Show ${hidden} more picked up`}
          <ChevronDown size={16} aria-hidden="true" className={all ? 'rotate-180' : ''} />
        </button>
      )}
    </section>
  )
}

/**
 * What is already in the cupboard.
 *
 * Deliberately on this screen rather than one of its own, because it only means
 * anything next to the list it shortens. Two kinds of entry, and the difference
 * matters: something you have now, and something you always have.
 *
 * A staple never appears on a list again. That is the setting worth having:
 * without it a week of real cooking produces forty lines, thirty of which are
 * salt, oil and flour, and a list you read past is a list you stop reading.
 */
function Cupboard() {
  const foods = useFoods()
  const items = usePantryItems()
  const { keep, drop, toggleStaple } = usePantryStore()
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])

  const matches = useMemo(() => {
    const n = query.trim().toLowerCase()
    if (!n) return []
    const have = new Set(items.map((i) => i.foodId))
    return foods.filter((f) => !have.has(f.id) && f.names.en.toLowerCase().includes(n)).slice(0, 8)
  }, [query, foods, items])

  const staples = items.filter((i) => i.staple)
  const rest = items.filter((i) => !i.staple)

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">Add something you have</p>
          <p className="text-xs text-ink-500">
            Anything in here comes off the shopping list. Say how much only if you want to:
            leaving it blank means enough.
          </p>
        </div>

        <SearchField
          placeholder="Search your foods"
          value={query}
          onChange={setQuery}
        />

        {matches.map((f) => (
          <button
            key={f.id}
            onClick={() => { keep({ foodId: f.id }); setQuery('') }}
            className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-cream-50 text-left"
          >
            <Plus size={14} className="text-ink-500 shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{f.names.en}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nothing in the cupboard yet">
          Add the things you always have, salt, oil, flour, and they stop appearing on every
          list. Anything else you add comes off the next list you build.
        </EmptyState>
      ) : (
        <>
          {staples.length > 0 && (
            <section>
              <SectionHeading>Always have</SectionHeading>
              <div className="card divide-y divide-border-100">
                {staples.map((i) => (
                  <PantryRow
                    key={i.foodId}
                    name={byId.get(i.foodId)?.names.en ?? i.foodId}
                    item={i}
                    onAmount={(grams) => keep({ foodId: i.foodId, grams, staple: i.staple })}
                    onStaple={() => toggleStaple(i.foodId)}
                    onDrop={() => drop(i.foodId)}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <SectionHeading>In right now</SectionHeading>
              <div className="card divide-y divide-border-100">
                {rest.map((i) => (
                  <PantryRow
                    key={i.foodId}
                    name={byId.get(i.foodId)?.names.en ?? i.foodId}
                    item={i}
                    onAmount={(grams) => keep({ foodId: i.foodId, grams })}
                    onStaple={() => toggleStaple(i.foodId)}
                    onDrop={() => drop(i.foodId)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/**
 * One thing you have.
 *
 * The amount is optional and stays optional: blank means enough, which is what
 * anybody means when they say they have olive oil. A number is believed and
 * subtracted, because 200 g of the 500 g a week needs is a real answer.
 */
function PantryRow({
  name, item, onAmount, onStaple, onDrop,
}: {
  name: string
  item: PantryItem
  onAmount: (grams: number | undefined) => void
  onStaple: () => void
  onDrop: () => void
}) {
  /*
   * The name first, and never squeezed to nothing.
   *
   * `flex-1` gives an item a basis of zero, so the name only ever got what the
   * fixed-width controls left over. At 331 px that was 20 px: "Wholemeal
   * bread" rendered as a single letter and an ellipsis, on the one row where
   * the name is the only thing you are reading. Measured, not guessed.
   *
   * So the row wraps, the name holds a floor of 7rem, and the controls travel
   * together to a second line rather than shrinking. Same shape as the
   * planner's entry rows, which met this a fortnight earlier.
   */
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 p-3">
      <span className="flex-auto min-w-28 text-sm text-ink-900 truncate">{name}</span>

      <span className="flex items-center gap-2 shrink-0 ml-auto">
        <input
          type="number"
          min={0}
          className="input w-24 px-2 text-sm"
          placeholder="enough"
          aria-label={`How much ${name}`}
          value={item.grams ?? ''}
          onChange={(e) => onAmount(e.target.value === '' ? undefined : Number(e.target.value))}
        />
        <span className="text-xs text-ink-500 shrink-0 w-3">{item.grams ? 'g' : ''}</span>

        <button
          onClick={onStaple}
          aria-pressed={Boolean(item.staple)}
          aria-label={`Always have ${name}`}
          className={item.staple ? 'chip-on shrink-0' : 'chip-off shrink-0'}
        >
          <ChipCheck on={item.staple} />
          Always
        </button>

        <button
          className="btn-ghost btn-icon text-ink-300 hover:text-coral-600 shrink-0"
          onClick={onDrop}
          aria-label={`Remove ${name} from the cupboard`}
        >
          <X size={15} />
        </button>
      </span>
    </div>
  )
}


/**
 * Which days you are buying for.
 *
 * Days with nothing planned are shown but cannot be ticked: ticking one would
 * add nothing to the list, and hiding them entirely makes the fortnight look
 * shorter than it is. Days that have gone are not passed in at all.
 *
 * Folded to one line once there is a list, since the days are chosen once a
 * shop and the list is what you came for.
 */
function DayPicker({
  open, onOpen, span, dates, picked, mealsByDate, onToggle, onAll, onNone, build,
}: {
  open: boolean
  onOpen: () => void
  span: string
  dates: string[]
  picked: string[]
  mealsByDate: Map<string, number>
  onToggle: (date: string) => void
  onAll: () => void
  onNone: () => void
  build: ReactNode
}) {
  return (
    <div className="card p-3.5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="flex-1 min-w-0 min-h-11 flex items-center gap-1.5"
        >
          <span className="text-sm font-bold text-ink-900">Shopping for</span>
          <span className="text-sm text-ink-700">{span}</span>
          <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-ink-700 ${open ? 'rotate-180' : ''}`} />
        </button>
        {build}
      </div>
      {open && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-700">Tick the days to buy for.</p>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" className="btn-ghost text-xs" onClick={onAll}>All planned</button>
              <button type="button" className="btn-ghost text-xs" onClick={onNone}>None</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {dates.map((date) => {
              const meals = mealsByDate.get(date) ?? 0
              const on = picked.includes(date)
              const d = new Date(date + 'T12:00:00')
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!meals}
                  onClick={() => onToggle(date)}
                  aria-pressed={on}
                  aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  className={`rounded-xl py-2 min-h-14 text-center border transition-colors ${
                    on ? 'bg-bite-500 text-on-brand border-bite-500'
                      : meals ? 'bg-paper border-border-200 text-ink-900 hover:border-bite-700'
                        : 'bg-cream-50 border-transparent text-ink-700'
                  }`}
                >
                  <span className="block text-xs font-bold uppercase">
                    {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className="block text-sm font-extrabold leading-tight">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One line: ticked off, corrected or thrown away, and, for a line the plan
 * asked for, waved off as something you already have.
 *
 * The name opens the line for correcting; the box ticks it. Each says which
 * recipe wanted it, because "200 g spinach" is easier to judge when you know
 * it is for Thursday's cod.
 */
function ItemRow({
  item, onToggle, onSave, onRemove, onHaveIt,
}: {
  item: GroceryItem
  onToggle: () => void
  onSave: (updates: { name?: string; amount?: string }) => void
  onRemove: () => void
  /** Only for lines that came from the plan: a typed-in line names no food. */
  onHaveIt?: () => void
}) {
  const ctx = useNutritionContext()
  const shown = item.amount ?? (item.grams ? formatGrams(item.grams) : '')

  // What to put in the basket, where the app can say it. The grams stay
  // beside it, because they are what the plan actually asked for.
  const household = item.amount
    ? undefined
    : householdAmount(item.grams, ctx.foods.get(item.foodId)?.units)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(shown)

  const recipes = item.fromRecipeIds
    .map((id) => ctx.recipes.get(id)?.name.en)
    .filter((n): n is string => Boolean(n))
  const why = item.manual
    ? 'Added by hand'
    : recipes.length > 2
      ? `From ${recipes.length} recipes`
      : recipes.length ? `For ${recipes.join(', ')}` : ''
  const meta = item.checked ? ['Picked up', why].filter(Boolean).join(' · ') : why

  if (editing) {
    return (
      <li className="flex items-center gap-2 px-3 py-2">
        <input
          className="input flex-1 min-w-0" value={name} aria-label="Item"
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-24 shrink-0" value={amount} aria-label="Amount"
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary btn-icon shrink-0"
          aria-label="Save item"
          onClick={() => { onSave({ name, amount }); setEditing(false) }}
        >
          <Check size={15} aria-hidden="true" />
        </button>
        {onHaveIt && (
          <button
            type="button"
            className="btn-ghost shrink-0 text-xs"
            aria-label={`We already have ${item.name}`}
            onClick={onHaveIt}
          >
            Have it
          </button>
        )}
        <button
          type="button"
          className="btn-ghost btn-icon shrink-0 text-ink-700 hover:text-coral-700"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </li>
    )
  }

  const edit = () => { setName(item.name); setAmount(shown); setEditing(true) }

  return (
    <li className="flex items-center gap-1 pl-1 pr-1.5 min-h-[52px]">
      <label className="w-11 h-11 shrink-0 flex items-center justify-center cursor-pointer">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onToggle}
          aria-label={item.name}
          className="w-[22px] h-[22px] accent-bite-700"
        />
      </label>
      <span className="flex-1 min-w-0 flex flex-col">
        <button
          type="button"
          className={`text-left text-[15px] leading-5 font-bold ${item.checked ? 'line-through text-ink-700' : 'text-ink-900'}`}
          onClick={edit}
        >
          {item.name}
        </button>
        {meta && <span className="text-xs leading-4 text-ink-700 line-clamp-2">{meta}</span>}
      </span>
      <button
        type="button"
        className="shrink-0 min-h-11 px-1 text-sm font-bold text-ink-700 tabular-nums text-right"
        aria-label={`Edit ${item.name}`}
        onClick={edit}
      >
        {item.checked && !household && !shown ? '' : household ? (
          <>
            {household}
            <span className="ml-1.5 text-xs font-semibold">{shown}</span>
          </>
        ) : shown}
      </button>
      {onHaveIt && !item.checked && (
        <button
          type="button"
          onClick={onHaveIt}
          aria-label={`We already have ${item.name}`}
          className="shrink-0 min-h-11 px-2.5 rounded-full border border-border-200 bg-paper text-xs font-bold text-ink-700 hover:border-bite-700"
        >
          Have it
        </button>
      )}
    </li>
  )
}

/** Anything the plan cannot know about: washing-up liquid, a birthday cake. */
function AddItem({ onAdd }: { onAdd: (name: string, amount: string) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  function submit() {
    if (!name.trim()) return
    onAdd(name, amount)
    setName('')
    setAmount('')
  }

  return (
    <form
      className="flex-1 min-w-0 md:max-w-xl flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
      <input
        className="input flex-1 min-w-0 min-h-11"
        placeholder="Add something else, like 2 lemons"
        aria-label="Add an item"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="input w-24 md:w-32 shrink-0 min-h-11"
        placeholder="How much"
        aria-label="How much"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button
        type="submit"
        className="btn-secondary min-h-11 shrink-0 px-3"
        aria-label="Add to list"
        disabled={!name.trim()}
      >
        <Plus size={16} aria-hidden="true" /> Add
      </button>
    </form>
  )
}

/** Only what is left to buy: a list of things already in the trolley is not a shopping list. */
function useListText(items: GroceryItem[]): () => string {
  const ctx = useNutritionContext()
  return () => listAsText(items, CATEGORY_LABELS, (item) => item.amount
    ?? householdAmount(item.grams, ctx.foods.get(item.foodId)?.units)
    ?? (item.grams ? formatGrams(item.grams) : ''))
}

/** The list as text, onto the clipboard, for pasting into a message. */
function CopyList({ items, label }: { items: GroceryItem[]; label: string }) {
  const text = useListText(items)
  const [said, setSaid] = useState<string | null>(null)

  async function copy() {
    setSaid(await copyToClipboard(text()) ? 'Copied' : 'Could not copy')
    setTimeout(() => setSaid(null), 2000)
  }

  return (
    <button type="button" className="btn-secondary min-h-11" onClick={copy}>
      <Copy size={15} aria-hidden="true" /> {said ?? label}
    </button>
  )
}

/**
 * Handing the list to somebody who is not in the app: the share sheet where
 * the browser has one, which on a phone is the one everybody knows, and the
 * clipboard everywhere else.
 */
function ShareList({ items, label, primary = false }: { items: GroceryItem[]; label: string; primary?: boolean }) {
  const text = useListText(items)
  const [said, setSaid] = useState<string | null>(null)

  async function share() {
    const body = text()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shopping list', text: body })
        return
      } catch {
        // Dismissed, or refused. Fall through to the clipboard rather than
        // leaving the button having done nothing at all.
      }
    }
    setSaid(await copyToClipboard(body) ? 'Copied' : 'Could not copy')
    setTimeout(() => setSaid(null), 2000)
  }

  return (
    <button type="button" className={`${primary ? 'btn-primary' : 'btn-secondary'} min-h-11`} onClick={share}>
      <Share2 size={15} aria-hidden="true" /> {said ?? label}
    </button>
  )
}
