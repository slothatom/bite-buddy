# 🥗 Bite Buddy — Meal Prep HQ

A fully offline, privacy-first meal prep companion. Plan your week, track macros, build recipes, manage your grocery list, and earn XP for staying consistent — all in the browser with no account required.

---

## Features

### Weekly Planner
- 7-day meal grid with Breakfast → Snack 1 → Lunch → Snack 2 → Dinner slots
- Switch between **week view** (grid) and **day view** (single-day detail)
- **Copy a day's meals** to any other day of the week
- Navigate forward/backward by week
- Today's macros shown as progress bars vs. your targets

### Recipes
- Create, edit, and delete recipes with emoji, macros, ingredients, and prep steps
- Ingredient search powered by **USDA FoodData Central** and **Open Food Facts** APIs
- **Barcode scanner** for packaged foods (camera-based, mobile-friendly)
- **Favorite** recipes with a star for quick access
- Filter by tag (`high-protein`, `vegan`, `quick`, etc.) or favorites only
- Per-serving macro breakdown: calories, protein, carbs, fat, fiber

### Grocery List
- Generate from the whole week or **select individual recipes** to include
- Recipe names shown on each item so you know what it's for
- Grouped alphabetically with a check-off flow and progress bar
- Clear checked items or reset the whole list

### Prep Mode
- Step-by-step cooking guide with built-in countdown timers per step
- Earn **100 XP** on completion + achievement badge

### Cook Schedule
- Schedule prep sessions by date and time
- Tag which recipes you'll cook in each session
- Mark sessions as done or remove them

### Analytics
- **Nutrition tab**: weekly average macros vs. goals, per-day calorie bar chart
- **Weight tab**: weight log with sparkline trend, total change since start
- Body measurements tracker (waist, hips, chest, arms, thighs)

### Gamification
- **XP system**: earn points for adding recipes, planning meals, completing prep, logging weight, hitting streaks
- **Levels**: 200 XP per level — progress bar in the sidebar
- **Achievements**: 10 unlockable badges (First Recipe, Week Warrior, Macro Tracker, etc.)
- **Day streak**: log meals daily to build your streak; breaks if you miss a day
- XP toast notifications on every earn
- Achievement info panel with locked/unlocked state

### Import / Export
- Export the current week's plan + referenced recipes as a `.json` file
- Import any saved plan — new recipes are auto-added to your library
- Share plans by passing the JSON to another device

---

## Tech Stack

| Layer | Library |
|-------|---------|
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 (hash-based, works offline) |
| State | Zustand v5 with `persist` middleware (localStorage) |
| Build | Vite |
| Nutrition APIs | USDA FoodData Central · Open Food Facts |
| Barcode | @zxing/browser |

No backend. No database. All data lives in `localStorage`.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

Requires Node.js 18+.

---

## Project Structure

```
src/
├── components/
│   ├── dashboard/        # MealSlotCard, AddMealModal, ImportExportModal, ProgressInfoModal
│   ├── layout/           # Sidebar, BottomNav, XpToast
│   └── recipes/          # IngredientSearch, BarcodeScanner
├── pages/
│   ├── Dashboard.tsx     # Weekly planner + stats
│   ├── Recipes.tsx       # Recipe library + form
│   ├── GroceryList.tsx   # Shopping list
│   ├── PrepMode.tsx      # Step-by-step cooking guide
│   ├── Schedule.tsx      # Cook session planner
│   ├── Analytics.tsx     # Nutrition + body tracking
│   └── Changelog.tsx     # Release notes
├── store/
│   ├── useUserStore.ts   # Profile, XP, achievements, toasts
│   ├── useRecipeStore.ts # Recipe library + favorites
│   ├── useMealPlanStore.ts  # Week plan, grocery list, import/export
│   ├── useCookStore.ts   # Cook schedule sessions
│   ├── useBodyStore.ts   # Weight + measurement logs
│   └── seedRecipes.ts    # Default starter recipes
├── services/
│   └── nutritionApi.ts   # USDA + OFF API clients
└── types/
    └── index.ts          # Shared TypeScript interfaces
```

---

## Environment Variables

```bash
# Optional — set in .env.local
VITE_USDA_API_KEY=your_key_here   # https://fdc.nal.usda.gov/api-guide.html
```

The app works without a key (USDA demo key is used by default), but may hit rate limits with heavy ingredient searching.

---

## Roadmap

- [ ] Google login + cloud sync
- [ ] Partner / household plan sharing
- [ ] Pantry / inventory tracker (auto-subtract from grocery list)
- [ ] Meal templates (save a week and reuse it)
- [ ] PWA / installable app
