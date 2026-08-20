import { useMemo, useState } from 'react'
import { RefreshCw, Trash2, ShoppingBasket, Plus, X, Check } from 'lucide-react'
import type { GroceryItem, MedCategory } from '../types'
import { useMealPlanStore, getRangeDates } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { EmptyState, SectionHeading } from '../components/ui'
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '../lib/categories'
import { formatGrams } from '../lib/grocery'

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
    plan, weekDates,
  } = useMealPlanStore()
  const { profile } = useUserStore()
  const ctx = useNutritionContext()
  const [justBuilt, setJustBuilt] = useState(false)

  /** A fortnight of choices: this week and the next, which is as far as a shop reaches. */
  const offered = useMemo(
    () => getRangeDates(weekDates[0], 'fortnight', profile.weekStartsOn),
    [weekDates, profile.weekStartsOn],
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
  const plannedMeals = days.reduce((n, d) => n + (mealsByDate.get(d) ?? 0), 0)

  function build() {
    generateGroceryList(ctx, { dates: days })
    setJustBuilt(true)
    setTimeout(() => setJustBuilt(false), 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display text-xl sm:text-2xl text-ink-900">Shopping list</h1>
            <p className="text-sm text-ink-700">
              {groceryItems.length
                ? `${checked} of ${groceryItems.length} picked up`
                : `Ready to build from ${plannedMeals} ${plannedMeals === 1 ? 'meal' : 'meals'}.`}
            </p>
          </div>
          <button className="btn-primary shrink-0" onClick={build} disabled={!days.length}>
            <RefreshCw size={15} className={justBuilt ? 'animate-spin' : ''} />
            {groceryItems.length ? 'Rebuild' : 'Build list'}
          </button>
        </header>

        <DayPicker
          dates={offered}
          picked={days}
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
              <button className="btn-ghost text-sm" onClick={clearCheckedItems} disabled={!checked}>
                Clear picked up
              </button>
              <button className="btn-ghost text-sm text-coral-600" onClick={clearGroceryList}>
                <Trash2 size={14} /> Empty list
              </button>
            </div>
          </div>
        )}

        {groceryItems.length === 0 ? (
          <EmptyState title="Nothing on the list yet">
            {plannedMeals
              ? 'Pick the days you are shopping for, then build it.'
              : 'Plan some meals first, then build the list from them. You can also add lines by hand below.'}
          </EmptyState>
        ) : (
          grouped.map(([category, items]) => (
            <section key={category}>
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
                    onRemove={() => removeGroceryItem(item.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <AddItem onAdd={(name, amount) => addGroceryItem({ name, amount })} />

        {groceryItems.length > 0 && (
          <p className="flex items-start gap-2 text-xs text-ink-500">
            <ShoppingBasket size={14} className="shrink-0 mt-0.5" />
            Weights are raw, the way your plans are written: grains and meat before cooking.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Which days you are buying for.
 *
 * Days with nothing planned are shown but cannot be ticked: ticking one would
 * add nothing to the list, and hiding them entirely makes the fortnight look
 * shorter than it is.
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
                    : 'bg-cream-50 border-transparent text-ink-300'
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
  item, onToggle, onSave, onRemove,
}: {
  item: GroceryItem
  onToggle: () => void
  onSave: (updates: { name?: string; amount?: string }) => void
  onRemove: () => void
}) {
  const shown = item.amount ?? (item.grams ? formatGrams(item.grams) : '')
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
        className={`flex-1 min-w-0 text-left text-sm ${item.checked ? 'line-through text-ink-300' : 'text-ink-900'}`}
        onClick={() => { setName(item.name); setAmount(shown); setEditing(true) }}
      >
        {item.name}
      </button>
      <button
        className={`text-sm font-mono shrink-0 ${item.checked ? 'text-ink-300' : 'text-ink-700'}`}
        aria-label={`Edit ${item.name}`}
        onClick={() => { setName(item.name); setAmount(shown); setEditing(true) }}
      >
        {shown}
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
