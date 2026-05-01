import { useEffect, useState } from 'react'
import { Smartphone, X, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface SendToPhoneProps {
  fileUrl: string
  label?: string
  onClose?: () => void
}

export function SendToPhone({ fileUrl, label, onClose }: SendToPhoneProps) {
  const [open, setOpen] = useState(false)
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const absoluteUrl = (() => {
    try { return new URL(fileUrl, window.location.origin).toString() }
    catch { return fileUrl }
  })()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`${API_BASE_URL}/qr?data=${encodeURIComponent(absoluteUrl)}`)
      .then((r) => r.text())
      .then((svg) => setQrSvg(svg))
      .catch(() => toast.error('Failed to generate QR'))
      .finally(() => setLoading(false))
  }, [open, absoluteUrl])

  const close = () => {
    setOpen(false)
    onClose?.()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-white transition-colors"
      >
        <Smartphone className="w-4 h-4" />
        {label || 'Send to Phone'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
          <div
            className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-orange-400" /> Get this on your Phone
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Scan the QR with your phone — the file will download right to it.
            </p>

            <div className="rounded-2xl bg-white p-4 flex items-center justify-center min-h-[280px]">
              {loading && <Loader2 className="w-10 h-10 animate-spin text-slate-700" />}
              {!loading && qrSvg && (
                <div
                  className="w-full max-w-[256px]"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 truncate text-xs font-mono text-gray-400 bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                {absoluteUrl}
              </code>
              <button
                onClick={copy}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-500 text-center">
              Phone and desktop must be on the same network (or this URL must be publicly reachable).
            </p>
          </div>
        </div>
      )}
    </>
  )
}
