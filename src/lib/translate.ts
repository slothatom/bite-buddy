import type { Food } from '../types'

/**
 * Reading the dietician's own words in English.
 *
 * Fourteen weeks of plans, 481 lines, written in Romanian and Hungarian. The
 * app has always shown them verbatim, which is right: they are the record, and
 * a plan you cannot check against what was actually prescribed is a plan you
 * have to take on faith. But verbatim and only verbatim means that for one of
 * the two people here, the whole archive is unreadable.
 *
 * So this renders a line into English and the original stays underneath.
 *
 * Composed rather than listed. A table of 291 translated lines would be a
 * second copy of the data, correct on the day it was written and wrong the
 * first time anybody edits a plan. Instead the vocabulary is translated and the
 * line is rebuilt from it, which means the food database stays the single
 * source of truth for what an ingredient is called: `paine int` is Wholemeal
 * bread here because that is what `bread-wholemeal` is called everywhere else
 * in the app.
 *
 * What it will not do is guess. A word it does not know is left exactly as the
 * dietician wrote it, so the gap is visible rather than papered over with
 * something plausible. `coverage()` measures how much of the archive that
 * amounts to, and the data check keeps it honest.
 */

/**
 * The vocabulary that is not a food: quantities, preparations and the little
 * words that hold a line together.
 *
 * Ordered longest first at match time, so "salata de cruditati" is a raw
 * vegetable salad rather than a salad, of, raw things.
 */
const PHRASES: Record<string, string> = {
  // ─── Quantities and vague portions ────────────────────────────────────────
  'jumatate de farfurie de legume': 'half a plate of vegetables',
  'fel tanyer zoldseg': 'half a plate of vegetables',
  'o lingurita de ulei de masline': 'a teaspoon of olive oil',
  'o lingurita de ulei': 'a teaspoon of oil',
  'intr-o lingurita de ulei de masline': 'in a teaspoon of olive oil',
  'o lingurita': 'a teaspoon',
  'o lg rasa de faina': 'a level tablespoon of flour',
  'o lg de iaurt': 'a tablespoon of yogurt',
  'o lg de ulei': 'a tablespoon of oil',
  'o lg': 'a tablespoon',
  'lingurita': 'teaspoon',
  'lingura': 'tablespoon',
  'o mana de': 'a handful of',
  'o mana': 'a handful',
  'jumatate de': 'half a',
  'jumatate din reteta de': 'half the recipe for',
  'jumatate din reteta': 'half the recipe',
  'din reteta': 'of the recipe',
  'o portie de': 'one portion of',
  'o portie': 'one portion',
  'portie': 'portion',
  'portii': 'portions',
  'pt 2 portii': 'for 2 portions',
  'o felie de': 'a slice of',
  'o felie': 'a slice',
  'felie': 'slice',
  'buc.': 'pieces',
  'buc': 'pieces',
  '1 tk. olivaolajjal': 'with a teaspoon of olive oil',
  '1 tk. olivaolaj': 'a teaspoon of olive oil',
  'tk. olivaolajjal': 'teaspoon of olive oil',
  'tk. olivaolaj': 'teaspoon of olive oil',
  '1 ek. olivaolaj': 'a tablespoon of olive oil',
  'ek. olivaolaj': 'tablespoon of olive oil',
  '1 ek. joghurt': 'a tablespoon of yogurt',
  'ek. joghurt': 'tablespoon of yogurt',
  'ek. chiamag': 'tablespoons of chia seeds',
  'ek. zabpehely': 'tablespoons of oats',
  'adag': 'portion',
  'ket adag': 'two portions',
  'ket': 'two',
  'lg de iaurt': 'tablespoons of yogurt',
  'lg de ulei': 'tablespoons of oil',
  ' lg ': ' tablespoons ',
  'fel mango': 'half a mango',
  'fel tanyer': 'half a plate',
  ' fel ': ' half a ',
  ' o ': ' a ',
  '2 adag': '2 portions',

  // ─── Weighed uncooked, which is how the plans are written ─────────────────
  // Ordered the way English orders it. Left to the general rules these came
  // out as "bulgur uncooked", which is understandable and reads like a machine.
  'bulgur nefiert': 'uncooked bulgur',
  'nyers bulgur': 'uncooked bulgur',
  'linte nefiarta': 'uncooked lentils',
  'linte uscata': 'dry lentils',
  'nyers lencse': 'uncooked lentils',
  'quinoa nefiarta': 'uncooked quinoa',
  'nyers quinoa': 'uncooked quinoa',
  'orez brun nefiert': 'uncooked brown rice',
  'cartofi dulci cruzi': 'raw sweet potatoes',
  'cartofi dulci nefierti': 'raw sweet potatoes',
  'cartofi dulci cantariti cruzi': 'sweet potatoes weighed raw',
  'cartofi fierti': 'boiled potatoes',
  'pastrav cantarit crud': 'trout weighed raw',
  'piept de pui crud': 'raw chicken breast',
  'nyers csirkemell': 'raw chicken breast',
  'fott voros paszuly': 'cooked kidney beans',
  'naut fiert': 'cooked chickpeas',
  'fasole rosie fiarta': 'cooked kidney beans',
  'porumb fiert': 'cooked sweetcorn',
  'ou fiert': 'boiled egg',
  'teljes kiorlesu laska nyersen': 'uncooked wholemeal pasta',
  'ardei copti': 'roasted peppers',
  'mar razuit': 'grated apple',
  'reszelt alma': 'grated apple',

  // ─── Preparation ──────────────────────────────────────────────────────────
  'cantarit crud': 'weighed raw',
  'cantariti cruzi': 'weighed raw',
  'nefiarta': 'uncooked',
  'nefiert': 'uncooked',
  'nefierti': 'uncooked',
  'fiarta': 'cooked',
  'fiert': 'cooked',
  'fierti': 'cooked',
  'fiert la abur': 'steamed',
  'la gratar': 'grilled',
  'la grill': 'grilled',
  'la cuptor': 'baked',
  'lerben': 'baked',
  'parolva': 'steamed',
  'calita': 'braised',
  'calite': 'sautéed',
  'prajita': 'toasted',
  'razuit': 'grated',
  'razuita': 'grated',
  'afumat': 'smoked',
  'in suc propriu': 'in its own juice',
  'in apa': 'in water',
  'semi fiert': 'soft boiled',
  'posate': 'poached',
  'nyers': 'raw',
  'nyersen': 'raw',
  'fott': 'cooked',
  'reszelt': 'grated',
  'grill': 'grilled',
  'sub capac': 'braised',
  'crud': 'raw',
  'cruzi': 'raw',
  'copti': 'roasted',
  'copt': 'roasted',

  // ─── Dishes and compounds ─────────────────────────────────────────────────
  'salata de cruditati': 'raw vegetable salad',
  'vegyes salata': 'mixed salad',
  'salata de morcovi': 'carrot salad',
  'salata de varza': 'cabbage salad',
  'salata de vinete': 'aubergine spread',
  'salata de fasole rosie': 'kidney bean salad',
  'salata de mozzarella': 'mozzarella salad',
  'salata de quinoa': 'quinoa salad',
  'salata cu ton': 'tuna salad',
  'salata cu feta': 'feta salad',
  'salata cu mozzarella': 'mozzarella salad',
  'salata cezar': 'Caesar salad',
  'salata tabbouleh': 'tabbouleh salad',
  'salata de creveti': 'prawn salad',
  'ceklasalata': 'beetroot salad',
  'zoldsegkoret': 'vegetable side',
  'pasta de branza': 'cheese spread',
  'pasta de ton': 'tuna spread',
  'pasta de ou': 'egg spread',
  'pasta de avocado': 'avocado spread',
  'pasta de vinete': 'aubergine spread',
  'pasta de linte': 'lentil pâté',
  'pate de linte': 'lentil pâté',
  'tonhalkrem': 'tuna spread',
  'tojaskrem': 'egg spread',
  'vinetta': 'aubergine spread',
  'budinca de chia': 'chia pudding',
  'chiamagos puding': 'chia pudding',
  'terci de ovaz': 'porridge',
  'zabkasa': 'porridge',
  'ciorba de legume': 'vegetable sour soup',
  'ciorba de varza': 'cabbage sour soup',
  'ciorba varza': 'cabbage sour soup',
  'ciorba a la grec': 'Greek style sour soup',
  'gorog csorba': 'Greek style sour soup',
  'marhahusos csorba': 'beef sour soup',
  'supa de fasole verde': 'green bean soup',
  'supa fasole verde': 'green bean soup',
  'ciorba de fasole verde': 'green bean sour soup',
  'supa de varza': 'cabbage soup',
  'supa crema de spanac': 'cream of spinach soup',
  'supa crema de legume': 'cream of vegetable soup',
  'supa crema de ciuperci': 'cream of mushroom soup',
  'supa crema de conopida': 'cream of cauliflower soup',
  'supa crema de rosii': 'cream of tomato soup',
  'supa crema de sparanghel': 'cream of asparagus soup',
  'gombakremleves': 'cream of mushroom soup',
  'karalabeleves': 'kohlrabi soup',
  'mancare de dovlecel': 'courgette stew',
  'mancare de spanac': 'creamed spinach',
  'mancare de linte': 'lentil stew',
  'lencsefozelek': 'lentil stew',
  'tocanita de porc': 'pork stew',
  'szaftos marhahus': 'braised beef',
  'muschiulet de vita': 'beef tenderloin',
  'chiftelute de dovlecel': 'courgette fritters',
  'chiftele de broccoli': 'broccoli fritters',
  'rulouri de vinete': 'aubergine rolls',
  'mini pizza de vinete': 'aubergine mini pizza',
  'piure de pastarnac': 'parsnip purée',
  'piure de telina': 'celeriac purée',
  'piure de conopida': 'cauliflower purée',
  'zellerpure': 'celeriac purée',
  'sos de usturoi': 'garlic sauce',
  'sos de usrutoi': 'garlic sauce',
  'sos de baza de iaurt si usturoi': 'yogurt and garlic sauce',
  'sos de usturoi pe baza de iaurt': 'yogurt based garlic sauce',
  'joghurtos fokhagyma szosz': 'yogurt garlic sauce',
  'sos de rosii': 'tomato sauce',
  'sos de salsa': 'salsa',
  'omleta cu spanac': 'spinach omelette',
  'omleta cu ciuperci': 'mushroom omelette',
  'spenotos rantotta': 'spinach scramble',
  'tojasos muffin': 'egg muffin',
  'cartofi cu ou': 'potatoes with egg',
  'chec cu branza si afine': 'cheese and blueberry loaf',
  'prajitura cu cocos si zmeura': 'coconut and raspberry cake',
  'banana bread cu ciocolata': 'chocolate banana bread',
  'shaorma sanatoasa': 'a lighter shawarma',
  'tigaie picanta': 'spicy pan',
  'pestos laska': 'pesto pasta',
  'gombas quinoa': 'mushroom quinoa',
  'bruschete cu telemea': 'telemea bruschetta',
  'bruschete cu rosii si ciuperci': 'tomato and mushroom bruschetta',
  'bruschete': 'bruschetta',
  'shakshuka cu naut': 'shakshuka with chickpeas',
  'legume la cuptor': 'roasted vegetables',
  'legume la gratar': 'grilled vegetables',
  'legume wok': 'wok vegetables',
  'guacamole din': 'guacamole from',
  'iaurt de baut': 'drinking yogurt',
  'branza de vaci': 'curd cheese',
  'branza de capra': 'goat cheese',
  'branza cremoasa': 'cream cheese',
  'branza cottage': 'cottage cheese',
  'iglu de lapte': 'fresh cheese',
  'ciocolata neagra': 'dark chocolate',
  'esenta de vanilie': 'vanilla essence',
  'vanilia eszenc': 'vanilla essence',
  'zeama de lamaie': 'lemon juice',
  'faina de malai': 'cornmeal',
  'fructe de padure': 'berries',
  'erdei gyumolcs': 'berries',
  'castraveti murati': 'pickled cucumbers',
  'savanyu uborka': 'pickled cucumber',
  'savanyusag': 'pickles',
  'muraturi': 'pickles',
  'feher husu hal': 'white fish',
  'piept de pui': 'chicken breast',
  'piept de curcan': 'turkey breast',
  'carne de curcan': 'turkey',
  'carne de vita': 'beef',
  'csirkemell': 'chicken breast',
  'marhahus': 'beef',

  // ─── Connectives and leftovers ────────────────────────────────────────────
  'impreuna cu': 'with',
  'valamint': 'and',
  'din': 'from',
  ' cu ': ' with ',
  ' si ': ' and ',
  ' es ': ' and ',
  ' meg ': ' and ',
  ' de ': ' of ',
  ' la ': ' ',
  ' in ': ' in ',
  'sare': 'salt',
  'piper': 'pepper',
  'mustar': 'mustard',
  'ceapa': 'onion',
  'usturoi': 'garlic',
  'busuioc': 'basil',
  'marar': 'dill',
  'chimen': 'caraway',
  'scortisoara': 'cinnamon',
  'fahej': 'cinnamon',
  'rosii': 'tomatoes',
  'paradicsom': 'tomatoes',
  'legume': 'vegetables',
  'zoldsegek': 'vegetables',
  'zoldseg': 'vegetables',
  'ciuperci': 'mushrooms',
  'gomba': 'mushrooms',
  'spanac': 'spinach',
  'spenot': 'spinach',
  'vinete': 'aubergine',
  'ardei': 'peppers',
  'oua': 'eggs',
  'ou': 'egg',
  'tojas': 'eggs',
  'reteta': 'recipe',
  'chili con carne': 'chilli con carne',
  'carne': 'meat',
  'omleta': 'omelette',
  'terci': 'porridge',
  'cu o mica schimbare': 'with one small change',
  'mica schimbare': 'small change',
  'edeskrumpli': 'sweet potato',
  'cukkini': 'courgette',
  'brokkoli': 'broccoli',
  'sos': 'sauce',
  'pizza': 'pizza',
}

/** Words a line can contain that need no translation. */
const PASS_THROUGH = /^(g|ml|kg|l|%|\d+([.,]\d+)?|[(),:/+&.-]|½|1,5-3,5%)$/i

/**
 * Every phrase this can translate, longest first.
 *
 * Built once from the phrase table and the food database's own aliases, so a
 * food renamed or given a new alias is translated correctly without anybody
 * remembering this file exists.
 */
export function buildDictionary(foods: Food[]): [string, string][] {
  const entries = new Map<string, string>()

  for (const food of foods) {
    for (const alias of food.aliases) {
      const key = alias.trim().toLowerCase()
      if (key.length < 3) continue
      if (!entries.has(key)) entries.set(key, food.names.en.toLowerCase())
    }
  }
  // The curated phrases win: "salata de vinete" is an aubergine spread even
  // though "vinete" alone is an alias for the vegetable.
  for (const [from, to] of Object.entries(PHRASES)) entries.set(from.toLowerCase(), to)

  return [...entries].sort((a, b) => b[0].length - a[0].length)
}

/**
 * The line, in English, with anything unrecognised left as it was.
 *
 * Case is preserved only in the sense that the result is lower case prose with
 * the first letter raised: the originals are lower case shorthand, and trying
 * to keep their capitalisation produces sentences that look shouted.
 */
export function toEnglish(line: string, dictionary: [string, string][]): string {
  // Translations are parked behind a marker rather than written straight into
  // the text, because the output is English and English is full of words this
  // dictionary also translates. Substituting in place, "chiamagos puding"
  // became "chia pudding" and then the food alias for "chia" turned that into
  // "chia seeds pudding"; "chili con carne" became "chilli con carne" and then
  // "chilli con meat". A marker holds no letters, so nothing matches inside it.
  const parked: string[] = []
  let out = ` ${line.toLowerCase()} `

  for (const [from, to] of dictionary) {
    const pattern = new RegExp(
      `(^|[^a-zà-ÿ])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}(?=[^a-zà-ÿ]|$)`,
      'gi',
    )
    out = out.replace(pattern, (_m, before: string) => {
      parked.push(to)
      return `${before}\uE001${parked.length - 1}\uE002`
    })
  }

  const english = out.replace(/\uE001(\d+)\uE002/g, (_m, i: string) => parked[Number(i)])
  const trimmed = english.replace(/\s+/g, ' ').trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * How much of a set of lines this can actually read.
 *
 * The number that matters is not how many phrases are in the table but how
 * many words are left over, because a word left over is a word somebody
 * cannot read. Counted per word, ignoring numbers and punctuation.
 */
export function coverage(lines: string[], dictionary: [string, string][]): {
  words: number
  untranslated: string[]
} {
  const english = new Set<string>()
  for (const [, value] of dictionary) {
    for (const word of value.toLowerCase().split(/[^a-zà-ÿ]+/)) if (word) english.add(word)
  }

  const left = new Map<string, number>()
  let words = 0

  for (const line of lines) {
    for (const word of toEnglish(line, dictionary).toLowerCase().split(/[^a-zà-ÿ0-9%½]+/)) {
      if (!word || PASS_THROUGH.test(word)) continue
      words++
      if (/^[a-zà-ÿ]/.test(word) && !english.has(word)) {
        left.set(word, (left.get(word) ?? 0) + 1)
      }
    }
  }

  return {
    words,
    untranslated: [...left].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ×${n}`),
  }
}
