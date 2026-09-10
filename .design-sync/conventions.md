# Building with Bite Buddy

A meal planner built from one dietician's real plans, for two people. Warm
paper, one turquoise brand colour, a heavy display face for headings, and a
frog called Zig. The guide it implements is in `guidelines/docs/DESIGN-SYSTEM.md`,
which is worth reading before designing a screen.

## Setup

Load `styles.css`. Everything below comes from it, including the fonts and the
compiled component styles.

Three components call react-router hooks and throw outside a router: `MobileNav`,
`Sidebar` and `UndoBar`. Wrap anything containing them.

```jsx
<HashRouter><Sidebar /></HashRouter>
```

The theme is set on the root element: `data-theme="dark"` or `data-theme="light"`.
Set neither and the device decides. Every colour below is a token that flips
with it, so use the tokens and dark mode is free; write a hex value and it is
not.

## The styling idiom

Tailwind v4 utilities, generated from the tokens in `@theme`. Alongside them
sit twenty-one component utilities the app defines, and those carry the design
language: reach for one before composing the same thing out of primitives.

| Family | Names |
|---|---|
| Surfaces | `card`, `card-soft` |
| Buttons | `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-icon` |
| Chips and tabs | `chip`, `chip-on`, `chip-off`, `tab`, `tab-on`, `tab-off` |
| Form | `input`, `label` |
| Labels | `badge`, `tag` |
| Navigation | `nav-item`, `nav-item-active`, `meal-slot` |
| Type | `display` (Bungee, for headings and the wordmark) |

Colours are ramps, used as ordinary Tailwind utilities (`bg-bite-500`,
`text-ink-700`, `border-border-200`):

- `bite` 50 to 900, the single brand turquoise. **`bite-500` carries ink, not
  white**: white on it reads at 2.49:1 and fails, the app's own ink reads at
  6.15:1. The token for text on brand is `on-brand`. For brand-coloured text on
  a cream ground, use `bite-700`.
- `ink` 300/500/700/900 for text, `paper` and `cream-50` for grounds,
  `border-100`/`border-200` for rules.
- `coral`, `mustard`, `leaf` and `teal` for state. Roughly: leaf on track,
  mustard slightly over, coral over.
- Type tokens: `--font-display` (Bungee), `--font-sans` (Plus Jakarta Sans),
  `--font-mono` for figures.

Two rules the components already follow, and a design should not undo:

- **Colour is never the only carrier of meaning.** A bar over its target is
  coral *and* says "Over target, +800 mg". Keep the words.
- **Unknown is not zero.** A figure that is a floor rather than a total is
  marked with a trailing `+` and a faded bar tail. Do not render it as complete.

Roughly 70% calm, 20% functional colour, 10% chaos: the bold accents belong in
navigation, headings, empty states and moments of delight, and dense working
areas stay quiet.

## Where the truth is

`styles.css` and the files it imports are the whole vocabulary. Each component
has a `.prompt.md` beside it with its props and what it is for, and a `.d.ts`
with the real types. Read those rather than guessing at an API.

## A screen, put together

```jsx
<div className="card p-5">
  <SectionHeading action={<button className="btn-secondary">Fill the gaps</button>}>
    Today
  </SectionHeading>
  <div className="mt-4 flex items-center gap-6">
    <CalorieRing value={1642} target={1800} />
    <NutrientSummary
      n={{ calories: 1642, protein: 96, carbs: 181, fat: 54, fiber: 26 }}
      targets={{ calories: 1800, protein: 120, carbs: 170, fat: 60, fiber: 30 }}
      partial={['fiber']}
    />
  </div>
  <p className="mt-4 text-sm text-ink-500">Snacks still empty.</p>
</div>
```
