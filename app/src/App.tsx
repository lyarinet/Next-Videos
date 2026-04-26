import { useState, useEffect } from 'react'
import './App.css'
import { 
  Download, 
  Link2, 
  CheckCircle2, 
  Youtube, 
  Facebook, 
  Twitter, 
  Instagram, 
  Video,
  Music,
  FileVideo,
  Globe,
  Sparkles,
  Zap,
  Shield,
  Clock,
  X,
  Play,
  User,
  Eye,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from 'sonner'

const supportedSitesData = {
  "Social Media": ["YouTube", "Facebook", "Instagram", "TikTok", "X (Twitter)", "LinkedIn", "Reddit", "Pinterest", "Snapchat", "VK", "OK.ru", "Tumblr"],
  "Video Hosting": ["Vimeo", "Dailymotion", "Twitch", "Bilibili", "Rumble", "BitChute", "Odysee", "Streamable", "Brightcove", "Wistia", "Vidyard"],
  "Audio & Music": ["SoundCloud", "Spotify", "Bandcamp", "Mixcloud", "Deezer", "Tidal", "Napster", "Qobuz", "Amazon Music", "Apple Music", "YouTube Music"],
  "News & Media": ["CNN", "BBC", "NBC News", "ABC News", "FOX News", "Al Jazeera", "Reuters", "The Guardian", "The New York Times", "The Wall Street Journal"],
  "Entertainment": ["Netflix", "Hulu", "Disney+", "HBO Max", "Amazon Prime Video", "Paramount+", "Peacock", "Discovery+", "Crunchyroll", "Funimation"],
  "Tech & Gaming": ["GitHub", "GitLab", "Steam", "Epic Games", "GOG", "itch.io", "Unity", "Unreal Engine", "Roblox", "Minecraft"]
};

interface Platform {
  name: string
  icon: React.ReactNode
  color: string
  supported: boolean
}

interface DownloadOption {
  quality: string
  format: string
  size: string
}

interface VideoInfo {
  title: string
  description: string
  thumbnail: string
  duration: string
  durationSeconds: number
  channel: string
  views: string
  platform: string
  url: string
  formats: DownloadOption[]
  audioTracks?: Array<{ code: string; name: string } | string>
}

const platforms: Platform[] = [
  { name: 'YouTube', icon: <Youtube className="w-6 h-6" />, color: '#FF0000', supported: true },
  { name: 'Facebook', icon: <Facebook className="w-6 h-6" />, color: '#1877F2', supported: true },
  { name: 'X / Twitter', icon: <Twitter className="w-6 h-6" />, color: '#000000', supported: true },
  { name: 'Instagram', icon: <Instagram className="w-6 h-6" />, color: '#E4405F', supported: true },
  { name: 'TikTok', icon: <Video className="w-6 h-6" />, color: '#000000', supported: true },
  { name: 'Vimeo', icon: <Video className="w-6 h-6" />, color: '#1AB7EA', supported: true },
  { name: 'Dailymotion', icon: <Video className="w-6 h-6" />, color: '#00AAFF', supported: true },
  { name: 'More...', icon: <Globe className="w-6 h-6" />, color: '#666666', supported: true },
]

const features = [
  {
    icon: <Zap className="w-8 h-8 text-yellow-400" />,
    title: 'Lightning Fast',
    description: 'Download videos at maximum speed with our optimized servers'
  },
  {
    icon: <Shield className="w-8 h-8 text-green-400" />,
    title: '100% Safe',
    description: 'No malware, no viruses, no registration required'
  },
  {
    icon: <Sparkles className="w-8 h-8 text-purple-400" />,
    title: 'High Quality',
    description: 'Download in HD, 4K, or even 8K quality when available'
  },
  {
    icon: <Clock className="w-8 h-8 text-blue-400" />,
    title: '24/7 Available',
    description: 'Our service is always online and ready to use'
  }
]

const howItWorks = [
  {
    step: '1',
    title: 'Paste URL',
    description: 'Copy and paste the video link from any supported platform'
  },
  {
    step: '2',
    title: 'Select Format',
    description: 'Choose your preferred quality and format'
  },
  {
    step: '3',
    title: 'Download',
    description: 'Click download and save your video instantly'
  }
]

// API base URL - uses relative path for same-origin deployment
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<DownloadOption | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [siteConfig, setSiteConfig] = useState<any>(null)
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('default')

  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setSiteConfig(data);
          if (data.siteTitle) document.title = data.siteTitle;
        }
      })
      .catch(() => {})
  }, [])

  // Debounce URL input to auto-fetch info
  useEffect(() => {
    const timer = setTimeout(() => {
      if (url && isValidUrl(url)) {
        fetchVideoInfo(url)
      } else {
        setVideoInfo(null)
        setError(null)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [url])

  const isValidUrl = (inputUrl: string): boolean => {
    try {
      new URL(inputUrl)
      return true
    } catch {
      return false
    }
  }

  const fetchVideoInfo = async (videoUrl: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/video-info?url=${encodeURIComponent(videoUrl)}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to fetch video info')
      }
      
      const data = await response.json()
      setVideoInfo(data)
      setSelectedAudioTrack('default') // Reset audio track when fetching new video
      toast.success(`Found: ${data.title.substring(0, 50)}...`)
    } catch (err: any) {
      console.error('Error fetching video info:', err)
      setError(err.message || 'Failed to fetch video information')
      setVideoInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (option: DownloadOption) => {
    if (!videoInfo) return
    
    setSelectedOption(option)
    setIsDownloading(true)
    setDownloadProgress(0)

    const progressId = Date.now().toString()
    let sse: EventSource | null = null;

    try {
      // Connect to SSE for real-time progress tracking
      sse = new EventSource(`${API_BASE_URL}/progress/${progressId}`)
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.progress !== undefined) {
            setDownloadProgress(data.progress)
          }
          
          if (data.error) {
            toast.error(data.error);
            if (sse) sse.close();
            setIsDownloading(false);
          }

          if (data.downloadUrl) {
            const downloadLink = `${API_BASE_URL.replace(/\/api$/, '')}${data.downloadUrl}`
            window.open(downloadLink, '_blank')
            toast.success('Download completed!')
            if (sse) sse.close()
            setIsDownloading(false)
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      sse.onerror = () => {
        if (sse) sse.close()
      }

      // Start download request (responds immediately now)
      const response = await fetch(`${API_BASE_URL}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoInfo.url,
          quality: option.quality,
          format: option.format,
          downloadId: progressId,
          audioTrack: selectedAudioTrack
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Download failed')
      }

      // We don't need to do anything with the response data here anymore, 
      // as the SSE stream handles the completion.
    } catch (err: any) {
      console.error('Download error:', err)
      toast.error(err.message || 'Download failed')
      setIsDownloading(false)
      if (sse) sse.close()
    }
  }

  const clearUrl = () => {
    setUrl('')
    setVideoInfo(null)
    setError(null)
  }

  const getAudioTrackLabel = (trackCode: string) => {
    if (trackCode === 'default') return 'Default Audio (Best)'
    if (trackCode === 'all') return 'All Audio Tracks'

    const matchingTrack = (videoInfo?.audioTracks ?? []).find((track) => {
      const code = typeof track === 'string' ? track : track.code
      return code === trackCode
    })

    if (!matchingTrack) return trackCode.toUpperCase()
    return typeof matchingTrack === 'string' ? matchingTrack.toUpperCase() : matchingTrack.name
  }

  const getDisplayedFormat = (option: DownloadOption) => {
    if (!option.quality.startsWith('Audio') && selectedAudioTrack === 'all') return 'MKV'
    return option.format
  }

  const getAudioTrackHint = () => {
    if (selectedAudioTrack === 'all') {
      return 'Video downloads will be packaged as MKV with every detected language track. This can take longer to build.'
    }

    if (selectedAudioTrack !== 'default') {
      return `${getAudioTrackLabel(selectedAudioTrack)} will be the only audio track kept in the final download.`
    }

    return 'Default Audio uses the platform default track. Choose a language to export just that track.'
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'YouTube': return <Youtube className="w-4 h-4" style={{ color: '#FF0000' }} />
      case 'Facebook': return <Facebook className="w-4 h-4" style={{ color: '#1877F2' }} />
      case 'X / Twitter': return <Twitter className="w-4 h-4" style={{ color: '#000000' }} />
      case 'Instagram': return <Instagram className="w-4 h-4" style={{ color: '#E4405F' }} />
      default: return <Video className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full py-4 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-red-500/20">
              <Download className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
              {siteConfig?.siteTitle || 'Next-Videos'}
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors relative group">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 transition-all group-hover:w-full" />
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors relative group">
              How It Works
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 transition-all group-hover:w-full" />
            </a>
            <a href="#platforms" className="text-sm font-medium text-gray-400 hover:text-white transition-colors relative group">
              Platforms
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 transition-all group-hover:w-full" />
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/20 rounded-full blur-[120px] animate-blob" />
          <div className="absolute top-[10%] right-[-5%] w-[35%] h-[35%] bg-orange-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-purple-600/10 rounded-full blur-[120px] animate-blob animation-delay-4000" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <Sparkles className="w-3 h-3 mr-1" />
            Free & Unlimited Downloads
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold mb-8 leading-[1.1] tracking-tight">
            {siteConfig?.heroPrimaryText ? (
              siteConfig.heroPrimaryText.includes('Any Platform') ? (
                <>
                  {siteConfig.heroPrimaryText.split('Any Platform')[0]}
                  <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent drop-shadow-sm">
                    Any Platform
                  </span>
                  {siteConfig.heroPrimaryText.split('Any Platform')[1]}
                </>
              ) : (
                siteConfig.heroPrimaryText
              )
            ) : (
              <>
                Download Videos from{' '}
                <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent drop-shadow-sm">
                  Any Platform
                </span>
              </>
            )}
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto flex flex-wrap justify-center items-center gap-x-1">
            {siteConfig?.heroSecondaryText ? (
              siteConfig.heroSecondaryText
            ) : (
              "Fast, free, and easy video downloader. Support for YouTube, Facebook, X, Instagram, and"
            )}
            
            <Dialog>
              <DialogTrigger asChild>
                <span className="cursor-pointer bg-red-500/20 text-red-500 font-medium px-2 py-0.5 rounded hover:bg-red-500/30 transition-colors inline-block whitespace-nowrap">
                  1000+ sites
                </span>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-slate-950 border-white/10 text-white sm:rounded-xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">Supported Platforms</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2 space-y-8 mt-4 pb-6">
                  {Object.entries(supportedSitesData).map(([category, sites]) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        {category}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {sites.map(site => (
                          <span key={site} className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-full text-gray-300 hover:bg-white/10 transition-colors shadow-sm cursor-default">
                            {site}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="pt-6 border-t border-white/10 text-center text-sm text-gray-500">
                    And hundreds of other sites...
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </p>

          {/* URL Input Card */}
          <Card className="glass-card max-w-2xl mx-auto shadow-2xl shadow-red-500/5 ring-1 ring-white/10">
            <CardContent className="p-4 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                  <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-red-500 transition-colors" />
                  <Input
                    placeholder="Paste video URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-12 pr-12 h-14 bg-white/5 border-white/10 text-white text-lg placeholder:text-gray-500 focus:border-red-500/50 focus:ring-4 focus:ring-red-500/10 transition-all rounded-xl"
                  />
                  {url && (
                    <button
                      onClick={clearUrl}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="mt-6 flex items-center justify-center gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing video...</span>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="mt-6 flex items-center justify-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Video Preview Card */}
              {videoInfo && !isLoading && (
                <div className="mt-8 animate-slide-up">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-400 mb-6 bg-green-400/5 py-2 rounded-full border border-green-400/10 max-w-[200px] mx-auto">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Detected: {videoInfo.platform}</span>
                  </div>
                  
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900/50 border border-white/10 shadow-2xl">
                    {/* Thumbnail */}
                    <div className="relative aspect-video">
                      <img 
                        src={videoInfo.thumbnail} 
                        alt={videoInfo.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.dataset.retry) {
                            target.dataset.retry = 'true';
                            target.src = videoInfo.thumbnail;
                          } else {
                            // Fallback to inline SVG placeholder
                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect fill='%23374151' width='640' height='360'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%239CA3AF'%3ENo Thumbnail Available%3C/text%3E%3C/svg%3E";
                          }
                        }}
                      />
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer">
                          <Play className="w-8 h-8 text-white ml-1" fill="white" />
                        </div>
                      </div>
                      {/* Duration Badge */}
                      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/80 text-xs font-medium text-white">
                        {videoInfo.duration}
                      </div>
                      {/* Platform Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/80 text-xs font-medium text-white">
                        {getPlatformIcon(videoInfo.platform)}
                        <span>{videoInfo.platform}</span>
                      </div>
                    </div>
                    
                    {/* Video Info */}
                    <div className="p-4 text-left">
                      <h3 className="font-semibold text-white mb-2 line-clamp-2">{videoInfo.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          <span>{videoInfo.channel}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4" />
                          <span>{videoInfo.views}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audio Track Selector — always visible */}
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-sm text-gray-400 mb-3">Select Audio Track (Optional):</p>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      value={selectedAudioTrack}
                      onChange={(e) => setSelectedAudioTrack(e.target.value)}
                    >
                      <option value="default" className="bg-gray-900">Default Audio (Best)</option>
                      <option value="all" className="bg-gray-900">All Audio Tracks (Saves as MKV)</option>
                      {(videoInfo.audioTracks ?? []).map((track) => {
                        const code = typeof track === 'string' ? track : track.code;
                        const name = typeof track === 'string' ? track.toUpperCase() : track.name;
                        return (
                          <option key={code} value={code} className="bg-gray-900">{name}</option>
                        );
                      })}
                    </select>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-white/10 text-white border-white/10">
                        Audio: {getAudioTrackLabel(selectedAudioTrack)}
                      </Badge>
                      {selectedAudioTrack === 'all' && (
                        <Badge variant="secondary" className="bg-orange-500/15 text-orange-300 border-orange-400/20">
                          Video exports as MKV
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-gray-500">
                      {getAudioTrackHint()}
                    </p>
                  </div>

                  {/* Download Options */}
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-sm text-gray-400 mb-4">Select download format:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {videoInfo.formats.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleDownload(option)}
                          disabled={isDownloading}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              option.quality.startsWith('Audio') ? 'bg-purple-500/20' : 'bg-red-500/20'
                            }`}>
                              {option.quality.startsWith('Audio') ? (
                                <Music className="w-5 h-5 text-purple-400" />
                              ) : (
                                <FileVideo className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-white">{option.quality}</p>
                              <p className="text-xs text-gray-500">{getDisplayedFormat(option)} • {option.size}</p>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" />
                        </button>
                      ))}
                    </div>

                    {/* Download Progress */}
                    {isDownloading && selectedOption && (
                      <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">
                            {downloadProgress === 0 
                              ? `Initializing ${selectedOption.quality} (Please wait)...` 
                              : `Downloading ${selectedOption.quality}...`}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {Math.round(downloadProgress)}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-300"
                            style={{ width: `${Math.min(downloadProgress, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supported Platforms */}
          <div id="platforms" className="mt-12">
            <p className="text-sm text-gray-500 mb-6">Supported Platforms</p>
            <div className="flex flex-wrap justify-center gap-4">
              {platforms.map((platform, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                >
                  <span style={{ color: platform.color }}>{platform.icon}</span>
                  <span className="text-sm text-gray-300">{platform.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Choose Next-Videos?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Fast downloads, cleaner audio selection, and broad platform support in one streamlined tool
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="glass-card glass-card-hover group">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 animate-floating">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6">How It Works</h2>
            <p className="text-xl text-gray-400">Download your favorite videos in three simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {howItWorks.map((step, index) => (
              <div key={index} className="relative group text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center mx-auto mb-8 text-3xl font-black shadow-xl shadow-red-500/20 group-hover:scale-110 transition-transform duration-500 ring-4 ring-white/10">
                  {step.step}
                </div>
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed px-4">{step.description}</p>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[70%] w-full h-[2px] bg-gradient-to-r from-red-500/50 via-white/10 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-slate-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="relative overflow-hidden border-none bg-gradient-to-br from-red-600 to-orange-700 shadow-2xl shadow-red-900/20 rounded-[2rem]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <CardContent className="p-12 sm:p-20 relative z-10">
              <h2 className="text-3xl sm:text-5xl font-black mb-6 text-white tracking-tight">
                Ready to Experience Speed?
              </h2>
              <p className="text-white/80 text-lg sm:text-xl mb-10 max-w-xl mx-auto">
                Join thousands of users who download their favorite media safely every day. No strings attached.
              </p>
              <Button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="h-16 px-12 bg-white text-red-600 hover:bg-gray-100 font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all duration-300 group"
              >
                <Download className="w-6 h-6 mr-3 group-hover:animate-bounce" />
                Start Downloading Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/10">
                <Download className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">{siteConfig?.siteTitle || 'Next-Videos'}</span>
            </div>
            
            <p className="text-sm text-gray-500 font-medium">
              {siteConfig?.footerText || '© 2026 Next-Videos. All rights reserved.'}
            </p>
            
            <div className="flex items-center gap-6">
              <a href="#/terms" className="text-sm font-medium text-gray-500 hover:text-white transition-colors">Terms</a>
              <a href="#/privacy" className="text-sm font-medium text-gray-500 hover:text-white transition-colors">Privacy</a>
              <a href="#/contact" className="text-sm font-medium text-gray-500 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-gray-600 max-w-2xl mx-auto">
              Please respect the intellectual property rights of others. This tool is intended for personal use only.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
