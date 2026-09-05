import { useMemo, useState } from 'react'
import { RefreshCw, Trash2, ShoppingBasket, Plus, X, Check, Search, Share2 } from 'lucide-react'
import type { GroceryItem, MedCategory, PantryItem } from '../types'
import { useMealPlanStore, getRangeDates, today } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import { offerUndo } from '../store/useUndo'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { EmptyState, SectionHeading } from '../components/ui'
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '../lib/categories'
import { formatGrams, householdAmount, listAsText } from '../lib/grocery'
import { copyToClipboard } from '../lib/clipboard'
import { usePantry, usePantryItems, usePantryStore } from '../store/usePantryStore'
import { useFoods } from '../store/useFoodStore'

/**
 * The shopping list.
 *
 * Grouped by the food categories rather than alphabetically, because that is
 * the order a market or supermarket is actually walked.
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
    restoreGroceryItems, plan,
  } = useMealPlanStore()
  const { profile } = useUserStore()
  const thisWeek = useThisWeek()
  const ctx = useNutritionContext()
  const [justBuilt, setJustBuilt] = useState(false)
  const [tab, setTab] = useState<'list' | 'cupboard'>('list')
  const [emptying, setEmptying] = useState(false)
  const pantry = usePantry()
  const { keep } = usePantryStore()

  /**
   * A fortnight of choices, starting today.
   *
   * It used to start at `weekDates[0]`, the first day of the week on screen, so
   * on a Saturday it offered the five days that had already gone and a walkthrough
   * found the list being built for a week that had ended. Nobody shops backwards.
   */
  const offered = useMemo(
    () => getRangeDates(thisWeek[0], 'fortnight', profile.weekStartsOn)
      .filter((d) => d >= today()),
    [thisWeek, profile.weekStartsOn],
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

  // Ticked on Sunday night, still ticked on Monday morning, and by then it is
  // yesterday. The state is not pruned when the window moves, so read it
  // through the window rather than trusting it.
  const picked = useMemo(() => days.filter((d) => offered.includes(d)), [days, offered])

  const grouped = useMemo(() => {
    const map = new Map<MedCategory, GroceryItem[]>()
    for (const item of groceryItems) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return [...map].sort((a, b) => CATEGORY_LABELS[a[0]].localeCompare(CATEGORY_LABELS[b[0]]))
  }, [groceryItems])

  const checked = groceryItems.filter((i) => i.checked).length
  const typed = groceryItems.filter((i) => i.manual)


  /**
   * Takes lines off the list and offers them back for a few seconds.
   *
   * A typed line, the picked-up ones and the whole list all come back the same
   * way and in the order the list was in. `remove` is passed in because the
   * store already knows how to drop a set of lines in one write, and looping
   * over the singular would put twenty rows through sync where one would do.
   */
  function drop(items: GroceryItem[], what: string, remove: () => void) {
    if (!items.length) return
    const before = groceryItems
    remove()
    offerUndo(what, () => restoreGroceryItems(before))
  }
  const plannedMeals = picked.reduce((n, d) => n + (mealsByDate.get(d) ?? 0), 0)
  /**
   * Why the button is grey, when the button is grey.
   *
   * The list only offers days that are still ahead, which is right: nobody
   * shops backwards. But a plan that is entirely in the past then produced
   * "Ready to build from 0 meals" and a disabled button with no explanation
   * and no way out, which is a worse answer than the bug it replaced. The
   * days are there; the food is behind you.
   */
  const behind = useMemo(
    () => plan.some((d) => d.date < today() && d.meals.length),
    [plan],
  )
  const nothingToBuild = !plannedMeals && (behind ? 'behind' : 'nothing')

  function build() {
    generateGroceryList(ctx, { dates: picked, pantry })
    setJustBuilt(true)
    setTimeout(() => setJustBuilt(false), 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display text-xl sm:text-2xl text-ink-900">Shopping list</h1>
            <p className="text-sm text-ink-700">
              {groceryItems.length
                ? `${checked} of ${groceryItems.length} picked up`
                : nothingToBuild === 'behind'
                  ? 'Everything planned is on a day that has gone.'
                  : `Ready to build from ${plannedMeals} ${plannedMeals === 1 ? 'meal' : 'meals'}.`}
            </p>
          </div>
          <button className="btn-primary shrink-0" onClick={build} disabled={!picked.length}>
            <RefreshCw size={15} className={justBuilt ? 'animate-spin' : ''} />
            {groceryItems.length ? 'Rebuild' : 'Build list'}
          </button>
        </header>

        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
          {(['list', 'cupboard'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`capitalize ${tab === t ? 'tab-on' : 'tab-off'}`}>
              {t === 'list' ? 'To buy' : 'Cupboard'}
              {t === 'cupboard' && pantry.size > 0 && (
                <span className="ml-1.5 text-xs opacity-60 font-mono">{pantry.size}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'cupboard' && <Cupboard />}

        {tab === 'list' && (
          <>
        <DayPicker
          dates={offered}
          picked={picked}
          mealsByDate={mealsByDate}
          onToggle={(date) =>
            setDays((d) => (d.includes(date) ? d.filter((x) => x !== date) : [...d, date]))}
          onAll={() => setDays(offered.filter((d) => mealsByDate.get(d)))}
          onNone={() => setDays([])}
        />

        {groceryItems.length > 0 && (
          <div className="card p-4">
            <div className="h-2 rounded-full bg-border-100 overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${(checked / groceryItems.length) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                className="btn-ghost text-sm"
                disabled={!checked}
                onClick={() => drop(
                  groceryItems.filter((i) => i.checked),
                  `Cleared ${checked} picked up`,
                  clearCheckedItems)}
              >
                Clear picked up
              </button>
              <ShareList items={groceryItems} />
              {emptying ? (
                <>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => {
                      drop(
                        groceryItems,
                        `Emptied the list, ${groceryItems.length} ${groceryItems.length === 1 ? 'line' : 'lines'}`,
                        clearGroceryList)
                      setEmptying(false)
                    }}
                  >
                    <Trash2 size={14} /> Throw away {groceryItems.length}{' '}
                    {groceryItems.length === 1 ? 'line' : 'lines'}
                  </button>
                  <button className="btn-secondary text-sm" onClick={() => setEmptying(false)}>
                    Keep them
                  </button>
                  {/* The rest can be rebuilt from the plan in one tap. A line
                      somebody typed cannot: nothing in the app knows it was
                      ever there, so it is counted out separately rather than
                      folded into a total that reads as recoverable. */}
                  {typed.length > 0 && (
                    <p className="w-full text-xs text-coral-600">
                      {typed.length === 1
                        ? `1 of those is a line you typed (${typed[0].name}), and rebuilding will not bring it back.`
                        : `${typed.length} of those are lines you typed, and rebuilding will not bring them back.`}
                    </p>
                  )}
                </>
              ) : (
                <button className="btn-ghost text-sm text-coral-600" onClick={() => setEmptying(true)}>
                  <Trash2 size={14} /> Empty list
                </button>
              )}
            </div>
          </div>
        )}

        {/* Above the list, not below it. Under a categorised list of forty
            lines this was off the bottom of the screen, and a walkthrough
            reported the shopping list as unable to take a typed item at all.
            It could. Nobody could find it. */}
        <AddItem onAdd={(name, amount) => addGroceryItem({ name, amount })} />

        {groceryItems.length === 0 ? (
          <EmptyState title="Nothing on the list yet">
            {plannedMeals
              ? 'Pick the days you are shopping for, then build it.'
              : nothingToBuild === 'behind'
                ? 'The meals you have planned are on days that have already gone, and a shopping list is for days ahead. Plan something for this week, or type a line in above.'
                : 'Plan some meals first, then build the list from them, or type a line in above.'}
          </EmptyState>
        ) : (
          // Two columns from lg, laid out as masonry so a category with three
          // lines does not leave a hole beside one with twelve. A shop is read
          // top to bottom in one column on a phone and scanned as a whole on a
          // laptop, and the second is what a wide screen is for.
          <div className="lg:columns-2 lg:gap-5 space-y-5 lg:space-y-0">
          {grouped.map(([category, items]) => (
            <section key={category} className="lg:break-inside-avoid lg:mb-5">
              <SectionHeading>
                <span className="flex items-center gap-2 text-base">
                  {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category]}
                </span>
              </SectionHeading>
              <div className="card divide-y divide-border-100">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleGroceryItem(item.id)}
                    onSave={(updates) => updateGroceryItem(item.id, updates)}
                    onRemove={() => drop([item], `Removed ${item.name}`,
                      () => removeGroceryItem(item.id))}
                    onHaveIt={item.foodId ? () => {
                      // Into the cupboard rather than merely off the list, so
                      // the next list does not ask again. Removing it here would
                      // last until the next rebuild and no longer.
                      keep({ foodId: item.foodId })
                      removeGroceryItem(item.id)
                    } : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
          </div>
        )}

        {groceryItems.length > 0 && (
          <p className="flex items-start gap-2 text-xs text-ink-500">
            <ShoppingBasket size={14} className="shrink-0 mt-0.5" />
            Weights are raw, the way your plans are written: grains and meat before cooking.
          </p>
        )}
          </>
        )}
      </div>
    </div>
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

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            className="input pl-9"
            placeholder="Search your foods"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

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
  return (
    <div className="flex items-center gap-2 p-3">
      <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{name}</span>

      <input
        type="number"
        min={0}
        className="input w-24 px-2 text-sm"
        placeholder="enough"
        aria-label={`How much ${name}`}
        value={item.grams ?? ''}
        onChange={(e) => onAmount(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      <span className="text-xs text-ink-500 shrink-0 w-4">{item.grams ? 'g' : ''}</span>

      <button
        onClick={onStaple}
        aria-pressed={Boolean(item.staple)}
        aria-label={`Always have ${name}`}
        className={item.staple ? 'chip-on shrink-0' : 'chip-off shrink-0'}
      >
        Always
      </button>

      <button
        className="btn-ghost btn-icon text-ink-300 hover:text-coral-600 shrink-0"
        onClick={onDrop}
        aria-label={`Remove ${name} from the cupboard`}
      >
        <X size={15} />
      </button>
    </div>
  )
}

/**
 * Which days you are buying for.
 *
 * Days with nothing planned are shown but cannot be ticked: ticking one would
 * add nothing to the list, and hiding them entirely makes the fortnight look
 * shorter than it is.
 *
 * Days that have gone are a different case and are not passed in at all. An
 * empty Thursday might still get a meal; last Thursday will not, and offering
 * it only invites a shop for food that was eaten or never cooked.
 */
function DayPicker({
  dates, picked, mealsByDate, onToggle, onAll, onNone,
}: {
  dates: string[]
  picked: string[]
  mealsByDate: Map<string, number>
  onToggle: (date: string) => void
  onAll: () => void
  onNone: () => void
}) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-900">Shopping for</p>
        <div className="flex gap-1.5 shrink-0">
          <button className="btn-ghost text-xs" onClick={onAll}>All planned</button>
          <button className="btn-ghost text-xs" onClick={onNone}>None</button>
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
              disabled={!meals}
              onClick={() => onToggle(date)}
              aria-pressed={on}
              aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              className={`rounded-lg py-2 min-h-14 text-center border transition-colors ${
                on ? 'bg-bite-500 text-white border-bite-500'
                  : meals ? 'bg-paper border-border-200 text-ink-900 hover:border-bite-300'
                    : 'bg-cream-50 border-transparent text-ink-500'
              }`}
            >
              <span className={`block text-[11px] font-semibold uppercase ${on ? 'text-bite-100' : 'text-ink-500'}`}>
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span className="block text-sm font-bold leading-tight">{d.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** One line, which can be ticked off, corrected or thrown away. */
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
  // underneath, because they are what the plan actually asked for and the
  // count is a rounding of them.
  const household = item.amount
    ? undefined
    : householdAmount(item.grams, ctx.foods.get(item.foodId)?.units)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(shown)

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          className="input flex-1 min-w-0" value={name} aria-label="Item"
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-24 shrink-0" value={amount} aria-label="Amount"
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          className="btn-secondary btn-icon shrink-0"
          aria-label="Save item"
          onClick={() => { onSave({ name, amount }); setEditing(false) }}
        >
          <Check size={15} />
        </button>
        {onHaveIt && (
          <button
            className="btn-ghost shrink-0 text-xs"
            aria-label={`We already have ${item.name}`}
            onClick={onHaveIt}
          >
            Have it
          </button>
        )}
        <button
          className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={onToggle}
        aria-label={item.name}
        className="w-4 h-4 accent-bite-500 shrink-0"
      />
      <button
        className={`flex-1 min-w-0 text-left text-sm ${item.checked ? 'line-through text-ink-500' : 'text-ink-900'}`}
        onClick={() => { setName(item.name); setAmount(shown); setEditing(true) }}
      >
        {item.name}
      </button>
      <button
        className={`text-sm font-mono shrink-0 ${item.checked ? 'text-ink-500' : 'text-ink-700'}`}
        aria-label={`Edit ${item.name}`}
        onClick={() => { setName(item.name); setAmount(shown); setEditing(true) }}
      >
        {household ? (
          <>
            {household}
            <span className="ml-1.5 text-xs text-ink-500">{shown}</span>
          </>
        ) : shown}
      </button>
    </div>
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
    <div className="card p-3 flex items-center gap-2">
      <input
        className="input flex-1 min-w-0"
        placeholder="Add something else"
        aria-label="Add an item"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      <input
        className="input w-24 shrink-0"
        placeholder="2 packs"
        aria-label="How much"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      <button className="btn-primary btn-icon shrink-0" aria-label="Add to list" onClick={submit} disabled={!name.trim()}>
        <Plus size={16} />
      </button>
    </div>
  )
}

/**
 * Handing the list to somebody who is not in the app.
 *
 * The only way anything left here was a backup file, which is not a thing you
 * send to a person standing in a different shop. Share where the browser has
 * it, which on a phone is the sheet everybody already knows; the clipboard
 * everywhere else, which is every desktop.
 *
 * Only what is left to buy goes: a list of things already in the trolley is
 * not a shopping list.
 */
function ShareList({ items }: { items: GroceryItem[] }) {
  const ctx = useNutritionContext()
  const [said, setSaid] = useState<string | null>(null)

  const text = () => listAsText(items, CATEGORY_LABELS, (item) => item.amount
    ?? householdAmount(item.grams, ctx.foods.get(item.foodId)?.units)
    ?? (item.grams ? formatGrams(item.grams) : ''))

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
    <button className="btn-ghost text-sm" onClick={share}>
      <Share2 size={14} /> {said ?? 'Share'}
    </button>
  )
}
