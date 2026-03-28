import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { searchFoods } from '../../services/nutritionApi'
import type { NutritionResult } from '../../services/nutritionApi'

interface Props {
  value: string
  onChange: (name: string, per100g?: NutritionResult['per100g'], micros?: NutritionResult['micros']) => void
  placeholder?: string
}

export default function IngredientSearch({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NutritionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchFoods(query)
        setResults(res)
        if (res.length > 0) setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 450)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleSelect(r: NutritionResult) {
    setQuery(r.name)
    setResults([])
    setOpen(false)
    onChange(r.name, r.per100g, r.micros)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        {loading
          ? <Loader2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          : <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        }
        <input
          className="input text-xs pl-7"
          placeholder={placeholder ?? 'Search ingredient…'}
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value) }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 card shadow-xl max-h-56 overflow-y-auto border border-gray-200">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(r)}
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-gray-900 truncate flex-1">{r.name}</p>
                <span className={r.source === 'usda' ? 'badge-green shrink-0 text-[10px]' : 'badge-purple shrink-0 text-[10px]'}>
                  {r.source === 'usda' ? 'USDA' : 'OFF'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                {r.per100g.calories}kcal · {r.per100g.protein}g P · {r.per100g.carbs}g C · {r.per100g.fat}g F /100g
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
