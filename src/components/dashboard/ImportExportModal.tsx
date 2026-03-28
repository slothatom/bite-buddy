import { useState, useRef } from 'react'
import { X, Upload, Download, Copy, Check, AlertCircle } from 'lucide-react'
import { useMealPlanStore, type MealPlanExport } from '../../store/useMealPlanStore'
import { useRecipeStore } from '../../store/useRecipeStore'

interface Props {
  onClose: () => void
}

type Tab = 'export' | 'import'

export default function ImportExportModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('export')
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { plan, weekDates, importWeek } = useMealPlanStore()
  const { recipes } = useRecipeStore()

  // Build export payload — only include recipes referenced by the current week
  const referencedRecipeIds = new Set(
    plan.flatMap((d) => d.meals.map((m) => m.recipeId))
  )
  const exportPayload: MealPlanExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    weekStart: weekDates[0],
    plan,
    recipes: recipes.filter((r) => referencedRecipeIds.has(r.id)),
  }
  const exportJson = JSON.stringify(exportPayload, null, 2)

  function handleCopy() {
    navigator.clipboard.writeText(exportJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const blob = new Blob([exportJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meal-plan-${weekDates[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImportText(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  function handleImport() {
    setError(null)
    setSuccess(false)
    try {
      const data = JSON.parse(importText) as MealPlanExport
      if (data.version !== 1 || !Array.isArray(data.plan) || !Array.isArray(data.recipes)) {
        setError('Invalid format. Make sure you\'re pasting a Bite Buddy export.')
        return
      }
      importWeek(data)
      setSuccess(true)
      setTimeout(onClose, 1200)
    } catch {
      setError('Could not parse JSON. Check for syntax errors and try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Import / Export Plan</h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['export', 'import'] as Tab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(null); setSuccess(false) }}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors
                ${tab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'export' ? 'Export' : 'Import'}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3">
          {tab === 'export' ? (
            <>
              <p className="text-xs text-gray-500">
                Export your current week's plan as JSON. Share it or re-import it later.
              </p>
              {referencedRecipeIds.size === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  No meals planned this week. Add some meals first.
                </div>
              ) : (
                <>
                  <pre className="bg-gray-50 rounded-xl p-3 text-[10px] text-gray-600 overflow-auto max-h-52 font-mono leading-relaxed border border-gray-100">
                    {exportJson}
                  </pre>
                  <div className="flex gap-2">
                    <button onClick={handleCopy}
                      className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs">
                      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy JSON'}
                    </button>
                    <button onClick={handleDownload}
                      className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs">
                      <Download size={14} />
                      Download .json
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Paste a Bite Buddy plan export below, or load a .json file. Any new recipes will be added automatically.
              </p>

              {/* File picker */}
              <button onClick={() => fileInputRef.current?.click()}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-xs">
                <Upload size={14} />
                Load from file
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json"
                className="hidden" onChange={handleFileChange} />

              <div className="relative">
                <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-400">or paste JSON</span>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setError(null) }}
                  placeholder='{"version":1,"weekStart":"2026-03-23",...}'
                  className="w-full h-36 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">
                  <Check size={14} />
                  Plan imported!
                </div>
              )}

              <button onClick={handleImport} disabled={!importText.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-40">
                <Upload size={15} />
                Import Plan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
