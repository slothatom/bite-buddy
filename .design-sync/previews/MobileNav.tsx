import { useEffect, useRef, type ReactNode } from 'react'
import { MobileNav } from 'bite-buddy'

/**
 * A phone, on a card that is 900px wide.
 *
 * Everything in this component is behind `md:hidden`, so at the width these
 * previews are photographed at the whole thing is display:none and the card
 * comes out blank. The rules below put the phone's breakpoint back inside the
 * frame and pin the drawer's `fixed` overlay to the frame rather than to the
 * window, so the menu covers the screen it belongs to.
 */
const PHONE = `
.ds-phone { position: relative; width: 390px; height: 620px; overflow: hidden;
            border-radius: 20px; border: 1px solid #e5e0d5; background: #fff }
.ds-phone .md\\:hidden { display: flex !important }
.ds-phone .fixed { position: absolute !important }
`

/** What is under the bar, so the sticky header has something to sit on. */
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
    </div>
  )
}

/**
 * Presses buttons inside the frame once it is mounted.
 *
 * The menu only exists after a tap, and a still picture cannot tap, so each
 * label in `steps` is pressed in turn a frame apart.
 */
function Tap({ steps, children }: { steps: string[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let i = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const step of steps) {
      timers.push(setTimeout(() => {
        const root = ref.current?.closest('.ds-phone') ?? ref.current
        const el = root?.querySelector<HTMLElement>(step)
        el?.click()
      }, (i += 1) * 40))
    }
    return () => timers.forEach(clearTimeout)
  }, [steps])
  return <div ref={ref}>{children}</div>
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{PHONE}</style>
      <div className="ds-phone">{children}</div>
    </>
  )
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
