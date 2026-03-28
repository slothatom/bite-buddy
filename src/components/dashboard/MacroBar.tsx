interface MacroBarProps {
  label: string
  value: number
  target: number
  color: string
  unit?: string
}

export default function MacroBar({ label, value, target, color, unit = 'g' }: MacroBarProps) {
  const pct = Math.min((value / target) * 100, 100)
  const over = value > target

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold font-mono ${over ? 'text-red-500' : 'text-gray-700'}`}>
          {Math.round(value)}<span className="text-gray-400 font-normal">/{target}{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color} ${over ? 'opacity-70' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
