import { useEffect, useRef, useState } from 'react'
import { Smartphone, X, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface PairSession {
  sessionId: string
  mobileUrl: string
  qrSvg: string
  expiresAt: number
}

interface PhoneHandoffProps {
  onUrlReceived: (url: string) => void
}

export function PhoneHandoff({ onUrlReceived }: PhoneHandoffProps) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<PairSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneConnected, setPhoneConnected] = useState(false)
  const sseRef = useRef<EventSource | null>(null)
  const closeSse = () => {
    sseRef.current?.close()
    sseRef.current = null
  }

  const createSession = async () => {
    closeSse()
    setLoading(true)
    setError(null)
    setPhoneConnected(false)
    try {
      const res = await fetch(`${API_BASE_URL}/pair/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: window.location.origin })
      })
      if (!res.ok) throw new Error('Failed to create pairing session')
      const data: PairSession = await res.json()
      setSession(data)

      const sse = new EventSource(`${API_BASE_URL}/pair/listen/${data.sessionId}`)
      sseRef.current = sse
      sse.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'url' && typeof msg.url === 'string') {
            setPhoneConnected(true)
            onUrlReceived(msg.url)
            toast.success('📱 Link received from phone!')
            setOpen(false)
          }
        } catch (_) { /* ignore */ }
      }
      sse.onerror = () => {
        // Browser will auto-reconnect; just surface a soft message
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start pairing')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && !session) createSession()
    if (!open) {
      closeSse()
      setSession(null)
      setError(null)
      setPhoneConnected(false)
    }
    return () => { if (!open) closeSse() }
  }, [open])

  useEffect(() => () => closeSse(), [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-xl shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 transition-all"
        aria-label="Send link from phone"
      >
        <Smartphone className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-semibold">Send from Phone</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-red-400" /> Send from Phone
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Scan this QR with your phone, then paste a video link to send it here instantly.
            </p>

            <div className="rounded-2xl bg-white p-4 flex items-center justify-center min-h-[280px]">
              {loading && <Loader2 className="w-10 h-10 animate-spin text-slate-700" />}
              {!loading && error && (
                <div className="text-center text-red-600 text-sm">{error}</div>
              )}
              {!loading && !error && session && (
                <div
                  className="w-full max-w-[256px]"
                  dangerouslySetInnerHTML={{ __html: session.qrSvg }}
                />
              )}
            </div>

            {session && !loading && (
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span className="truncate mr-2 font-mono">{session.mobileUrl}</span>
                <button
                  onClick={createSession}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-300 hover:bg-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm">
              {phoneConnected ? (
                <span className="flex items-center gap-1.5 text-green-400">
                  <CheckCircle2 className="w-4 h-4" /> Link received
                </span>
              ) : (
                <span className="text-gray-500">Waiting for phone…</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
