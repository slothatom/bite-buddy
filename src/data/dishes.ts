import type { Recipe, RecipeComponent, RecipeTag } from '../types'

/**
 * The dishes the dietician names but does not spell out.
 *
 * A line like "spanac cu linte (40 g linte nefiarta)" gives one weight and
 * assumes the cook knows the rest. These definitions supply the rest: the full
 * component list, scaled so that the weight the dietician *does* state matches
 * one serving here.
 *
 * Quantities follow the plans' own conventions, a teaspoon of olive oil per
 * portion, vegetables by the half-plate, so that a dish's calories reflect how
 * these meals were actually built rather than a generic restaurant version.
 *
 * These are the building blocks; the 481 planned meals reference them by name.
 */

interface DishSpec {
  id: string
  en: string
  ro?: string
  hu?: string
  emoji: string
  servings: number
  /** [foodId, grams] for the whole batch, not per serving. */
  parts: [string, number][]
  tags?: RecipeTag[]
  prep?: number
  cook?: number
  steps?: string[]
  /** Terms in the plans that refer to this dish. Normalised on load. */
  aliases: string[]
  /**
   * True when the plans state a portion of this dish by weight
   * ("350 g ciorba a la grec", "200 g piure de telina"), soups, purées and
   * stews. For everything else a stated weight names an ingredient rather than
   * the dish ("tigaie picanta: 100 g piept de pui"), so the weight must not be
   * read as a portion size.
   */
  byWeight?: boolean
}

const SPECS: DishSpec[] = [
  // ─── Spreads & cold components ─────────────────────────────────────────────
  {
    id: 'dish-tuna-spread', en: 'Tuna spread', ro: 'pastă de ton', hu: 'tonhalkrém', emoji: '🐟',
    servings: 2, parts: [['tuna-canned', 135], ['cream-cheese', 50], ['onion', 20], ['yogurt', 15], ['lemon-juice', 5]],
    tags: ['spread', 'high-protein', 'quick'], prep: 10,
    steps: ['Drain the tuna well.', 'Mash with cream cheese, yogurt and finely chopped onion.', 'Season with lemon juice, salt and pepper.'],
    aliases: ['pasta de ton', 'tonhalkrem', 'pate de ton'],
  },
  {
    id: 'dish-tuna-spread-ricotta', en: 'Tuna & ricotta spread', hu: 'tonhalkrém ricottával', emoji: '🐟',
    servings: 2, parts: [['tuna-canned', 130], ['ricotta', 100]],
    tags: ['spread', 'high-protein', 'quick'], prep: 8,
    steps: ['Drain the tuna and mash it with the ricotta until smooth.'],
    aliases: ['tonhalkrem ricotta'],
  },
  {
    id: 'dish-cheese-spread', en: 'Cheese spread', ro: 'pastă de brânză', emoji: '🧀',
    servings: 1, parts: [['cottage-cheese', 100], ['yogurt', 30], ['onion', 15], ['dill', 3]],
    tags: ['spread', 'vegetarian', 'quick'], prep: 5,
    steps: ['Mash the cottage cheese with the yogurt.', 'Fold through chopped onion and dill; season.'],
    aliases: ['pasta de branza'],
  },
  {
    id: 'dish-egg-spread', en: 'Egg spread', ro: 'pastă de ou', hu: 'tojáskrém', emoji: '🥚',
    servings: 1, parts: [['egg', 55], ['cottage-cheese', 50], ['mustard', 5]],
    tags: ['spread', 'vegetarian', 'quick', 'high-protein'], prep: 12,
    steps: ['Hard-boil the egg, then cool and peel it.', 'Mash with the cottage cheese and mustard; season.'],
    aliases: ['pasta de ou', 'tojaskrem'],
  },
  {
    id: 'dish-avocado-spread', en: 'Avocado spread', ro: 'pastă de avocado', emoji: '🥑',
    servings: 1, parts: [['avocado', 100], ['lemon-juice', 5], ['garlic', 2]],
    tags: ['spread', 'vegan', 'quick'], prep: 5,
    steps: ['Mash the avocado with lemon juice and crushed garlic; season.'],
    aliases: ['pasta de avocado din avocado', 'pasta de avocado', 'guacamole din avocado'],
  },

  // ─── Egg dishes ────────────────────────────────────────────────────────────
  {
    id: 'dish-omelette', en: 'Omelette', ro: 'omletă', hu: 'rántotta', emoji: '🍳',
    servings: 1, parts: [['egg', 110], ['telemea', 25], ['olive-oil', 5]],
    tags: ['breakfast', 'high-protein', 'quick', 'vegetarian'], prep: 3, cook: 7,
    steps: ['Beat the eggs and season.', 'Cook gently in the olive oil, scattering over the crumbled cheese.'],
    aliases: ['omleta'],
  },
  {
    id: 'dish-omelette-spinach', en: 'Spinach omelette', ro: 'omletă cu spanac', hu: 'spenótos rántotta', emoji: '🍳',
    servings: 1, parts: [['egg', 110], ['spinach', 80], ['olive-oil', 5]],
    tags: ['breakfast', 'high-protein', 'quick', 'vegetarian'], prep: 3, cook: 8,
    steps: ['Wilt the spinach in the olive oil.', 'Pour over the beaten eggs and cook gently.'],
    aliases: ['omleta cu spanac', 'spenotos rantotta'],
  },
  {
    id: 'dish-omelette-mushroom', en: 'Mushroom omelette', ro: 'omletă cu ciuperci', emoji: '🍳',
    servings: 1, parts: [['egg', 110], ['mushrooms', 80], ['olive-oil', 5]],
    tags: ['breakfast', 'high-protein', 'quick', 'vegetarian'], prep: 3, cook: 9,
    steps: ['Fry the sliced mushrooms in the olive oil until browned.', 'Pour over the beaten eggs and cook gently.'],
    aliases: ['omleta cu ciuperci'],
  },
  {
    id: 'dish-fried-eggs', en: 'Fried eggs', ro: 'ochiuri', emoji: '🍳',
    servings: 1, parts: [['egg', 110], ['olive-oil', 5]],
    tags: ['high-protein', 'quick', 'vegetarian'], prep: 1, cook: 5,
    steps: ['Fry the eggs gently in olive oil.'],
    aliases: ['2 ochiuri', 'ochiuri', 'ou semi', 'oua posate'],
  },
  {
    id: 'dish-egg-muffins', en: 'Egg muffins', hu: 'tojásos muffin', emoji: '🧁',
    servings: 2, parts: [['egg', 165], ['bell-pepper', 60], ['spinach', 40], ['telemea', 40], ['olive-oil', 5]],
    tags: ['breakfast', 'high-protein', 'batch', 'vegetarian'], prep: 10, cook: 20,
    steps: ['Beat the eggs with the chopped vegetables and cheese.', 'Divide into oiled muffin tins.', 'Bake at 180 °C until set.'],
    aliases: ['tojasos muffin'],
  },
  {
    id: 'dish-potato-egg', en: 'Potatoes with egg', ro: 'cartofi cu ou', emoji: '🥔',
    servings: 1, parts: [['potato', 200], ['egg', 55], ['olive-oil', 5]],
    tags: ['quick', 'vegetarian'], prep: 5, cook: 20,
    steps: ['Boil or roast the potatoes.', 'Top with a fried egg.'],
    aliases: ['cartofi cu ou'],
  },
  {
    id: 'dish-shakshuka-chickpea', en: 'Chickpea shakshuka', ro: 'shakshuka cu năut', emoji: '🍳',
    servings: 2, parts: [['egg', 110], ['chickpeas-cooked', 200], ['tomato-sauce', 200], ['bell-pepper', 100], ['onion', 60], ['olive-oil', 10]],
    tags: ['high-protein', 'vegetarian', 'batch'], prep: 10, cook: 25,
    steps: ['Soften onion and pepper in olive oil.', 'Add tomato sauce and chickpeas; simmer.', 'Make wells and crack in the eggs; cover until set.'],
    aliases: ['shakshuka cu naut', 'jumatate din reteta de shakshuka cu naut'],
  },

  // ─── Porridge & breakfast bowls ────────────────────────────────────────────
  {
    id: 'dish-porridge', en: 'Oat porridge', ro: 'terci de ovăz', hu: 'zabkása', emoji: '🥣',
    servings: 1, parts: [['oats', 40], ['milk', 100], ['water', 100], ['cinnamon', 1]],
    tags: ['breakfast', 'quick', 'vegetarian'], prep: 2, cook: 8,
    steps: ['Simmer the oats with the milk and water until thick.', 'Stir through cinnamon.'],
    aliases: ['terci de ovaz', 'terci de ovaz apa', 'zabkasa', 'terci'],
  },
  {
    id: 'dish-porridge-apple', en: 'Apple & cinnamon porridge', ro: 'terci de ovăz cu măr', emoji: '🥣',
    servings: 1, parts: [['oats', 40], ['milk', 100], ['water', 100], ['apple', 120], ['cinnamon', 1]],
    tags: ['breakfast', 'quick', 'vegetarian'], prep: 4, cook: 8,
    steps: ['Simmer the oats with milk and water.', 'Stir in the grated apple and cinnamon.'],
    aliases: ['terci de ovaz cu mere lapte', 'terci de ovaz cu mar razuit lapte'],
  },
  {
    id: 'dish-baked-oats', en: 'Baked oats', ro: 'fulgi de ovăz la cuptor', emoji: '🍮',
    servings: 1, parts: [['oats', 45], ['milk', 120], ['egg', 30], ['banana', 60], ['cinnamon', 1]],
    tags: ['breakfast', 'vegetarian'], prep: 6, cook: 25,
    steps: ['Blend everything together.', 'Pour into a dish and bake at 180 °C until set.'],
    aliases: ['1 portie de fulgi de ovaz la cuptor', 'fulgi de ovaz la cuptor'],
  },
  {
    id: 'dish-chia-pudding', en: 'Chia pudding', ro: 'budincă de chia', hu: 'chiamagos puding', emoji: '🍮',
    servings: 1, parts: [['chia-seeds', 20], ['milk', 150], ['oats', 30]],
    tags: ['breakfast', 'vegetarian'], prep: 5,
    steps: ['Stir the chia and oats into the milk.', 'Refrigerate overnight.'],
    aliases: ['budinca de chia lapte', 'budinca de chia', 'chiamagos puding'],
  },
  {
    id: 'dish-chia-pudding-mango', en: 'Mango chia pudding', ro: 'budincă de chia cu mango', emoji: '🥭',
    servings: 1, parts: [['chia-seeds', 20], ['milk', 150], ['oats', 30], ['mango', 100]],
    tags: ['breakfast', 'vegetarian'], prep: 6,
    steps: ['Stir the chia and oats into the milk and chill overnight.', 'Top with diced mango.'],
    aliases: ['budinca de chia cu mango lapte', 'budinca de chia cu mango'],
  },
  {
    id: 'dish-polenta', en: 'Polenta', ro: 'mămăligă', hu: 'puliszka', emoji: '🌽',
    servings: 1, parts: [['cornmeal', 50], ['water', 200]],
    tags: ['quick', 'vegan'], prep: 2, cook: 15,
    steps: ['Rain the cornmeal into salted boiling water, whisking.', 'Cook, stirring, until it pulls from the pan.'],
    aliases: ['mamaliga', 'puliszka'],
  },

  // ─── Purées & vegetable sides ──────────────────────────────────────────────
  {
    id: 'dish-celeriac-puree', en: 'Celeriac purée', ro: 'piure de țelină', hu: 'zellerpüré', emoji: '🥔',
    servings: 1, parts: [['celeriac', 140], ['potato', 60], ['milk', 30], ['olive-oil', 5]],
    tags: ['vegetarian'], prep: 10, cook: 20,
    steps: ['Boil the celeriac and potato until soft.', 'Mash with warm milk and olive oil.'],
    aliases: ['piure de telina', 'zellerpure'],
    byWeight: true,
  },
  {
    id: 'dish-parsnip-puree', en: 'Parsnip purée', ro: 'piure de păstârnac', emoji: '🥔',
    servings: 1, parts: [['parsnip', 140], ['potato', 60], ['milk', 30], ['olive-oil', 5]],
    tags: ['vegetarian'], prep: 10, cook: 20,
    steps: ['Boil the parsnip and potato until soft.', 'Mash with warm milk and olive oil.'],
    aliases: ['piure de pastarnac'],
    byWeight: true,
  },
  {
    id: 'dish-cauliflower-puree', en: 'Cauliflower purée', ro: 'piure de conopidă', emoji: '🥔',
    servings: 1, parts: [['cauliflower', 200], ['milk', 30], ['olive-oil', 5]],
    tags: ['vegetarian', 'low-carb'], prep: 8, cook: 15,
    steps: ['Steam the cauliflower until very soft.', 'Blend with milk and olive oil.'],
    aliases: ['piure de conopida'],
    byWeight: true,
  },
  {
    id: 'dish-creamed-spinach', en: 'Creamed spinach', ro: 'mâncare de spanac', emoji: '🥬',
    servings: 2, parts: [['spinach', 400], ['milk', 100], ['flour-wheat', 15], ['olive-oil', 15], ['garlic', 6]],
    tags: ['vegetarian', 'batch'], prep: 5, cook: 15,
    steps: ['Soften the garlic in olive oil and stir in the flour.', 'Whisk in the milk, then fold through the spinach and cook down.'],
    aliases: ['mancare de spanac'],
    byWeight: true,
  },
  {
    id: 'dish-zucchini-stew', en: 'Zucchini stew', ro: 'mâncare de dovlecel', emoji: '🥒',
    servings: 2, parts: [['zucchini', 450], ['tomato-sauce', 100], ['onion', 60], ['olive-oil', 10], ['dill', 5]],
    tags: ['vegan', 'batch'], prep: 10, cook: 25,
    steps: ['Soften the onion in olive oil.', 'Add sliced zucchini and tomato sauce; simmer until tender.', 'Finish with dill.'],
    aliases: ['mancare de dovlecel'],
    byWeight: true,
  },
  {
    id: 'dish-lentil-stew', en: 'Lentil stew', ro: 'mâncare de linte', hu: 'lencsefőzelék', emoji: '🫘',
    servings: 2, parts: [['lentils', 100], ['onion', 60], ['carrot', 80], ['olive-oil', 10], ['tomato-sauce', 80]],
    tags: ['vegan', 'batch', 'high-protein'], prep: 10, cook: 30,
    steps: ['Soften onion and carrot in olive oil.', 'Add the lentils, tomato and water; simmer until soft.'],
    aliases: ['mancare de linte', 'lencsefozelek'],
    byWeight: true,
  },
  {
    id: 'dish-spinach-lentils', en: 'Lentils with spinach', ro: 'spanac cu linte', emoji: '🥬',
    servings: 1, parts: [['lentils', 40], ['spinach', 200], ['onion', 40], ['garlic', 5], ['olive-oil', 5]],
    tags: ['vegan', 'high-protein'], prep: 8, cook: 25,
    steps: ['Simmer the lentils until tender.', 'Wilt the spinach with garlic in olive oil and combine.'],
    aliases: ['spanac cu linte'],
  },
  {
    id: 'dish-braised-cabbage', en: 'Braised cabbage', ro: 'varză călită', emoji: '🥬',
    servings: 2, parts: [['cabbage', 500], ['onion', 60], ['tomato-sauce', 80], ['olive-oil', 10]],
    tags: ['vegan', 'batch'], prep: 10, cook: 30,
    steps: ['Soften the onion, add shredded cabbage and tomato.', 'Braise until meltingly soft.'],
    aliases: ['varza calita'],
    byWeight: true,
  },
  {
    id: 'dish-wok-vegetables', en: 'Wok vegetables', ro: 'legume wok', emoji: '🥘',
    servings: 1, parts: [['vegetables-mixed', 300], ['olive-oil', 5], ['garlic', 5]],
    tags: ['vegan', 'quick'], prep: 8, cook: 10,
    steps: ['Stir-fry the vegetables hot and fast with garlic in olive oil.'],
    aliases: ['legume wok', '300 g legume wok'],
    byWeight: true,
  },
  {
    id: 'dish-sauteed-mushrooms', en: 'Sautéed mushrooms', ro: 'ciuperci călite', emoji: '🍄',
    servings: 1, parts: [['mushrooms', 100], ['olive-oil', 5], ['garlic', 4]],
    tags: ['vegan', 'quick'], prep: 5, cook: 10,
    steps: ['Fry the mushrooms in olive oil until browned; add garlic at the end.'],
    aliases: ['ciuperci calite intr de ulei de masline', '5 6 buc de ciuperci calite intr de ulei de masline',
      '5 6 buc ciuperci calite intr de ulei de masline', '4 5 buc de ciuperci calite intr de ulei de masline'],
  },
  {
    id: 'dish-beetroot-salad', en: 'Beetroot salad', ro: 'salată de sfeclă roșie', hu: 'céklasaláta', emoji: '🧡',
    servings: 1, parts: [['beetroot', 150], ['olive-oil', 5], ['lemon-juice', 5]],
    tags: ['vegan', 'salad', 'quick'], prep: 8,
    steps: ['Grate or dice cooked beetroot.', 'Dress with olive oil and lemon.'],
    aliases: ['ceklasalata', 'salata de sfecla'],
  },
  {
    id: 'dish-carrot-salad', en: 'Carrot salad', ro: 'salată de morcovi', emoji: '🥕',
    servings: 1, parts: [['carrot', 150], ['olive-oil', 5], ['lemon-juice', 5]],
    tags: ['vegan', 'salad', 'quick'], prep: 6,
    steps: ['Grate the carrots and dress with olive oil and lemon.'],
    aliases: ['salata de morcovi'],
  },
  {
    id: 'dish-cabbage-salad', en: 'Cabbage salad', ro: 'salată de varză', emoji: '🥬',
    servings: 1, parts: [['cabbage', 150], ['olive-oil', 5], ['lemon-juice', 5]],
    tags: ['vegan', 'salad', 'quick'], prep: 6,
    steps: ['Shred the cabbage finely, salt it, then dress with oil and lemon.'],
    aliases: ['salata de varza'],
  },
  {
    id: 'dish-roasted-vegetables', en: 'Roasted vegetables', ro: 'legume la cuptor', emoji: '🍠',
    servings: 1, parts: [['vegetables-mixed', 300], ['olive-oil', 5]],
    tags: ['vegan'], prep: 10, cook: 35,
    steps: ['Toss the vegetables with olive oil and herbs.', 'Roast at 200 °C until caramelised.'],
    aliases: ['legume la cuptor', 'legume la gratar', 'lerben parolva zoldsegek 1 tk olivaolajjal',
      'zoldsegek 1 tk olivaolajjal', 'zoldsegkoret'],
    byWeight: true,
  },

  // ─── Soups ─────────────────────────────────────────────────────────────────
  {
    id: 'dish-ciorba-greek', en: 'Greek-style sour soup', ro: 'ciorbă a la grec', hu: 'görög csorba', emoji: '🍲',
    servings: 2, parts: [['turkey-breast', 60], ['rice-white', 30], ['carrot', 80], ['celeriac', 50], ['onion', 50], ['egg', 30], ['yogurt', 60], ['olive-oil', 10], ['water', 600]],
    tags: ['soup', 'batch'], prep: 12, cook: 35,
    steps: ['Simmer the turkey with the diced vegetables and rice.', 'Temper the egg and yogurt with hot broth, then stir back in off the heat.'],
    aliases: ['ciorba a la grec', 'gorog csorba'],
    byWeight: true,
  },
  {
    id: 'dish-ciorba-vegetable', en: 'Vegetable sour soup', ro: 'ciorbă de legume', emoji: '🍲',
    servings: 2, parts: [['vegetables-mixed', 400], ['potato', 100], ['olive-oil', 10], ['water', 600]],
    tags: ['soup', 'vegan', 'batch'], prep: 12, cook: 30,
    steps: ['Simmer all the vegetables until tender.', 'Sour to taste and finish with olive oil.'],
    aliases: ['ciorba de legume'],
    byWeight: true,
  },
  {
    id: 'dish-ciorba-cabbage', en: 'Cabbage soup', ro: 'ciorbă de varză', emoji: '🍲',
    servings: 2, parts: [['cabbage', 400], ['carrot', 80], ['onion', 60], ['tomato-sauce', 80], ['olive-oil', 10], ['water', 600]],
    tags: ['soup', 'vegan', 'batch'], prep: 10, cook: 35,
    steps: ['Simmer the shredded cabbage with the other vegetables until soft.'],
    aliases: ['ciorba de varza', 'ciorba varza', 'supa de varza'],
    byWeight: true,
  },
  {
    id: 'dish-ciorba-green-bean', en: 'Green bean soup', ro: 'ciorbă de fasole verde', emoji: '🍲',
    servings: 2, parts: [['green-beans', 350], ['potato', 100], ['carrot', 80], ['olive-oil', 10], ['water', 600]],
    tags: ['soup', 'vegan', 'batch'], prep: 10, cook: 30,
    steps: ['Simmer the beans with potato and carrot until tender; sour to taste.'],
    aliases: ['ciorba de fasole verde', 'supa de fasole verde', 'supa fasole verde'],
    byWeight: true,
  },
  {
    id: 'dish-ciorba-beef', en: 'Beef sour soup', hu: 'marhahúsos csorba', emoji: '🍲',
    servings: 2, parts: [['beef', 120], ['vegetables-mixed', 300], ['potato', 100], ['olive-oil', 10], ['water', 600]],
    tags: ['soup', 'batch'], prep: 15, cook: 60,
    steps: ['Simmer the beef until tender, then add the vegetables.', 'Sour to taste.'],
    aliases: ['marhahusos csorba'],
    byWeight: true,
  },
  {
    id: 'dish-soup-mushroom-cream', en: 'Cream of mushroom soup', ro: 'supă cremă de ciuperci', hu: 'gombakrémleves', emoji: '🍄',
    servings: 2, parts: [['mushrooms', 400], ['onion', 60], ['potato', 100], ['milk', 100], ['olive-oil', 10], ['water', 500]],
    tags: ['soup', 'vegetarian', 'batch'], prep: 10, cook: 25,
    steps: ['Sweat the mushrooms and onion in olive oil.', 'Add potato and water, simmer, then blend with the milk.'],
    aliases: ['supa crema de ciuperci', 'gombakremleves'],
    byWeight: true,
  },
  {
    id: 'dish-soup-vegetable-cream', en: 'Cream of vegetable soup', ro: 'supă cremă de legume', emoji: '🥣',
    servings: 2, parts: [['vegetables-mixed', 450], ['potato', 100], ['olive-oil', 10], ['water', 500]],
    tags: ['soup', 'vegan', 'batch'], prep: 10, cook: 25,
    steps: ['Simmer the vegetables until soft, then blend smooth.'],
    aliases: ['supa crema de legume'],
    byWeight: true,
  },
  {
    id: 'dish-soup-cauliflower-cream', en: 'Cream of cauliflower soup', ro: 'supă cremă de conopidă', emoji: '🥣',
    servings: 2, parts: [['cauliflower', 450], ['potato', 80], ['milk', 100], ['olive-oil', 10], ['water', 500]],
    tags: ['soup', 'vegetarian', 'batch'], prep: 10, cook: 25,
    steps: ['Simmer the cauliflower and potato until soft, then blend with the milk.'],
    aliases: ['supa crema de conopida'],
    byWeight: true,
  },
  {
    id: 'dish-soup-tomato-cream', en: 'Cream of tomato soup', ro: 'supă cremă de roșii', emoji: '🍅',
    servings: 2, parts: [['tomatoes', 500], ['onion', 60], ['potato', 80], ['olive-oil', 10], ['basil', 5], ['water', 400]],
    tags: ['soup', 'vegan', 'batch'], prep: 10, cook: 25,
    steps: ['Soften the onion, add tomatoes and potato, simmer and blend.', 'Finish with basil.'],
    aliases: ['supa crema de rosii'],
    byWeight: true,
  },
  {
    id: 'dish-soup-spinach-cream', en: 'Cream of spinach soup', ro: 'supă cremă de spanac', emoji: '🥬',
    servings: 2, parts: [['spinach', 350], ['potato', 120], ['onion', 60], ['milk', 100], ['olive-oil', 10], ['water', 450]],
    tags: ['soup', 'vegetarian', 'batch'], prep: 10, cook: 20,
    steps: ['Simmer potato and onion, add spinach briefly, then blend with milk.'],
    aliases: ['supa crema de spanac'],
    byWeight: true,
  },
  {
    id: 'dish-soup-asparagus-cream', en: 'Cream of asparagus soup', ro: 'supă cremă de sparanghel', emoji: '🥬',
    servings: 2, parts: [['asparagus', 400], ['potato', 100], ['milk', 100], ['olive-oil', 10], ['water', 450]],
    tags: ['soup', 'vegetarian', 'batch'], prep: 10, cook: 22,
    steps: ['Simmer the asparagus with potato, then blend with the milk.'],
    aliases: ['supa crema de sparanghel'],
    byWeight: true,
  },
  {
    id: 'dish-soup-kohlrabi', en: 'Kohlrabi soup', hu: 'karalábéleves', emoji: '🥣',
    servings: 2, parts: [['kohlrabi', 400], ['carrot', 80], ['milk', 80], ['flour-wheat', 15], ['olive-oil', 10], ['water', 500]],
    tags: ['soup', 'vegetarian', 'batch'], prep: 12, cook: 25,
    steps: ['Simmer the diced kohlrabi and carrot.', 'Thicken with a light milk-and-flour liaison.'],
    aliases: ['karalabeleves'],
    byWeight: true,
  },

  // ─── Mains ─────────────────────────────────────────────────────────────────
  {
    id: 'dish-spicy-pan-chicken', en: 'Spicy chicken & vegetable pan', ro: 'tigaie picantă', emoji: '🌶️',
    servings: 1, parts: [['chicken-breast', 100], ['vegetables-mixed', 250], ['olive-oil', 5], ['garlic', 5]],
    tags: ['high-protein', 'quick'], prep: 10, cook: 15,
    steps: ['Sear the sliced chicken in olive oil.', 'Add the vegetables and garlic; stir-fry until just tender and season with chilli.'],
    aliases: ['tigaie picanta piept de pui', 'tigaie picanta'],
  },
  {
    id: 'dish-chili-con-carne', en: 'Chili con carne', ro: 'chili con carne', emoji: '🌶️',
    servings: 1, parts: [['chicken-breast', 120], ['beans-kidney-cooked', 100], ['tomato-sauce', 100], ['onion', 50], ['olive-oil', 5]],
    tags: ['high-protein', 'batch'], prep: 10, cook: 30,
    steps: ['Brown the meat with the onion in olive oil.', 'Add tomato and beans; simmer with chilli and cumin.'],
    aliases: ['chili con carne'],
  },
  {
    id: 'dish-broccoli-patties', en: 'Broccoli patties', ro: 'chiftele de broccoli', emoji: '🥦',
    servings: 2, parts: [['broccoli', 300], ['egg', 55], ['oats', 40], ['telemea', 40], ['olive-oil', 10]],
    tags: ['vegetarian', 'batch'], prep: 15, cook: 20,
    steps: ['Steam and chop the broccoli.', 'Mix with egg, oats and cheese; shape into patties.', 'Bake or pan-fry in olive oil.'],
    aliases: ['chiftele de broccoli'],
  },
  {
    id: 'dish-zucchini-patties', en: 'Zucchini patties', ro: 'chiftele de dovlecel', emoji: '🥒',
    servings: 2, parts: [['zucchini', 350], ['egg', 55], ['flour-wheat', 40], ['dill', 5], ['olive-oil', 10]],
    tags: ['vegetarian', 'batch'], prep: 15, cook: 18,
    steps: ['Grate and drain the zucchini.', 'Bind with egg, flour and dill; shape and fry gently.'],
    aliases: ['chiftelute de dovlecel', 'chiftele de dovlecel'],
  },
  {
    id: 'dish-pork-under-lid', en: 'Pork loin under the lid', ro: 'cotlet sub capac', emoji: '🥩',
    servings: 1, parts: [['pork-loin', 100], ['olive-oil', 5], ['garlic', 5]],
    tags: ['high-protein'], prep: 5, cook: 25,
    steps: ['Brown the loin in olive oil, add garlic and a splash of water.', 'Cover and cook gently until tender.'],
    aliases: ['cotlet sub capac', 'cotlet la gratar'],
  },
  {
    id: 'dish-pork-stew', en: 'Pork stew', ro: 'tocăniță de porc', emoji: '🍲',
    servings: 1, parts: [['pork-shoulder', 100], ['onion', 60], ['tomato-sauce', 80], ['olive-oil', 5]],
    tags: ['batch'], prep: 10, cook: 50,
    steps: ['Brown the pork with onion.', 'Add tomato and water; simmer covered until tender.'],
    aliases: ['tocanita de porc'],
    byWeight: true,
  },
  {
    id: 'dish-beef-braised', en: 'Braised beef', ro: 'mușchiuleț de vită', hu: 'szaftos marhahús', emoji: '🥩',
    servings: 1, parts: [['beef', 100], ['onion', 50], ['olive-oil', 5]],
    tags: ['high-protein'], prep: 8, cook: 60,
    steps: ['Sear the beef, add onion and water.', 'Braise covered until it gives to a fork.'],
    aliases: ['muschiulet de vita', 'szaftos marhahus'],
  },
  {
    id: 'dish-cod-salsa', en: 'Cod with mango salsa', ro: 'cod cu sos de salsa', emoji: '🐟',
    servings: 1, parts: [['cod', 150], ['avocado', 50], ['mango', 50], ['lemon-juice', 5], ['olive-oil', 5]],
    tags: ['pescatarian', 'high-protein'], prep: 12, cook: 12,
    steps: ['Roast or pan-fry the cod.', 'Dice avocado and mango with lemon and oil; spoon over.'],
    aliases: ['cod cu sos de salsa'],
  },
  {
    id: 'dish-salmon-sweet-potato', en: 'Baked salmon with sweet potato', ro: 'somon cu cartofi dulci la cuptor', emoji: '🐟',
    servings: 1, parts: [['salmon', 100], ['sweet-potato', 200], ['olive-oil', 5]],
    tags: ['pescatarian', 'high-protein'], prep: 8, cook: 30,
    steps: ['Roast the sweet potato wedges in olive oil.', 'Add the salmon for the last 12 minutes.'],
    aliases: ['somon cu 200 g cartofi dulci la cuptor', 'somon cu cartofi dulci la cuptor'],
  },
  {
    id: 'dish-trout-baked', en: 'Baked trout', ro: 'păstrăv la cuptor', emoji: '🐟',
    servings: 1, parts: [['trout', 150], ['olive-oil', 5], ['lemon-juice', 5], ['garlic', 4]],
    tags: ['pescatarian', 'high-protein'], prep: 6, cook: 22,
    steps: ['Season the trout with garlic and lemon.', 'Bake at 190 °C until just opaque.'],
    aliases: ['pastrav la cuptor'],
  },
  {
    id: 'dish-chicken-mozzarella', en: 'Chicken with mozzarella & tomato', ro: 'piept de pui cu mozzarella și sos de roșii', emoji: '🍗',
    servings: 1, parts: [['chicken-breast', 120], ['mozzarella', 50], ['tomato-sauce', 100], ['olive-oil', 5], ['basil', 3]],
    tags: ['high-protein'], prep: 8, cook: 25,
    steps: ['Sear the chicken, spoon over tomato sauce.', 'Top with mozzarella and bake until melted.'],
    aliases: ['piept de pui cu mozzarella si sos de rosii'],
  },
  {
    id: 'dish-pesto-pasta', en: 'Pesto pasta', hu: 'pestós laska', emoji: '🍝',
    servings: 1, parts: [['pasta-wholemeal', 50], ['walnuts', 10], ['parmesan', 20], ['olive-oil', 15], ['basil', 10]],
    tags: ['vegetarian'], prep: 8, cook: 12,
    steps: ['Blend basil, walnuts, parmesan and olive oil into a pesto.', 'Toss through the drained pasta.'],
    aliases: ['pestos laska'],
  },
  {
    id: 'dish-mushroom-quinoa', en: 'Mushroom quinoa', hu: 'gombás quinoa', emoji: '🍄',
    servings: 1, parts: [['quinoa', 50], ['mushrooms', 150], ['telemea', 40], ['olive-oil', 5]],
    tags: ['vegetarian', 'high-protein'], prep: 8, cook: 20,
    steps: ['Cook the quinoa.', 'Fry the mushrooms in olive oil and fold through with the cheese.'],
    aliases: ['gombas quinoa telemeas sali', 'gombas quinoa'],
  },
  {
    id: 'dish-shaorma', en: 'Healthy shaorma wrap', ro: 'shaorma sănătoasă', emoji: '🌯',
    servings: 1, parts: [['flatbread-wholemeal', 80], ['chicken-breast', 100], ['salad-raw', 100], ['yogurt-garlic-sauce', 40], ['olive-oil', 5]],
    tags: ['high-protein'], prep: 12, cook: 12,
    steps: ['Grill the sliced chicken.', 'Fill the flatbread with chicken, salad and yogurt garlic sauce.'],
    aliases: ['shaorma sanatoasa lipie int', 'shaorma sanatoasa'],
  },
  {
    id: 'dish-flatbread-pizza', en: 'Flatbread pizza', ro: 'pizza pe lipie integrală', emoji: '🍕',
    servings: 1, parts: [['flatbread-wholemeal', 80], ['tomato-sauce', 60], ['mozzarella', 50], ['vegetables-mixed', 80]],
    tags: ['vegetarian', 'quick'], prep: 8, cook: 12,
    steps: ['Spread the flatbread with tomato sauce.', 'Top with vegetables and mozzarella; bake hot until bubbling.'],
    aliases: ['pizza lipie int'],
  },
  {
    id: 'dish-eggplant-mini-pizza', en: 'Eggplant mini pizzas', ro: 'mini pizza de vinete', emoji: '🍆',
    servings: 1, parts: [['eggplant', 200], ['tomato-sauce', 60], ['mozzarella', 50], ['olive-oil', 5]],
    tags: ['vegetarian', 'low-carb'], prep: 8, cook: 20,
    steps: ['Slice and roast the eggplant rounds.', 'Top with tomato and mozzarella; grill until melted.'],
    aliases: ['mini pizza de vinete vinete', 'mini pizza de vinete cu mozzarella', 'mini pizza de vinete'],
  },
  {
    id: 'dish-eggplant-rolls', en: 'Eggplant rolls', ro: 'rulouri de vinete', emoji: '🍆',
    servings: 1, parts: [['eggplant', 200], ['cottage-cheese', 60], ['garlic', 4], ['olive-oil', 5]],
    tags: ['vegetarian', 'low-carb'], prep: 12, cook: 15,
    steps: ['Grill long slices of eggplant.', 'Spread with garlicky cheese and roll up.'],
    aliases: ['rulouri de vinete'],
  },
  {
    id: 'dish-bruschetta', en: 'Bruschetta with telemea', ro: 'bruschete cu telemea', emoji: '🍞',
    servings: 1, parts: [['bread-wholemeal', 50], ['telemea', 50], ['tomatoes', 80], ['olive-oil', 5], ['basil', 3], ['garlic', 3]],
    tags: ['vegetarian', 'quick'], prep: 8, cook: 4,
    steps: ['Toast the bread and rub with garlic.', 'Top with tomato, cheese, basil and olive oil.'],
    aliases: ['bruschete cu telemea paine int', 'bruschete cu telemea telemea', 'bruschete cu telemea',
      'bruschete paine int prajita', 'bruschete'],
  },
  {
    id: 'dish-bruschetta-mushroom', en: 'Tomato & mushroom bruschetta', ro: 'bruschete cu roșii și ciuperci', emoji: '🍞',
    servings: 1, parts: [['bread-wholemeal', 50], ['tomatoes', 70], ['mushrooms', 70], ['olive-oil', 5], ['garlic', 3]],
    tags: ['vegan', 'quick'], prep: 8, cook: 8,
    steps: ['Fry the mushrooms in olive oil.', 'Pile onto garlic-rubbed toast with fresh tomato.'],
    aliases: ['bruschete cu rosii si ciuperci paine int', 'bruschete cu rosii si ciuperci'],
  },

  // ─── Salads ────────────────────────────────────────────────────────────────
  {
    id: 'dish-tabbouleh', en: 'Tabbouleh', ro: 'salată tabbouleh', emoji: '🥗',
    servings: 1, parts: [['quinoa', 40], ['tomatoes', 100], ['cucumber', 80], ['parsley', 20], ['olive-oil', 5], ['lemon-juice', 8]],
    tags: ['salad', 'vegan'], prep: 15, cook: 15,
    steps: ['Cook and cool the quinoa.', 'Toss with finely chopped vegetables, parsley, oil and lemon.'],
    aliases: ['salata tabbouleh'],
  },
  {
    id: 'dish-tabbouleh-chickpea', en: 'Chickpea tabbouleh', ro: 'salată tabbouleh cu năut', emoji: '🥗',
    servings: 1, parts: [['quinoa', 40], ['chickpeas-cooked', 100], ['tomatoes', 80], ['cucumber', 60], ['parsley', 20], ['olive-oil', 5], ['lemon-juice', 8]],
    tags: ['salad', 'vegan', 'high-protein'], prep: 15, cook: 15,
    steps: ['Cook and cool the quinoa.', 'Toss with chickpeas, chopped vegetables, herbs, oil and lemon.'],
    aliases: ['salata tabbouleh cu naut'],
  },
  {
    id: 'dish-quinoa-salad', en: 'Quinoa & spinach salad', ro: 'salată de quinoa', emoji: '🥗',
    servings: 1, parts: [['quinoa', 40], ['spinach', 60], ['tomatoes', 80], ['olive-oil', 5], ['lemon-juice', 5]],
    tags: ['salad', 'vegan'], prep: 10, cook: 15,
    steps: ['Cook and cool the quinoa.', 'Toss with spinach, tomato, oil and lemon.'],
    aliases: ['salata de quinoa o mana de spanac', 'salata de quinoa'],
  },
  {
    id: 'dish-caesar-turkey', en: 'Turkey caesar salad', ro: 'salată cezar cu piept de curcan', emoji: '🥗',
    servings: 1, parts: [['turkey-breast', 100], ['salad-raw', 150], ['parmesan', 15], ['yogurt', 40], ['olive-oil', 5], ['mustard', 5]],
    tags: ['salad', 'high-protein'], prep: 12, cook: 12,
    steps: ['Grill and slice the turkey.', 'Whisk yogurt, mustard, oil and parmesan into a dressing; toss with leaves.'],
    aliases: ['salata cezar piept de curcan', 'salata cezar'],
  },
  {
    id: 'dish-shrimp-salad', en: 'Shrimp salad', ro: 'salată de creveți', emoji: '🦐',
    servings: 1, parts: [['shrimp', 120], ['salad-raw', 150], ['avocado', 50], ['olive-oil', 5], ['lemon-juice', 8]],
    tags: ['salad', 'pescatarian', 'high-protein'], prep: 12, cook: 6,
    steps: ['Sear the shrimp briefly.', 'Toss with leaves and avocado, dress with oil and lemon.'],
    aliases: ['1 portie de salata de creveti', 'salata de creveti'],
  },
  {
    id: 'dish-tuna-salad', en: 'Tuna salad', ro: 'salată cu ton', emoji: '🥗',
    servings: 1, parts: [['tuna-canned', 100], ['salad-raw', 180], ['olive-oil', 5], ['lemon-juice', 5]],
    tags: ['salad', 'pescatarian', 'high-protein', 'quick'], prep: 8,
    steps: ['Flake the drained tuna over the salad and dress.'],
    aliases: ['salata cu ton ton in suc propriu', 'salata cu ton'],
  },
  {
    id: 'dish-feta-salad', en: 'Feta salad', ro: 'salată cu feta', emoji: '🥗',
    servings: 1, parts: [['feta', 50], ['salad-raw', 180], ['olive-oil', 5]],
    tags: ['salad', 'vegetarian', 'quick'], prep: 8,
    steps: ['Crumble the feta over the salad and dress with olive oil.'],
    aliases: ['salata cu feta feta', 'salata cu feta'],
  },
  {
    id: 'dish-mozzarella-salad', en: 'Mozzarella salad', ro: 'salată de mozzarella', emoji: '🥗',
    servings: 1, parts: [['mozzarella', 100], ['tomatoes', 120], ['basil', 5], ['olive-oil', 5]],
    tags: ['salad', 'vegetarian', 'quick'], prep: 6,
    steps: ['Layer mozzarella and tomato, scatter basil, dress with olive oil.'],
    aliases: ['salata de mozzarella mozzarella', 'salata de mozzarella'],
  },
]

function slug(id: string, i: number): string {
  return `${id}-s${i}`
}

function toRecipe(spec: DishSpec): Recipe {
  const components: RecipeComponent[] = spec.parts.map(([foodId, grams]) => ({ kind: 'food', foodId, grams }))
  return {
    id: spec.id,
    name: { en: spec.en, ro: spec.ro, hu: spec.hu },
    emoji: spec.emoji,
    servings: spec.servings,
    prepMinutes: spec.prep ?? 5,
    cookMinutes: spec.cook ?? 0,
    components,
    steps: (spec.steps ?? []).map((instruction, i) => ({
      id: slug(spec.id, i), instruction, timerSeconds: 0,
    })),
    tags: spec.tags ?? [],
    createdAt: '2022-01-01T00:00:00.000Z',
  }
}

/** The dish library, as recipes. */
export const DISHES: Recipe[] = SPECS.map(toRecipe)

/**
 * Dishes whose stated gram weight in a plan is a portion of the dish itself
 * rather than of one of its ingredients.
 */
export const DISH_BY_WEIGHT = new Set(SPECS.filter((s) => s.byWeight).map((s) => s.id))

/** Plan term → dish id, for resolving meal lines during import. */
export const DISH_ALIASES: { alias: string; recipeId: string }[] = SPECS.flatMap((s) =>
  [...s.aliases, s.en, s.ro ?? '', s.hu ?? '']
    .filter(Boolean)
    .map((alias) => ({ alias, recipeId: s.id })),
)
