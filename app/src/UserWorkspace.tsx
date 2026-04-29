import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, History, Loader2, LogOut, Save, Settings2, Shield, User2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Converter from './components/Converter'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const USER_TOKEN_KEY = 'workspaceUserToken'

interface DownloadOption {
  quality: string
  format: string
  size: string
}

interface VideoInfo {
  title: string
  thumbnail: string
  duration: string
  channel: string
  views: string
  platform: string
  url: string
  formats: DownloadOption[]
  audioTracks?: Array<{ code: string; name: string } | string>
}

interface WorkspacePreset {
  presetName: string
  activeTab: string
  outputFormat: string
  sizeLimit: string
  qualityMode: string
  videoEncode: string
  videoSize: string
  bitrate: string
  crfCq: string
  audioCodec: string
  noAudio: string
  fps: string
  aspectRatio: string
  subtitleMode: string
  extraMode: string
}

interface WorkspaceUser {
  id: string
  username: string
  email: string
  createdAt: string
}

interface DownloadHistoryItem {
  id: string
  title: string
  quality: string
  format: string
  platform: string
  status: string
  fileName: string
  createdAt: string
  completedAt?: string
  error?: string
}

const defaultPreset: WorkspacePreset = {
  presetName: 'My Default Profile',
  activeTab: 'video',
  outputFormat: 'MP4',
  sizeLimit: 'Off',
  qualityMode: 'Optimal quality',
  videoEncode: 'MPEG4 (Xvid)',
  videoSize: '320x240',
  bitrate: 'Default',
  crfCq: '10 (High quality)',
  audioCodec: 'AAC',
  noAudio: 'Off',
  fps: 'Default',
  aspectRatio: 'Fully Expand',
  subtitleMode: 'Off',
  extraMode: 'Other'
}

const tabOptions = ['video', 'audio', 'subtitle', 'other', 'watermark']
const outputFormatOptions = ['3G2', '3GP', 'AVI', 'FLV', 'MKV', 'MOV', 'MP4', 'MPG', 'OGV', 'WEBM', 'WMV']

const parseVideoSizeToQuality = (videoSize: string) => {
  if (videoSize === '320x240') return '240p (320x240)'
  if (videoSize === '640x360') return '360p'
  if (videoSize === '854x480') return '480p'
  if (videoSize === '1280x720') return '720p HD'
  if (videoSize === '1920x1080') return '1080p HD'
  return ''
}

const estimateOutputSize = (preset: WorkspacePreset) => {
  const map: Record<string, string> = {
    '320x240': '3.6 MB',
    '640x360': '8 MB',
    '854x480': '16 MB',
    '1280x720': '34 MB',
    '1920x1080': '72 MB'
  }
  const base = map[preset.videoSize] || '8 MB'
  if (preset.noAudio === 'On') return `${base} (video only)`
  return base
}

const getOutputFormatLabel = (format: string) => `Convert to ${format}`

export default function UserWorkspace() {
  const [token, setToken] = useState<string | null>(localStorage.getItem(USER_TOKEN_KEY))
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' })
  const [user, setUser] = useState<WorkspaceUser | null>({ id: 'guest', username: 'Guest User', email: '', createdAt: new Date().toISOString() })
  const [preset, setPreset] = useState<WorkspacePreset>(defaultPreset)
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([])
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [selectedAudioTrack, setSelectedAudioTrack] = useState('default')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<DownloadOption | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (token) {
      fetchWorkspace(token)
    }
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [token])

  const recommendedQuality = useMemo(() => parseVideoSizeToQuality(preset.videoSize), [preset.videoSize])
  const estimatedOutputSize = useMemo(() => estimateOutputSize(preset), [preset])

  const authorizedFetch = async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }

  const fetchWorkspace = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (!res.ok) throw new Error('Session expired')
      const data = await res.json()
      setUser(data.user)
      setPreset(data.preset || defaultPreset)
      setDownloadHistory(data.downloadHistory || [])
    } catch (err: any) {
      localStorage.removeItem(USER_TOKEN_KEY)
      setToken(null)
      setUser(null)
      setDownloadHistory([])
      toast.error(err.message || 'Could not load workspace')
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAuthenticating(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const payload =
        mode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : authForm

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')

      localStorage.setItem(USER_TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      setPreset(data.preset || defaultPreset)
      setDownloadHistory(data.downloadHistory || [])
      setAuthForm({ username: '', email: '', password: '' })
      toast.success(mode === 'login' ? 'Logged in successfully' : 'Account created successfully')
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authorizedFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' })
    } catch (_) {}
    localStorage.removeItem(USER_TOKEN_KEY)
    setToken(null)
    setUser(null)
    setVideoInfo(null)
    setDownloadHistory([])
    toast.info('Logged out')
  }

  const savePreset = async () => {
    setIsSavingPreset(true)
    try {
      const res = await authorizedFetch(`${API_BASE_URL}/user/preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save preset')
      setPreset(data.preset)
      toast.success('Preset saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preset')
    } finally {
      setIsSavingPreset(false)
    }
  }

  const fetchVideoInfo = async () => {
    if (!url) return
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(`${API_BASE_URL}/video-info?url=${encodeURIComponent(url)}`, {
        signal: controller.signal
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Could not analyze video')
      setVideoInfo(data)
      setSelectedAudioTrack('default')
      toast.success(`Fetched ${data.title}`)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Video analysis timed out. Please try again.')
      } else {
        setError(err.message || 'Failed to fetch video info')
      }
      setVideoInfo(null)
    } finally {
      window.clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleDownload = async (option: DownloadOption) => {
    if (!videoInfo) return
    setSelectedOption(option)
    setIsDownloading(true)
    setDownloadProgress(0)
    const progressId = Date.now().toString()
    let sse: EventSource | null = null

    try {
      sse = new EventSource(`${API_BASE_URL}/progress/${progressId}`)
      sse.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (typeof data.progress === 'number') setDownloadProgress(data.progress)
        if (data.error) {
          toast.error(data.error)
          sse?.close()
          setIsDownloading(false)
        }
        if (data.downloadUrl) {
          const downloadLink = `${API_BASE_URL.replace(/\/api$/, '')}${data.downloadUrl}`
          window.open(downloadLink, '_blank')
          sse?.close()
          setIsDownloading(false)
          fetchWorkspace(token || '')
          toast.success('Download completed')
        }
      }

      const res = await authorizedFetch(`${API_BASE_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.url,
          quality: option.quality,
          format: option.format || 'MP4',
          downloadId: progressId,
          audioTrack: selectedAudioTrack
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Download failed')
      fetchWorkspace(token || '')
    } catch (err: any) {
      toast.error(err.message || 'Download failed')
      setIsDownloading(false)
      sse?.close()
    }
  }

  const handleQuickPresetDownload = () => {
    if (!videoInfo) return
    const preferred = videoInfo.formats.find((item) => item.quality === recommendedQuality && item.format.toUpperCase() === preset.outputFormat.toUpperCase())
      || videoInfo.formats.find((item) => item.quality === recommendedQuality)
      || videoInfo.formats.find((item) => item.format.toUpperCase() === preset.outputFormat.toUpperCase())
      || videoInfo.formats[0]
    if (preferred) handleDownload(preferred)
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
        <div className="max-w-md mx-auto">
          <Card className="bg-slate-900/70 border-white/10 backdrop-blur-xl">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{mode === 'login' ? 'User Login' : 'Create Account'}</h1>
                  <p className="text-sm text-gray-400">Save your own presets, converter settings, and download history</p>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <Button type="button" variant={mode === 'login' ? 'default' : 'outline'} className={mode === 'login' ? 'bg-red-500 hover:bg-red-600' : 'border-white/10 bg-white/5'} onClick={() => setMode('login')}>
                  Login
                </Button>
                <Button type="button" variant={mode === 'register' ? 'default' : 'outline'} className={mode === 'register' ? 'bg-red-500 hover:bg-red-600' : 'border-white/10 bg-white/5'} onClick={() => setMode('register')}>
                  Register
                </Button>
              </div>

              <form className="space-y-4" onSubmit={handleAuth}>
                {mode === 'register' && (
                  <Input
                    placeholder="Username"
                    value={authForm.username}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                )}
                <Input
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
                <Button type="submit" disabled={isAuthenticating} className="w-full bg-red-500 hover:bg-red-600 text-white">
                  {isAuthenticating ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                New users need to register first. Admin login is separate and lives at <span className="text-white">/#/admin</span>.
              </div>

              <a href="#/" className="mt-5 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Back to downloader
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
              <User2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Workspace</h1>
              <p className="text-gray-400">Logged in as {user?.username || 'Guest'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => window.location.hash = '#/'}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Downloader
            </Button>
            <Button variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2"><Settings2 className="w-5 h-5 text-orange-400" /> Custom Format Profile</h2>
                  <p className="text-sm text-gray-400">Inspired by converter-style controls: format, quality, codec, size, FPS, subtitles, and more.</p>
                </div>
                <Button onClick={savePreset} disabled={isSavingPreset} className="bg-red-500 hover:bg-red-600 text-white">
                  <Save className="w-4 h-4 mr-2" /> {isSavingPreset ? 'Saving...' : 'Save Preset'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {tabOptions.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPreset((prev) => ({ ...prev, activeTab: tab }))}
                    className={`px-3 py-2 rounded-full border text-sm capitalize ${preset.activeTab === tab ? 'bg-red-500/20 border-red-400/40 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input value={preset.presetName} onChange={(e) => setPreset((prev) => ({ ...prev, presetName: e.target.value }))} className="bg-white/5 border-white/10 text-white" placeholder="Preset name" />
                <select value={preset.outputFormat} onChange={(e) => setPreset((prev) => ({ ...prev, outputFormat: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  {outputFormatOptions.map((format) => (
                    <option key={format} value={format} className="bg-slate-900">{getOutputFormatLabel(format)}</option>
                  ))}
                </select>
                <select value={preset.sizeLimit} onChange={(e) => setPreset((prev) => ({ ...prev, sizeLimit: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Off</option>
                  <option className="bg-slate-900">25 MB</option>
                  <option className="bg-slate-900">50 MB</option>
                  <option className="bg-slate-900">100 MB</option>
                </select>
                <select value={preset.qualityMode} onChange={(e) => setPreset((prev) => ({ ...prev, qualityMode: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Worst quality</option>
                  <option className="bg-slate-900">Lower quality</option>
                  <option className="bg-slate-900">Optimal quality</option>
                  <option className="bg-slate-900">Better quality</option>
                  <option className="bg-slate-900">Best quality</option>
                </select>
                <select value={preset.videoEncode} onChange={(e) => setPreset((prev) => ({ ...prev, videoEncode: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">MPEG4 (Xvid)</option>
                  <option className="bg-slate-900">H.264</option>
                  <option className="bg-slate-900">H.265</option>
                  <option className="bg-slate-900">VP9</option>
                </select>
                <select value={preset.videoSize} onChange={(e) => setPreset((prev) => ({ ...prev, videoSize: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">320x240</option>
                  <option className="bg-slate-900">640x360</option>
                  <option className="bg-slate-900">854x480</option>
                  <option className="bg-slate-900">1280x720</option>
                  <option className="bg-slate-900">1920x1080</option>
                </select>
                <select value={preset.bitrate} onChange={(e) => setPreset((prev) => ({ ...prev, bitrate: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Default</option>
                  <option className="bg-slate-900">500 kbps</option>
                  <option className="bg-slate-900">1000 kbps</option>
                  <option className="bg-slate-900">1500 kbps</option>
                </select>
                <select value={preset.crfCq} onChange={(e) => setPreset((prev) => ({ ...prev, crfCq: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">10 (High quality)</option>
                  <option className="bg-slate-900">18</option>
                  <option className="bg-slate-900">23</option>
                  <option className="bg-slate-900">28</option>
                </select>
                <select value={preset.audioCodec} onChange={(e) => setPreset((prev) => ({ ...prev, audioCodec: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">AAC</option>
                  <option className="bg-slate-900">MP3</option>
                  <option className="bg-slate-900">OPUS</option>
                  <option className="bg-slate-900">FLAC</option>
                </select>
                <select value={preset.noAudio} onChange={(e) => setPreset((prev) => ({ ...prev, noAudio: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Off</option>
                  <option className="bg-slate-900">On</option>
                </select>
                <select value={preset.fps} onChange={(e) => setPreset((prev) => ({ ...prev, fps: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Default</option>
                  <option className="bg-slate-900">24</option>
                  <option className="bg-slate-900">30</option>
                  <option className="bg-slate-900">60</option>
                </select>
                <select value={preset.aspectRatio} onChange={(e) => setPreset((prev) => ({ ...prev, aspectRatio: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Fully Expand</option>
                  <option className="bg-slate-900">Original</option>
                  <option className="bg-slate-900">16:9</option>
                  <option className="bg-slate-900">4:3</option>
                </select>
                <select value={preset.subtitleMode} onChange={(e) => setPreset((prev) => ({ ...prev, subtitleMode: e.target.value }))} className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  <option className="bg-slate-900">Off</option>
                  <option className="bg-slate-900">Soft Subtitle</option>
                  <option className="bg-slate-900">Burned In</option>
                </select>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-gray-400 mb-2">Target output format</div>
                  <div className="text-2xl font-semibold">{preset.outputFormat}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-gray-400 mb-2">Estimated output file size</div>
                  <div className="text-2xl font-semibold">{estimatedOutputSize}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-gray-400 mb-2">Recommended download target</div>
                  <div className="text-2xl font-semibold">{recommendedQuality || 'Best available'}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-gray-400 mb-2">Audio mode</div>
                  <div className="text-2xl font-semibold">{preset.noAudio === 'On' ? 'No audio' : preset.audioCodec}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2"><Download className="w-5 h-5 text-orange-400" /> Analyze And Download</h2>
                <p className="text-sm text-gray-400">Use your preset as a quick recommendation, including preferred output format.</p>
              </div>

              <div className="flex flex-col gap-3">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste video URL" className="bg-white/5 border-white/10 text-white" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={fetchVideoInfo} className="bg-red-500 hover:bg-red-600 text-white">Fetch URL</Button>
                  {videoInfo && (
                    <Button variant="outline" className="border-white/10 bg-white/5 text-white" onClick={handleQuickPresetDownload}>
                      Quick Download ({preset.outputFormat} · {recommendedQuality || 'best'})
                    </Button>
                  )}
                </div>
              </div>

              {isLoading && <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing video...</div>}
              {error && <div className="text-sm text-red-400">{error}</div>}

              {videoInfo && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                    <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-48 object-cover" />
                    <div className="p-4 space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="secondary" className="bg-green-500/10 text-green-300 border-green-400/20"><CheckCircle2 className="w-3 h-3 mr-1" /> {videoInfo.platform}</Badge>
                        <Badge variant="secondary" className="bg-white/10 text-white border-white/10">{videoInfo.duration}</Badge>
                      </div>
                      <h3 className="font-semibold">{videoInfo.title}</h3>
                      <p className="text-sm text-gray-400">{videoInfo.channel} · {videoInfo.views}</p>
                    </div>
                  </div>

                  <select value={selectedAudioTrack} onChange={(e) => setSelectedAudioTrack(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white">
                    <option className="bg-slate-900" value="default">Default Audio</option>
                    <option className="bg-slate-900" value="all">All Audio Tracks (MKV)</option>
                    {(videoInfo.audioTracks || []).map((track) => {
                      const code = typeof track === 'string' ? track : track.code
                      const name = typeof track === 'string' ? track : track.name
                      return <option key={code} value={code} className="bg-slate-900">{name}</option>
                    })}
                  </select>

                  <div className="grid gap-2 max-h-64 overflow-y-auto pr-2">
                    {videoInfo.formats.map((option) => (
                      <button
                        key={`${option.quality}-${option.format || 'unknown'}`}
                        onClick={() => handleDownload(option)}
                        disabled={isDownloading}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${recommendedQuality === option.quality || (option.format && option.format.toUpperCase() === preset.outputFormat.toUpperCase()) ? 'border-orange-400/30 bg-orange-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                      >
                        <div>
                          <div className="font-medium">{option.quality}</div>
                          <div className="text-sm text-gray-400">{option.format || 'Unknown'} · {option.size}</div>
                        </div>
                        {(recommendedQuality === option.quality || (option.format && option.format.toUpperCase() === preset.outputFormat.toUpperCase())) && <Badge variant="secondary" className="bg-orange-500/15 text-orange-200 border-orange-400/20">Preset</Badge>}
                      </button>
                    ))}
                  </div>

                  {isDownloading && selectedOption && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Downloading {selectedOption.quality}</span>
                        <span>{Math.round(downloadProgress)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-300" style={{ width: `${Math.min(downloadProgress, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Converter token={token} />

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-semibold">My Downloads</h2>
            </div>
            <div className="grid gap-3">
              {downloadHistory.length === 0 && <p className="text-sm text-gray-400">No downloads yet.</p>}
              {downloadHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{item.title || item.fileName}</div>
                    <div className="text-sm text-gray-400">{item.platform} · {item.quality} · {item.format}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={`${item.status === 'completed' ? 'bg-green-500/10 text-green-300 border-green-400/20' : item.status === 'failed' ? 'bg-red-500/10 text-red-300 border-red-400/20' : 'bg-yellow-500/10 text-yellow-200 border-yellow-400/20'}`}>
                      {item.status}
                    </Badge>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
