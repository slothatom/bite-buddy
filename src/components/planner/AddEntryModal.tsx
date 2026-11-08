import { useMemo, useState } from 'react'
import { useDialog } from '../../lib/useDialog'
import { X, CalendarDays, Plus, Globe } from 'lucide-react'
import { slotNow } from '../../lib/whenDates'
import type { Component, MealSlot, Recipe } from '../../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../../types'
import { useRecipes } from '../../store/useRecipeStore'
import { useFoods } from '../../store/useFoodStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, componentsNutrients } from '../../lib/nutrition'
import { normaliseTerm } from '../../lib/units'
import { mealTimesOf } from '../../lib/dishCategories'
import { searchFoods } from '../../lib/foodSearch'
import { buildFoodIndex } from '../../lib/foodSearch'
import { useAvailablePortions } from '../../store/usePortionStore'
import { today } from '../../store/useMealPlanStore'
import { readAmount, MOST } from '../../lib/amounts'
import WhenPicker from './WhenPicker'
import { offerOrder, madeWhen, portionLabel } from '../../lib/portionsUse'
import { usePantry } from '../../store/usePantryStore'
import { availability, availabilityLabel } from '../../lib/pantry'
import { usePortionStore } from '../../store/usePortionStore'
import { surplusLine, surplusOf } from '../../lib/cookExtra'
import AddFoodModal from '../foods/AddFoodModal'
import { ChipCheck, SearchField } from '../ui'

/**
 * Adds a recipe, a weighed food, or something already cooked, to a meal slot.
 *
 * All three live in one picker because the plans mix them freely: lunch is
 * usually a recipe, a snack is two food lines and forcing it through a recipe
 * would mean inventing one, and often the honest answer is that Sunday's stew
 * is still in the fridge.
 *
 * The fridge tab comes first when there is anything in it. That is the whole
 * argument for cooking in advance: the next meal is already decided, and the
 * app should say so before offering you 228 things to choose between.
 */
export default function AddEntryModal({
  date, slot, onClose, onAdd, mode = 'plan', onSlotChange, onDateChange,
}: {
  date: string
  slot: MealSlot
  onClose: () => void
  onAdd: (entry: Component) => void
  /**
   * Whether this is a plan or a record.
   *
   * The picker is identical either way, so it is one component. What changes is
   * the tense: "Add to lunch" is about a lunch that has not happened, and the
   * commonest thing a person wants to write down is one that already has. The
   * caller decides where it lands; this only has to stop saying the wrong
   * thing about it.
   */
  mode?: 'plan' | 'ate'
  /**
   * Lets the day and the meal be corrected here.
   *
   * The centre button used to mean today and Breakfast, always, at any hour
   * and from any screen, with nothing on the sheet saying so and no way to
   * change it. The most-tapped control in the app was the one most likely to
   * file food in the wrong place.
   *
   * Now the sheet states where this is going before you have chosen what, in
   * words rather than in a heading nobody reads, and one tap opens the picker.
   */
  onSlotChange?: (slot: MealSlot) => void
  onDateChange?: (date: string) => void
}) {
  const ate = mode === 'ate'
  /*
   * Whether this is going down as a plan or as a record.
   *
   * The caller sets the starting point and this is where it can be changed,
   * because the answer belongs to the moment rather than to the screen you
   * came from. The phone's "+ Meal" plans, which is right when you open it on
   * Sunday to write the week and wrong every other time you press it: at four
   * on a Tuesday you have already had the thing you are typing in, and the
   * app made you add it to the plan and then go and tick it, which is two
   * actions and, in between them, a day claiming you are about to eat
   * something you have eaten.
   *
   * Offered for today and for days gone, not for days ahead. "I already ate
   * Friday's dinner" is not a thing.
   */
  const [recording, setRecording] = useState(ate)
  const past = date <= today()
  const isRecord = recording && past
  const [when, setWhen] = useState(false)
  /*
   * Writing down a food the app has never met, without leaving the day.
   *
   * The foods tab searched a library and, on a miss, offered to search the
   * other library. Neither holds a yoghurt nobody has typed in yet, so the
   * real answer was: go to Foods, add it, come back, find the day again, find
   * the slot again. Four screens to record one yoghurt, which is the number at
   * which people stop recording yoghurts. It opens the same sheet the Foods
   * screen opens, and puts what you wrote straight into the meal.
   */
  /** Which way in to the new-food sheet, or null while it is closed. */
  const [writing, setWriting] = useState<'manual' | 'lookup' | null>(null)
  const panel = useDialog<HTMLDivElement>(onClose, !writing)
  const [query, setQuery] = useState('')
  // Snacks open on foods. The plans write them as lines rather than dishes
  // ("200 g pere, 15 g migdale"), so the recipe tab for a snack slot was reliably
  // empty, an empty list is a worse answer than the right list.
  const isSnack = slot === 'snack'
  const available = useAvailablePortions()
  const pantry = usePantry()
  const [tab, setTab] = useState<'fridge' | 'recipes' | 'foods'>(
    available.length ? 'fridge' : isSnack ? 'foods' : 'recipes')
  const [grams, setGrams] = useState<Record<string, number>>({})
  /*
   * How many portions the pot makes.
   *
   * The planner never asked. A recipe went into a day at one serving and the
   * fact that you had made three of them existed only in your fridge, which
   * meant the one thing this kitchen does most often was the one thing the
   * app could not record. Recording a meal you have already eaten is not the
   * moment to ask, so it is offered when planning only.
   */
  const [cooking, setCooking] = useState(1)
  const { addPortion } = usePortionStore()

  /**
   * An entry, already ticked when this is a record.
   *
   * Recording used to need its own path through the store, so that ticking a
   * planned meal could not claim the rest of it had been eaten too. An item
   * carries its own answer now, so a record is simply an item that arrives
   * with one, and it can sit in the same meal as the food you are still
   * planning to have.
   */
  const stamped = (entry: Component): Component => (
    isRecord ? { ...entry, outcome: 'eaten', outcomeAt: new Date().toISOString() } : entry)

  const recipes = useRecipes()
  const foods = useFoods()
  const ctx = useNutritionContext()
  const foodIndex = useMemo(() => buildFoodIndex(foods), [foods])

  const matchedRecipes = useMemo(() => {
    const n = normaliseTerm(query)
    // mealTimesOf rather than the recipe's own tags: the batch-cooked dishes
    // were never a meal in a plan and carry no meal time, so without the
    // category's fallback the lentil stew could never be picked for a lunch.
    const slotMatch = (r: Recipe) =>
      mealTimesOf(r).includes(isSnack ? 'snack' : slot)

    const pool = recipes.filter((r) => {
      if (!n) return slotMatch(r)
      const haystack = normaliseTerm(
        [r.name.en, r.name.ro, r.name.hu, r.sourceLine].filter(Boolean).join(' '))
      return haystack.includes(n)
    })

    return pool.slice(0, 60)
  }, [recipes, query, slot, isSnack])

  const matchedFoods = useMemo(() => searchFoods(query, foodIndex, 40), [query, foodIndex])

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/45 p-0 sm:p-4"
        onClick={onClose}>
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-sheet-h"
          className="bg-paper w-full sm:max-w-2xl rounded-t-card sm:rounded-card h-[calc(100dvh-3.5rem)] sm:h-auto sm:max-h-[88vh]
                     flex flex-col shadow-e3"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div aria-hidden="true" className="sm:hidden w-10 h-1 rounded-full bg-ink-300 mx-auto mt-2 mb-1 shrink-0" />
          <header className="flex items-center gap-2 px-4 sm:px-5 pt-1 sm:pt-4">
            <div className="flex-1 min-w-0">
              <h2 id="add-sheet-h" className="text-xl leading-[26px] font-extrabold text-ink-900">
                {isRecord ? `Had this for ${SLOT_LABELS[slot].toLowerCase()}` : `Add to ${SLOT_LABELS[slot].toLowerCase()}`}
              </h2>
              <p className="text-xs leading-4 text-ink-700">
                <span>{new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                {/* Why this meal, when it was the clock that chose it. */}
                {onSlotChange && date === today() && slot === slotNow() && (
                  <span>
                    {` · it's ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, so ${SLOT_LABELS[slot].toLowerCase()} is picked`}
                  </span>
                )}
              </p>
            </div>
            <button className="btn-ghost btn-icon rounded-[14px] shrink-0" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </header>

          <div className="px-4 sm:px-5 pt-3 space-y-2.5">
            {/* Which meal, always in view: the clock's guess is a guess, and
                it should take one tap to correct, not a menu. */}
            {onSlotChange && (
              <div className="grid grid-cols-4 gap-1 p-1 bg-border-100 rounded-lg" role="group" aria-label="Which meal">
                {MEAL_SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={slot === s}
                    onClick={() => onSlotChange(s)}
                    className={`min-h-10 rounded-md text-[13px] ${slot === s
                      ? 'bg-paper text-ink-900 font-extrabold shadow-e1'
                      : 'text-ink-700 font-bold hover:text-ink-900'}`}
                  >
                    {SLOT_LABELS[s]}
                  </button>
                ))}
              </div>
            )}

            {onDateChange && (
              <div className="card-soft px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <CalendarDays size={15} aria-hidden="true" className="shrink-0 text-ink-700" />
                  <p className="flex-1 min-w-0 text-sm text-ink-900">
                    {!onSlotChange && <><span className="font-semibold">{SLOT_LABELS[slot]}</span>{', '}</>}
                    {date === today()
                      ? 'today'
                      : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost text-xs shrink-0 min-h-11 px-3"
                    aria-expanded={when}
                    onClick={() => setWhen((v) => !v)}
                  >
                    {when ? 'Done' : 'Change day'}
                  </button>
                </div>
                {when && (
                  <div className="pb-2">
                    <WhenPicker date={date} onDate={(d) => onDateChange(d)} />
                  </div>
                )}
              </div>
            )}

            <SearchField
              autoFocus
              placeholder={isRecord ? 'What did you have?' : 'What are we having?'}
              value={query}
              onChange={setQuery}
            />

            <div className="flex flex-wrap gap-2">
              {([...(available.length ? ['fridge' as const] : []), 'recipes' as const, 'foods' as const]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`capitalize min-h-9 px-3.5 rounded-full border text-[13px] inline-flex items-center ${tab === t
                    ? 'border-bite-700 bg-bite-100 text-bite-700 font-extrabold'
                    : 'border-border-200 bg-paper text-ink-900 font-bold hover:border-bite-300'}`}
                >
                  {t}
                  {t === 'fridge' && (
                    <span className="ml-1.5 text-xs font-mono">{available.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 space-y-2">
            {tab === 'fridge' && offerOrder(available).map((p) => {
              const n = componentsNutrients([{ kind: 'portion', portionId: p.id, servings: 1 }], ctx)
              return (
                <button
                  key={p.id}
                  onClick={() => { onAdd(stamped({ kind: 'portion', portionId: p.id, servings: 1 })); onClose() }}
                  className="w-full min-h-14 flex items-center gap-3 px-3 py-2 rounded-lg border border-border-200 bg-paper hover:border-bite-300 hover:bg-bite-50 text-left transition-colors"
                >
                  <span className="text-xl">{p.storage === 'freezer' ? '🧊' : '🥡'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] leading-5 font-bold text-ink-900 truncate">
                      {portionLabel(p, ctx.recipes)}
                    </span>
                    <span className="block text-xs leading-4 text-ink-700 truncate">
                      {p.servings === 1 ? '1 portion left' : `${p.servings} portions left`} · {madeWhen(p)}
                    </span>
                  </span>
                  {n.calories > 0 && (
                    <span className="text-sm font-extrabold text-ink-900 tabular-nums shrink-0">
                      {Math.round(n.calories)} kcal
                    </span>
                  )}
                </button>
              )
            })}

            {/* How big the pot is. Only when planning: "I already ate this" is
                not a moment to be asked how much you cooked. */}
            {tab === 'recipes' && !isRecord && (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="text-xs font-bold text-ink-500">Cooking</span>
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCooking(n)}
                    aria-pressed={cooking === n}
                    aria-label={n === 1 ? 'Cooking one serving' : `Cooking ${n} servings`}
                    className={cooking === n ? 'chip-on' : 'chip-off'}
                  >
                    <ChipCheck on={cooking === n} />
                    {n}
                  </button>
                ))}
                <span className="basis-full text-xs text-ink-500">
                  {surplusLine(cooking, 1)
                    ? `One serving goes in the day, ${surplusLine(cooking, 1)}.`
                    : 'One serving, eaten on the day.'}
                </span>
              </div>
            )}

            {tab === 'recipes' && matchedRecipes.map((r) => {
              const n = recipePerServing(r, ctx)
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    onAdd(stamped({ kind: 'recipe', recipeId: r.id, servings: 1 }))
                    /*
                     * The rest of the pot, straight into the fridge.
                     *
                     * Written here rather than handed to `onAdd`, because it is
                     * a fact about the cooking rather than about the day: the
                     * day gets one serving whatever size the pot was, and every
                     * caller of this picker would otherwise have to learn about
                     * portions to pass it on.
                     */
                    const spare = surplusOf({
                      recipeId: r.id, cooking, eating: 1, madeOn: date,
                      id: `cook-${Date.now().toString(36)}`,
                    })
                    if (spare) addPortion(spare)
                    onClose()
                  }}
                  className="w-full min-h-14 flex items-center gap-3 px-3 py-2 rounded-lg border border-border-200 bg-paper hover:border-bite-300 hover:bg-bite-50 text-left transition-colors"
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] leading-5 font-bold text-ink-900 truncate">{r.name.en}</span>
                    {/* What you have matters more at this moment than what the
                        dietician wrote, so it takes the line when there is
                        anything in the cupboard to say. */}
                    {pantry.size > 0 ? (
                      <span className="block text-xs leading-4 text-ink-700 truncate">
                        {availabilityLabel(availability(r, ctx, pantry)) || r.sourceLine}
                      </span>
                    ) : r.sourceLine ? (
                      <span className="block text-xs leading-4 text-ink-700 truncate">{r.sourceLine}</span>
                    ) : null}
                  </span>
                  <span className="text-sm font-extrabold text-ink-900 tabular-nums shrink-0">{Math.round(n.calories)} kcal</span>
                </button>
              )
            })}

            {tab === 'recipes' && !matchedRecipes.length && (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-ink-500">No recipes match “{query}”.</p>
                {/* The two libraries do not search each other, and used not to
                    say so: a miss on one tab gave no hint that the other might
                    have it. */}
                <button className="btn-secondary" onClick={() => setTab('foods')}>
                  Look in foods instead
                </button>
              </div>
            )}

            {/*
              Above the list, not below it.

              Both ways out of a library that does not have it used to sit
              under the results, and with nothing typed the results are forty
              foods, so "search the databases" was a scroll past forty things
              you did not want. The databases are the whole reason the Foods
              tab can answer a yoghurt it has never heard of, and they were the
              hardest thing on the screen to reach.
            */}
            {tab === 'foods' && (
              <div className="flex gap-2 pb-1">
                <button
                  className="btn flex-1 min-w-0 justify-center min-h-12 rounded-lg border border-dashed border-ink-300 text-bite-700 text-sm"
                  onClick={() => setWriting('manual')}
                >
                  <Plus size={15} />
                  <span className="truncate">{query.trim() ? `Add “${query.trim()}”` : 'Write one down'}</span>
                </button>
                <button
                  className="btn-secondary text-sm flex-1 min-w-0 justify-center"
                  onClick={() => setWriting('lookup')}
                >
                  <Globe size={15} />
                  <span className="truncate">Search the databases</span>
                </button>
              </div>
            )}

            {tab === 'foods' && matchedFoods.map((f) => {
              const g = grams[f.id] ?? f.units[0]?.grams ?? 100
              const n = componentsNutrients([{ kind: 'food', foodId: f.id, grams: g }], ctx)
              return (
                // Name on its own row, then controls beneath: on a phone the
                // one-line version squeezed the food name down to a few characters.
                <div key={f.id} className="p-3 rounded-lg border border-border-200 bg-paper">
                  <div className="min-w-0 mb-2">
                    <p className="text-sm font-semibold text-ink-900 truncate">{f.names.en}</p>
                    {/* Marked as what it is. The document is English and these
                        two words are not, so a screen reader that is not told
                        will pronounce "paine integrala" as English. */}
                    {f.names.ro || f.names.hu ? (
                      <p className="text-xs text-ink-500 truncate">
                        {f.names.ro && <span lang="ro">{f.names.ro}</span>}
                        {f.names.ro && f.names.hu ? ' · ' : ''}
                        {f.names.hu && <span lang="hu">{f.names.hu}</span>}
                      </p>
                    ) : null}
                  </div>
                  {/* The amounts this food actually comes in.
                      A mug, a glass, a slice. Typing 240 into a grams box is
                      the step between "I had a coffee" and a recorded coffee,
                      and it is the step at which people give up: it asks you
                      to know a number about a mug. The box stays for
                      everything else, and for when the answer is half a
                      glass. */}
                  {f.units.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {f.units.map((u) => (
                        <button
                          key={u.label}
                          type="button"
                          onClick={() => setGrams((s) => ({ ...s, [f.id]: u.grams }))}
                          aria-pressed={g === u.grams}
                          aria-label={`One ${u.label} of ${f.names.en}`}
                          className={g === u.grams ? 'chip-on' : 'chip-off'}
                        >
                          <ChipCheck on={g === u.grams} />
                          1 {u.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MOST.grams}
                        value={g}
                        onChange={(e) => setGrams((s) => ({
                          ...s, [f.id]: readAmount(e.target.value, { max: MOST.grams }),
                        }))}
                        className="input w-24 pr-7 text-right"
                        aria-label={`Grams of ${f.names.en}`}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500 pointer-events-none">g</span>
                    </div>
                    <span className="flex-1 text-xs text-ink-500 font-mono">{Math.round(n.calories)} kcal</span>
                    <button
                      className="btn-primary shrink-0"
                      onClick={() => { onAdd(stamped({ kind: 'food', foodId: f.id, grams: g })); onClose() }}
                    >
                      {isRecord ? 'Had it' : 'Add'}
                    </button>
                  </div>
                </div>
              )
            })}

            {tab === 'foods' && !matchedFoods.length && (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-ink-500">
                  {query
                    ? `None of your foods match “${query}”. The two buttons above will look it up or write it down.`
                    : 'Search above, or write one down.'}
                </p>
                {/* A miss on one tab used to give no hint that the other might
                    have it. */}
                <button className="btn-secondary" onClick={() => setTab('recipes')}>
                  Look in recipes instead
                </button>
              </div>
            )}
          </div>

          {/* Plan or record, said at the foot where the choice lands, rather
              than decided by whichever button you pressed to get here. Not
              offered for a day ahead: "I already ate Friday's dinner" is not
              a thing. */}
          {past && (onSlotChange || onDateChange) && (
            <div className="shrink-0 px-4 sm:px-5 pt-3 pb-4 border-t border-border-100">
              <div className="grid grid-cols-2 gap-1 p-1 bg-border-100 rounded-lg" role="group" aria-label="Eaten yet">
                {([false, true] as const).map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    onClick={() => setRecording(r)}
                    aria-pressed={recording === r}
                    className={`min-h-11 sm:min-h-9 rounded-md text-[13px] ${recording === r
                      ? 'bg-paper text-ink-900 font-extrabold shadow-e1'
                      : 'text-ink-700 font-bold hover:text-ink-900'}`}
                  >
                    {r ? 'Already had it' : 'Planning it'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/*
        A sibling of the picker rather than a child of it. The picker's backdrop
        closes the picker on any click that reaches it, and a click inside a
        sheet nested within it would.

        What you write goes straight into the meal at 100 g, which is the
        figure everything in this app is stated per, and is one number to
        correct rather than a second sheet to answer before the food is
        recorded at all.
      */}
      {writing && (
        <AddFoodModal
          initialName={query.trim()}
          initialTab={writing}
          onClose={() => setWriting(null)}
          onSaved={(food) => {
            onAdd(stamped({ kind: 'food', foodId: food.id, grams: food.units[0]?.grams ?? 100 }))
            onClose()
          }}
        />
      )}
    </>
  )
}
