import { Heart } from 'lucide-react'
import Photo from './Photo'
import { primaryGroupOf, type RecipeGroup, type RecipeVariants } from '../../lib/recipeGroups'
import { CATEGORY_LABELS } from '../../lib/dishCategories'
import { timeIsEstimated } from '../../lib/cookingTimes'

/** A tint per meal, so the list can be scanned by colour as well as by name. */
const TINT: Record<RecipeGroup, string> = {
  breakfast: 'bg-mustard-100',
  lunch: 'bg-leaf-100',
  dinner: 'bg-bite-100',
  snack: 'bg-coral-100',
  dish: 'bg-border-100',
}

/**
 * One dish in the library's list: what it is, what it asks of you, and what a
 * serving comes to. The whole row opens it.
 */
export function RecipeRow({
  card, mine, favourite, kcals, current, onOpen,
}: {
  card: RecipeVariants
  mine: boolean
  favourite: boolean
  kcals: number[]
  /** Open in the pane beside the list. */
  current: boolean
  onOpen: () => void
}) {
  const lead = card.variants[0]
  const minutes = lead.prepMinutes + lead.cookMinutes
  const low = Math.min(...kcals)
  const high = Math.max(...kcals)

  const meta = [
    lead.category ? CATEGORY_LABELS[lead.category] : null,
    minutes > 0 ? `${timeIsEstimated(lead) ? 'about ' : ''}${minutes} min` : null,
    lead.servings > 1 ? `makes ${lead.servings}` : null,
    card.variants.length > 1 ? `${card.variants.length} versions` : null,
    mine ? 'yours' : null,
  ].filter(Boolean).join(' · ')

  return (
    <li className="border-t border-border-100 first:border-t-0">
      <button
        onClick={onOpen}
        data-recipe-card
        aria-current={current || undefined}
        className={`w-full min-w-0 flex items-center gap-3 pl-3 pr-3.5 py-3 lg:py-2.5 min-h-11 text-left border-l-3
                    transition-colors ${current ? 'bg-bite-50 border-bite-700' : 'border-transparent hover:bg-cream-50'}`}
      >
        {/* The photograph where there is one, the emoji where there is not. */}
        {lead.photo ? (
          <Photo path={lead.photo} alt={card.name} className="w-11 h-11 lg:w-10 lg:h-10 rounded-[14px] shrink-0" />
        ) : (
          <span className={`w-11 h-11 lg:w-10 lg:h-10 rounded-[14px] shrink-0 grid place-items-center text-2xl leading-none ${TINT[primaryGroupOf(lead)]}`}>
            {lead.emoji}
          </span>
        )}
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[15px] lg:text-sm leading-5 font-bold text-ink-900 lg:truncate">
            {card.name}
          </span>
          {meta && <span className="text-xs leading-4 text-ink-700">{meta}</span>}
        </span>
        <span className="text-sm font-extrabold text-ink-900 tabular-nums shrink-0 flex items-center gap-1.5">
          {favourite && (
            <Heart size={14} aria-label="Favourite" role="img" className="fill-coral-700 text-coral-700" />
          )}
          {low === high ? low : `${low}–${high}`}
        </span>
      </button>
    </li>
  )
}
