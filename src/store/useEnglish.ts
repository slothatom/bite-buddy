import { useMemo } from 'react'
import { buildDictionary, toEnglish } from '../lib/translate'
import { useFoods } from './useFoodStore'

/**
 * The dietician's lines, in English.
 *
 * The dictionary is built from the food database, so a food renamed or given a
 * new alias changes what the archive reads as, with nobody having to remember
 * this exists. Built once per food list rather than per line: there are 481
 * lines and 451 phrases, and doing it per line was four hundred times the work
 * for the same answer.
 */
export function useDictionary(): [string, string][] {
  const foods = useFoods()
  return useMemo(() => buildDictionary(foods), [foods])
}

export function useEnglish(line: string): string {
  const dictionary = useDictionary()
  return useMemo(() => toEnglish(line, dictionary), [line, dictionary])
}
