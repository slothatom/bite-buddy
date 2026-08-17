import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'

interface XpToastProps {
  amount: number
  label?: string
  onDone: () => void
}

export default function XpToast({ amount, label, onDone }: XpToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 300)
    }, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl
                  bg-bite-500 text-white shadow-lg shadow-xp-200 font-semibold text-sm
                  transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <Zap size={16} className="text-yellow-300" />
      <span>+{amount} XP</span>
      {label && <span className="text-bite-100 font-normal">· {label}</span>}
    </div>
  )
}
