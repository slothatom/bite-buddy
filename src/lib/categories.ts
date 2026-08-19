import type { MedCategory } from '../types'

/**
 * Display names and icons for the Mediterranean guide's food groups, in the
 * order the guide itself presents them.
 */

export const CATEGORY_ORDER: MedCategory[] = [
  'vegetables', 'legumes', 'fruits', 'grains', 'nuts-seeds', 'herbs-spices',
  'fats-vinegars', 'dairy', 'fish-seafood', 'poultry', 'eggs', 'red-meat',
  'pantry', 'spreads-sauces', 'treats', 'sweeteners', 'beverages',
]

export const CATEGORY_LABELS: Record<MedCategory, string> = {
  vegetables: 'Vegetables', legumes: 'Legumes', fruits: 'Fruits', grains: 'Whole grains',
  'nuts-seeds': 'Nuts & seeds', 'herbs-spices': 'Herbs & spices', 'fats-vinegars': 'Fats & vinegars',
  dairy: 'Dairy', 'fish-seafood': 'Fish & seafood', poultry: 'Poultry', eggs: 'Eggs',
  'red-meat': 'Red meat', pantry: 'Pantry', 'spreads-sauces': 'Spreads & sauces',
  treats: 'Treats', sweeteners: 'Sweeteners', beverages: 'Drinks',
}

export const CATEGORY_EMOJI: Record<MedCategory, string> = {
  vegetables: '🥬', legumes: '🫘', fruits: '🍑', grains: '🌾', 'nuts-seeds': '🥜',
  'herbs-spices': '🌿', 'fats-vinegars': '🫒', dairy: '🧀', 'fish-seafood': '🐟',
  poultry: '🍗', eggs: '🥚', 'red-meat': '🥩', pantry: '🥣', 'spreads-sauces': '🧴',
  treats: '🍫', sweeteners: '🍯', beverages: '💧',
}
