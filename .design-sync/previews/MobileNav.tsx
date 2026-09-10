import { useEffect, useRef, type ReactNode } from 'react'
import { MobileNav } from 'bite-buddy'

/**
 * What is under the bar, so the sticky header has something to sit on and the
 * drawer has something to cover.
 */
function Screen() {
  return (
    <div className="px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1.5">
        Wednesday 15 May
      </p>
      <div className="card p-4">
        <p className="text-sm text-ink-900">Breakfast</p>
        <p className="text-xs text-ink-500 mt-0.5">Paine integrala, telemea, rosii. 410 kcal</p>
      </div>
      <div className="card p-4 mt-3">
        <p className="text-sm text-ink-900">Lunch</p>
        <p className="text-xs text-ink-500 mt-0.5">Ciorba de legume, 300 g. 240 kcal</p>
      </div>
      <div className="card p-4 mt-3">
        <p className="text-sm text-ink-900">Dinner</p>
        <p className="text-xs text-ink-500 mt-0.5">Telemea de capra, ardei copti. 380 kcal</p>
      </div>
    </div>
  )
}

/**
 * The screen this component belongs to, given a height of its own.
 *
 * The card is photographed at a phone's width, so nothing here needs help to
 * be visible. The height does: the drawer is `fixed`, the card wraps each cell
 * in a `transform`, and a transform makes that wrapper the containing block
 * for anything fixed inside it. Without a box to cover, the drawer would open
 * onto nothing.
 */
function Phone({ children }: { children: ReactNode }) {
  return <div data-phone="" style={{ height: 740 }}>{children}</div>
}

/**
 * Presses buttons inside the frame once it is mounted.
 *
 * The menu only exists after a tap, and a still picture cannot tap, so each
 * selector in `steps` is pressed in turn a frame apart.
 */
function Tap({ steps, children }: { steps: string[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let i = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const step of steps) {
      timers.push(setTimeout(() => {
        const root = ref.current?.closest('[data-phone]') ?? document
        root.querySelector<HTMLElement>(step)?.click()
      }, (i += 1) * 40))
    }
    return () => timers.forEach(clearTimeout)
  }, [steps])
  return <div ref={ref}>{children}</div>
}

/**
 * The bar itself: menu, wordmark, and the one action that is not a screen.
 *
 * Adding a meal stays on the bar because it is the thing the app is most often
 * opened to do, and it goes to today rather than to whatever day some other
 * screen was left on.
 */
export function TheBar() {
  return (
    <Phone>
      <MobileNav />
      <Screen />
    </Phone>
  )
}

/**
 * The menu, open. Nine screens, no second tier, in the order the sidebar uses.
 *
 * What this replaced was four along the bottom and the other five behind a
 * "More" button, which put Grocery three levels down and Recipes one.
 */
export function TheMenu() {
  return (
    <Phone>
      <Tap steps={['button[aria-label="Menu"]']}>
        <MobileNav />
      </Tap>
      <Screen />
    </Phone>
  )
}

/**
 * The menu reopened after going somewhere.
 *
 * The current screen is marked in the drawer the same way the sidebar marks
 * it, which is the only thing telling you where you are once the bar is a
 * wordmark and two buttons.
 */
export function TheMenuOnAnotherScreen() {
  return (
    <Phone>
      <Tap steps={['button[aria-label="Menu"]', 'a[href="/grocery"]', 'button[aria-label="Menu"]']}>
        <MobileNav />
      </Tap>
      <Screen />
    </Phone>
  )
}
