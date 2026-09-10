import { EmptyState } from 'bite-buddy'

/** A search that found nothing. The default mood, and the one seen most. */
export function SearchFoundNothing() {
  return (
    <div style={{ width: 460 }}>
      <EmptyState title="No foods matching that">
        Try another spelling, or add it yourself below.
      </EmptyState>
    </div>
  )
}

/**
 * Empty with something to do about it.
 *
 * The children take a button as happily as a sentence, which is what keeps the
 * shelf from being a dead end.
 */
export function NothingOfYourOwnYet() {
  return (
    <div style={{ width: 460 }}>
      <EmptyState title="Nothing of your own yet" mood="thinking">
        <p>Every recipe here can be edited. Change one and your version lands on this shelf, with the original safe underneath.</p>
        <button className="btn-primary mt-4">Write one</button>
      </EmptyState>
    </div>
  )
}

/** The apologetic mood, for the case where the app is the one that failed. */
export function ImportDidNotLand() {
  return (
    <div style={{ width: 460 }}>
      <EmptyState title="That week did not import" mood="oops">
        The file opened but nothing in it looked like a plan. Check it is the
        dietician's own document, then try again.
      </EmptyState>
    </div>
  )
}

/** Cooking screen, nothing batched yet. */
export function NoCookSessions() {
  return (
    <div style={{ width: 460 }}>
      <EmptyState title="No cook sessions planned" mood="chef">
        Add one and pick the dishes you'll batch together.
      </EmptyState>
    </div>
  )
}

/**
 * Empty because the work is done, not because nothing has started.
 *
 * The gap filler lands here when every slot on the days ahead already has
 * something in it, so the mascot celebrates rather than shrugs.
 */
export function NothingLeftToFill() {
  return (
    <div style={{ width: 460 }}>
      <EmptyState title="Nothing to fill" mood="celebrate">
        Every meal on the days still ahead already has something in it.
      </EmptyState>
    </div>
  )
}

/** The cheerful mood, for a list that is empty because the cupboard covers it. */
export function TheListIsClear() {
  return (
    <div style={{ width: 460 }}>
      <EmptyState title="Nothing to buy this week" mood="happy">
        Everything the plan asks for is already in the cupboard. Add a line above
        if you want something anyway.
      </EmptyState>
    </div>
  )
}
