import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { EmptyState } from '../ui'
import { GROUP_LABELS } from '../../lib/recipeGroups'
import type { RecipeTab as Tab } from '../../lib/recipes/shelf'

/** What an empty shelf should say depends on why it is empty. */
export function EmptyShelf({
  tab, filtered, query, onNew, onClear,
}: {
  tab: Tab
  filtered: boolean
  /** What was typed, so the empty state can name it and offer to write it. */
  query: string
  onNew: () => void
  onClear: () => void
}) {
  if (filtered) {
    // Three dimensions can combine into a corner with nothing in it and no
    // shelf to move to, every tab reading zero. Telling you to try another
    // shelf would be useless advice, so there is a way straight out.
    //
    // And when it was a search that found nothing, "No recipes match zzqq" was
    // the whole answer: no way to write the thing you were looking for, and no
    // hint that Foods is a separate library that might have it. Two screens
    // that do not search each other and do not say so.
    return (
      <EmptyState title="Nothing matching that just yet">
        <p>{query.trim() ? `Nothing here matches “${query.trim()}”.` : 'That combination has nothing in it.'}</p>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <button className="btn-primary" onClick={onClear}>Clear the filters</button>
          {query.trim() && (
            <>
              <button className="btn-secondary" onClick={onNew}>
                <Plus size={16} /> Write it
              </button>
              <Link to="/foods" className="btn-secondary">Look in Foods</Link>
            </>
          )}
        </div>
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
