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
import { toast } from 'sonner'

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
        throw new Error(errorData.error || 'Failed to fetch video info')
      }
      
      const data = await response.json()
      setVideoInfo(data)
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

    try {
      // Start download request
      const response = await fetch(`${API_BASE_URL}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoInfo.url,
          quality: option.quality,
          format: option.format
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Download failed')
      }

      const data = await response.json()
      
      // Simulate progress (in real implementation, use WebSocket)
      const interval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval)
            return 90
          }
          return prev + Math.random() * 10
        })
      }, 500)

      // Wait a bit then complete
      await new Promise(resolve => setTimeout(resolve, 3000))
      clearInterval(interval)
      setDownloadProgress(100)

      // Trigger file download
      if (data.downloadUrl) {
        const downloadLink = `${API_BASE_URL.replace('/api', '')}${data.downloadUrl}`
        window.open(downloadLink, '_blank')
      }

      toast.success('Download completed!')
    } catch (err: any) {
      console.error('Download error:', err)
      toast.error(err.message || 'Download failed')
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
      setSelectedOption(null)
    }
  }

  const clearUrl = () => {
    setUrl('')
    setVideoInfo(null)
    setError(null)
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
      <header className="w-full py-4 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              VideoGrab
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a>
            <a href="#platforms" className="text-sm text-gray-400 hover:text-white transition-colors">Platforms</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <Sparkles className="w-3 h-3 mr-1" />
            Free & Unlimited Downloads
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Download Videos from{' '}
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Any Platform
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Fast, free, and easy video downloader. Support for YouTube, Facebook, X, Instagram, and 1000+ sites.
          </p>

          {/* URL Input Card */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl max-w-2xl mx-auto">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    placeholder="Paste video URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20"
                  />
                  {url && (
                    <button
                      onClick={clearUrl}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
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
                <div className="mt-6 animate-slide-up">
                  <div className="flex items-center justify-center gap-2 text-sm text-green-400 mb-4">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Detected: {videoInfo.platform}</span>
                  </div>
                  
                  <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10">
                    {/* Thumbnail */}
                    <div className="relative aspect-video">
                      <img 
                        src={videoInfo.thumbnail} 
                        alt={videoInfo.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/640x360?text=No+Thumbnail'
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
                              option.format === 'MP3' ? 'bg-purple-500/20' : 'bg-red-500/20'
                            }`}>
                              {option.format === 'MP3' ? (
                                <Music className="w-5 h-5 text-purple-400" />
                              ) : (
                                <FileVideo className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-white">{option.quality}</p>
                              <p className="text-xs text-gray-500">{option.format} • {option.size}</p>
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
                            Downloading {selectedOption.quality}...
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Choose VideoGrab?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              The most reliable and feature-rich video downloader on the web
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400">Download your favorite videos in three simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="relative text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.description}</p>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-red-500/50 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30">
            <CardContent className="p-8 sm:p-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Ready to Download?
              </h2>
              <p className="text-gray-400 mb-6">
                Start downloading your favorite videos now. No registration required.
              </p>
              <Button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="h-12 px-8 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold"
              >
                <Download className="w-4 h-4 mr-2" />
                Start Downloading
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Download className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">VideoGrab</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2024 VideoGrab. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
