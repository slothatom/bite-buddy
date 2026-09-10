import { useEffect, useRef, type ReactNode } from 'react'
import { ErrorBoundary } from 'bite-buddy'

/** A screen that renders. The boundary is invisible when nothing goes wrong. */
function ADay() {
  return (
    <div className="card p-5" style={{ width: 420 }}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1.5">
        Wednesday 15 May
      </p>
      <h2 className="display text-lg text-ink-900">Ciorba de legume, telemea, paine integrala</h2>
      <p className="text-sm text-ink-700 mt-1">Lunch, 640 kcal of a 1800 kcal day.</p>
    </div>
  )
}

/** Throws on render, which is the only way into the state below. */
function Breaks({ message }: { message: string }): never {
  throw new Error(message)
}

/**
 * Presses a button in the caught screen once it is up.
 *
 * The disclosure is the half of this component worth looking at and it is
 * shut by default, so a still picture of it needs a hand.
 */
function Press({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = setTimeout(() => {
      const buttons = [...(ref.current?.querySelectorAll('button') ?? [])]
      buttons.find((b) => b.textContent?.trim() === label)?.click()
    }, 0)
    return () => clearTimeout(id)
  }, [label])
  return <div ref={ref}>{children}</div>
}

const frame = { height: 560, overflow: 'hidden' as const }

/** Nothing thrown: the children are handed through untouched. */
export function Holding() {
  return (
    <div style={{ width: 460 }}>
      <ErrorBoundary>
        <ADay />
      </ErrorBoundary>
    </div>
  )
}

/**
 * A screen that tripped over itself.
 *
 * Reload first, back to the planner second, and nothing about deleting
 * anything until it is asked for.
 */
export function Caught() {
  return (
    <div style={frame}>
      <ErrorBoundary>
        <Breaks message="Cannot read properties of undefined (reading 'meals')" />
      </ErrorBoundary>
    </div>
  )
}

/**
 * The commonest crash, which is not a bug: a deploy landed under an open page
 * and the chunk it wanted is gone. Different words, because "something
 * spilled" reads as data loss and nothing has been lost.
 */
export function AfterADeploy() {
  return (
    <div style={frame}>
      <ErrorBoundary>
        <Breaks message="Failed to fetch dynamically imported module: /assets/Planner-9f2c1a.js" />
      </ErrorBoundary>
    </div>
  )
}

/**
 * Behind "Still broken?": the exception text, a backup, and only then the red
 * one. The order is the point, so this is the cell to read.
 */
export function TheLastResort() {
  return (
    <div style={{ height: 640, overflow: 'hidden' }}>
      <Press label="Still broken?">
        <ErrorBoundary>
          <Breaks message="Cannot read properties of undefined (reading 'meals')" />
        </ErrorBoundary>
      </Press>
    </div>
  )
}
