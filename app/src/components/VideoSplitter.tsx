import { useState, useEffect, useRef } from 'react'
import { 
  Scissors, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Loader2, 
  Download, 
  Zap, 
  Film, 
  FastForward, 
  Rewind,
  Layers
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00.0'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
}

function formatDurationHuman(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export default function VideoSplitter({ token }: { token: string | null }) {
  const [files, setFiles] = useState<string[]>([])
  const [sourceFile, setSourceFile] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Real-time selector range state
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [splitMode, setSplitMode] = useState<'trim' | 'equal_parts'>('trim')
  const [partDuration, setPartDuration] = useState('30')
  const [lossless, setLossless] = useState(true)
  const [outputFormat, setOutputFormat] = useState('mp4')

  const [isProcessing, setIsProcessing] = useState(false)
  const [jobStatus, setJobStatus] = useState<any>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)

  const authorizedFetch = async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }

  const fetchFiles = async () => {
    try {
      const res = await authorizedFetch(`${API_BASE_URL}/convert/files`)
      const data = await res.json()
      if (res.ok && data.files) {
        setFiles(data.files)
        if (data.files.length > 0 && !sourceFile) {
          setSourceFile(data.files[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch files for splitter', err)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [token])

  // Handle Video Metadata Loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration || 0
      setDuration(vidDur)
      setStartTime(0)
      setEndTime(vidDur)
      setCurrentTime(0)
    }
  }

  // Real-time Time Update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const seekRelative = (delta: number) => {
    if (!videoRef.current) return
    const newTime = Math.min(Math.max(0, videoRef.current.currentTime + delta), duration)
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const setStartToCurrent = () => {
    const newStart = Math.min(currentTime, endTime - 0.5)
    setStartTime(Math.max(0, newStart))
    toast.success(`Start point set to ${formatTime(currentTime)}`)
  }

  const setEndToCurrent = () => {
    const newEnd = Math.max(currentTime, startTime + 0.5)
    setEndTime(Math.min(duration, newEnd))
    toast.success(`End point set to ${formatTime(currentTime)}`)
  }

  const playSelectedSegment = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = startTime
    videoRef.current.play()
    setIsPlaying(true)

    const checkInterval = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime >= endTime) {
        videoRef.current.pause()
        setIsPlaying(false)
        clearInterval(checkInterval)
      }
    }, 100)
  }

  // Polling for split job status
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (activeJobId && (!jobStatus || jobStatus.status === 'Processing')) {
      interval = setInterval(async () => {
        try {
          const res = await authorizedFetch(`${API_BASE_URL}/video/split/status/${activeJobId}`)
          if (res.ok) {
            const data = await res.json()
            setJobStatus(data)
            if (data.status === 'Completed' || data.status === 'Failed') {
              clearInterval(interval)
              setIsProcessing(false)
              if (data.status === 'Completed') {
                toast.success('Video split completed successfully!')
                fetchFiles()
              } else {
                toast.error(`Split failed: ${data.error}`)
              }
            }
          }
        } catch (_) {}
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeJobId, jobStatus, token])

  const handleStartSplit = async () => {
    if (!sourceFile) {
      toast.error('Please select a video file')
      return
    }

    if (splitMode === 'trim' && endTime <= startTime) {
      toast.error('End time must be greater than start time')
      return
    }

    setIsProcessing(true)
    setJobStatus({ status: 'Processing', progress: 10 })

    try {
      const payload = {
        sourceFile,
        mode: splitMode,
        startTime,
        endTime,
        partDuration: parseInt(partDuration) || 30,
        lossless,
        format: outputFormat
      }

      const res = await authorizedFetch(`${API_BASE_URL}/video/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start split job')

      setActiveJobId(data.jobId)
      toast.success(splitMode === 'trim' ? 'Trimming segment in background...' : `Splitting into ${partDuration}s clips...`)
    } catch (err: any) {
      setIsProcessing(false)
      setJobStatus(null)
      toast.error(err.message || 'Error executing split')
    }
  }

  const selectedSegmentDuration = Math.max(0, endTime - startTime)
  const segmentLeftPercent = duration > 0 ? (startTime / duration) * 100 : 0
  const segmentWidthPercent = duration > 0 ? ((endTime - startTime) / duration) * 100 : 0
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl mb-6 shadow-2xl">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Scissors className="w-5 h-5 text-orange-400" /> Real-time Video Splitter & Trimmer
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Interactive frame-by-frame scrubber to trim exact clips or split videos into equal parts for Shorts/Reels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-300 font-mono text-xs">
              <Zap className="w-3 h-3 mr-1" /> Lossless FastCut Enabled
            </Badge>
          </div>
        </div>

        {/* Source File Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Select Source Video</label>
            <Button variant="ghost" size="sm" onClick={fetchFiles} className="h-7 text-xs text-gray-400 hover:text-white">
              <RotateCcw className="w-3 h-3 mr-1" /> Refresh Files
            </Button>
          </div>
          <select
            value={sourceFile}
            onChange={e => setSourceFile(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white focus:border-orange-500/50 outline-none transition"
          >
            {files.length === 0 ? (
              <option value="">No downloaded media files found. Download a video first.</option>
            ) : (
              files.map(f => (
                <option key={f} value={f} className="bg-slate-900">{f}</option>
              ))
            )}
          </select>
        </div>

        {/* Video Player & Real-time Interactive Scrubber */}
        {sourceFile && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-lg aspect-video max-h-[380px] flex items-center justify-center group">
              <video
                ref={videoRef}
                src={`${API_BASE_URL}/stream/file/${encodeURIComponent(sourceFile)}`}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
                preload="metadata"
                playsInline
              />

              {/* Overlay Play/Pause Button */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-orange-600/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-transform group-hover:scale-110 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              {/* Real-time Time Overlay */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs font-mono text-white flex items-center gap-2">
                <span className="text-orange-400 font-bold">{formatTime(currentTime)}</span>
                <span className="text-gray-500">/</span>
                <span className="text-gray-400">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Visual Timeline & Dual Range Scrubber */}
            <div className="space-y-2 bg-slate-950/80 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-semibold flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-orange-400" /> Interactive Timeline Selector
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-green-400 font-bold">{formatTime(startTime)}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-red-400 font-bold">{formatTime(endTime)}</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white font-sans">
                    Length: {formatDurationHuman(selectedSegmentDuration)}
                  </span>
                </div>
              </div>

              {/* Visual Track Bar */}
              <div className="relative w-full h-8 bg-slate-900 rounded-lg overflow-hidden border border-white/10 select-none cursor-pointer">
                {/* Highlighted Split Segment */}
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-orange-500/40 via-amber-500/50 to-orange-500/40 border-x-2 border-orange-400"
                  style={{
                    left: `${segmentLeftPercent}%`,
                    width: `${segmentWidthPercent}%`
                  }}
                />

                {/* Live Playhead Needle */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-glow transition-all duration-75 pointer-events-none z-10"
                  style={{ left: `${playheadPercent}%` }}
                >
                  <div className="w-2.5 h-2.5 bg-white rounded-full -ml-[3px] -top-1 absolute shadow" />
                </div>
              </div>

              {/* Dual Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="text-green-400 font-semibold">Start Point (`[`):</span>
                    <span className="font-mono">{formatTime(startTime)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={startTime}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      setStartTime(Math.min(val, endTime - 0.5))
                      if (videoRef.current) videoRef.current.currentTime = val
                    }}
                    className="w-full accent-green-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="text-red-400 font-semibold">End Point (`]`):</span>
                    <span className="font-mono">{formatTime(endTime)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={endTime}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      setEndTime(Math.max(val, startTime + 0.5))
                      if (videoRef.current) videoRef.current.currentTime = val
                    }}
                    className="w-full accent-red-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Frame Navigation & Precision Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => seekRelative(-5)} className="h-8 px-2 border-white/10 text-xs text-gray-300">
                    <Rewind className="w-3.5 h-3.5 mr-1" /> -5s
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seekRelative(-1)} className="h-8 px-2 border-white/10 text-xs text-gray-300">
                    -1s
                  </Button>
                  <Button variant="outline" size="sm" onClick={togglePlay} className="h-8 px-3 border-orange-500/30 bg-orange-500/10 text-xs text-orange-300 font-semibold">
                    {isPlaying ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seekRelative(1)} className="h-8 px-2 border-white/10 text-xs text-gray-300">
                    +1s
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seekRelative(5)} className="h-8 px-2 border-white/10 text-xs text-gray-300">
                    +5s <FastForward className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={setStartToCurrent}
                    className="h-8 bg-green-600/20 text-green-300 border border-green-500/40 hover:bg-green-600/30 text-xs font-semibold"
                  >
                    📍 Set Start (Current Frame)
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={setEndToCurrent}
                    className="h-8 bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/30 text-xs font-semibold"
                  >
                    🎯 Set End (Current Frame)
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm" 
                    onClick={playSelectedSegment}
                    className="h-8 border-white/10 text-xs text-white"
                  >
                    <Play className="w-3 h-3 mr-1 text-orange-400" /> Preview Cut
                  </Button>
                </div>
              </div>
            </div>

            {/* Split Mode Options & Trimmer Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">Split Operation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSplitMode('trim')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition text-left ${splitMode === 'trim' ? 'border-orange-500 bg-orange-500/15 text-white' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    <Scissors className="w-5 h-5 mb-1 text-orange-400" />
                    <span className="font-semibold text-xs">Extract Segment</span>
                    <span className="text-[10px] text-gray-400 text-center">Trim exact [start → end]</span>
                  </button>

                  <button
                    onClick={() => setSplitMode('equal_parts')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition text-left ${splitMode === 'equal_parts' ? 'border-orange-500 bg-orange-500/15 text-white' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    <Layers className="w-5 h-5 mb-1 text-blue-400" />
                    <span className="font-semibold text-xs">Equal Parts Split</span>
                    <span className="text-[10px] text-gray-400 text-center">Reels / Shorts / WhatsApp</span>
                  </button>
                </div>

                {splitMode === 'equal_parts' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">Clip Duration per Segment:</label>
                    <div className="flex gap-2">
                      {['15', '30', '60', '120'].map(sec => (
                        <button
                          key={sec}
                          onClick={() => setPartDuration(sec)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-semibold transition ${partDuration === sec ? 'border-blue-400 bg-blue-500/20 text-blue-300' : 'border-white/10 bg-white/5 text-gray-400'}`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Output & Optimization Settings */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">Output Configuration</label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">Output Container</label>
                    <select
                      value={outputFormat}
                      onChange={e => setOutputFormat(e.target.value)}
                      className="h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-white outline-none"
                    >
                      <option value="mp4">MP4 (Universal)</option>
                      <option value="mkv">MKV (Multi-track)</option>
                      <option value="mp3">MP3 (Audio Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">Processing Speed</label>
                    <button
                      onClick={() => setLossless(!lossless)}
                      className={`h-9 w-full px-2 rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold transition ${lossless ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {lossless ? 'Lossless StreamCopy' : 'Frame-Accurate Encode'}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
                  {lossless 
                    ? '⚡ StreamCopy extracts your selected segment in sub-second time without re-encoding or quality degradation.'
                    : '🎨 Frame-accurate encoding re-renders keyframes for ultra-precise cuts down to the millisecond.'}
                </div>
              </div>
            </div>

            {/* Split Action Button */}
            <Button
              onClick={handleStartSplit}
              disabled={isProcessing}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Scissors className="w-5 h-5" />
              )}
              {isProcessing 
                ? 'Processing Video Split...' 
                : splitMode === 'trim' 
                  ? `Extract & Download Cut Segment (${formatDurationHuman(selectedSegmentDuration)})`
                  : `Split into ${partDuration}s Clips`}
            </Button>

            {/* Job Status / Download Result */}
            {jobStatus && (
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {jobStatus.status === 'Completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : jobStatus.status === 'Failed' ? (
                      <span className="text-red-400 text-sm">Failed</span>
                    ) : (
                      <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                    )}
                    <span className="font-semibold text-sm text-white">
                      {jobStatus.status === 'Completed' ? 'Split Finished!' : jobStatus.status === 'Failed' ? 'Processing Error' : 'Splitting Video...'}
                    </span>
                  </div>
                  {jobStatus.downloadUrl && (
                    <a
                      href={jobStatus.downloadUrl}
                      download
                      className="px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Split File
                    </a>
                  )}
                </div>

                {/* List of Equal Parts if generated */}
                {jobStatus.parts && jobStatus.parts.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <p className="text-xs font-semibold text-gray-400">Generated Clips ({jobStatus.parts.length} parts):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {jobStatus.parts.map((p: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs">
                          <span className="truncate font-mono text-gray-300 mr-2">{p.name}</span>
                          <a
                            href={p.url}
                            download
                            className="shrink-0 p-1.5 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
