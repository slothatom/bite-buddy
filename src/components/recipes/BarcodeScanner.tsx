import { useEffect, useRef, useState } from 'react'
import { X, ScanLine, Loader2 } from 'lucide-react'
import type { BrowserMultiFormatReader as BrowserMultiFormatReaderType } from '@zxing/browser'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stopped = false
    let controls: { stop: () => void } | null = null

    const run = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser') as { BrowserMultiFormatReader: typeof BrowserMultiFormatReaderType }
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, _err, ctrl) => {
            if (stopped) { ctrl.stop(); return }
            if (result) {
              stopped = true
              ctrl.stop()
              onDetected(result.getText())
            }
          }
        )
        if (!stopped) setLoading(false)
      } catch {
        if (!stopped) setError('Camera access denied.\nGrant camera permission and try again.')
        setLoading(false)
      }
    }

    run()
    return () => {
      stopped = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-white font-semibold text-sm">Scan Barcode</p>
        <button onClick={onClose} className="text-white p-1"><X size={22} /></button>
      </div>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <ScanLine size={48} className="text-gray-600" />
          <p className="text-white/60 text-sm whitespace-pre-line">{error}</p>
          <button className="btn-secondary" onClick={onClose}>Go back</button>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 size={36} className="text-white animate-spin" />
            </div>
          )}
          {/* Scan frame */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-bite-400 rounded-tl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-bite-400 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-bite-400 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-bite-400 rounded-br" />
              {!loading && <div className="absolute left-1 right-1 h-0.5 top-1/2 bg-teal-400 opacity-75 animate-pulse" />}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3 text-center">
        <p className="text-white/40 text-xs">Point camera at barcode. Detects automatically</p>
      </div>
    </div>
  )
}
