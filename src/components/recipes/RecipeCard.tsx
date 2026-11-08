import { Star, Clock, Layers } from 'lucide-react'
import { SourceLine } from '../ui'
import Photo from './Photo'
import type { RecipeVariants } from '../../lib/recipeGroups'
import { timeIsEstimated } from '../../lib/cookingTimes'

export function RecipeCard({
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
          {/* The photograph where there is one, the emoji where there is not.
              Both, side by side, would be two pictures of the same dish
              competing for the same corner. */}
          {lead.photo ? (
            <Photo
              path={lead.photo}
              alt={card.name}
              className="w-12 h-12 rounded-xl shrink-0"
            />
          ) : (
            <span className="text-2xl leading-none shrink-0">{lead.emoji}</span>
          )}
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
