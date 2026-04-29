import React, { useState, useEffect } from 'react'
import { FileVideo, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export default function Converter({ token }: { token: string | null }) {
  const [files, setFiles] = useState<string[]>([])
  const [sourceFile, setSourceFile] = useState('')
  const [profile, setProfile] = useState('Mobile High')
  
  const [isCustom, setIsCustom] = useState(false)
  const [options, setOptions] = useState({
    format: 'MP4',
    vcodec: 'libx264',
    acodec: 'aac',
    bitrate: '2500k',
    fps: '30',
    resolution: '-2:720',
    trimStart: '',
    trimEnd: ''
  })
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<any>(null)

  const authorizedFetch = async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }

  const fetchFiles = async () => {
    try {
      const res = await authorizedFetch(`${API_BASE_URL}/convert/files`)
      const data = await res.json()
      if (res.ok) {
        setFiles(data.files || [])
      }
    } catch (err) {
      console.error('Failed to fetch files', err)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [token])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (activeJobId && (!jobStatus || jobStatus.status === 'Processing')) {
      interval = setInterval(async () => {
        try {
          const res = await authorizedFetch(`${API_BASE_URL}/convert/status/${activeJobId}`)
          if (res.ok) {
            const data = await res.json()
            setJobStatus(data)
            if (data.status === 'Completed' || data.status === 'Failed') {
              clearInterval(interval)
              if (data.status === 'Completed') {
                toast.success('Conversion completed!')
                fetchFiles()
              } else {
                toast.error(`Conversion failed: ${data.error}`)
              }
            }
          }
        } catch (e) {}
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeJobId, jobStatus, token])

  const handleConvert = async () => {
    if (!sourceFile) {
      toast.error('Please select a source file')
      return
    }
    try {
      setJobStatus({ status: 'Pending', progress: 0 })
      const payload = isCustom ? { sourceFile, options: { ...options, custom: true } } : { sourceFile, profile }
      
      const res = await authorizedFetch(`${API_BASE_URL}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Conversion failed to start')
      
      setActiveJobId(data.jobId)
      toast.success('Conversion job started')
    } catch (err: any) {
      toast.error(err.message || 'Error starting conversion')
      setJobStatus(null)
    }
  }

  return (
    <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl mb-6">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2"><FileVideo className="w-5 h-5 text-orange-400" /> Video Converter</h2>
            <p className="text-sm text-gray-400">Convert downloaded videos to other formats using preset profiles or custom FFmpeg options.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Source File</label>
            <div className="flex gap-2">
              <select 
                value={sourceFile} 
                onChange={e => setSourceFile(e.target.value)}
                className="h-10 flex-1 rounded-md border border-white/10 bg-white/5 px-3 text-white"
              >
                <option value="" className="bg-slate-900">Select a file...</option>
                {files.map(f => (
                  <option key={f} value={f} className="bg-slate-900">{f}</option>
                ))}
              </select>
              <Button variant="outline" onClick={fetchFiles} className="border-white/10 bg-white/5 text-white">Refresh</Button>
            </div>
          </div>

          <div className="flex gap-4 border-b border-white/10 pb-4">
            <button 
              type="button" 
              onClick={() => setIsCustom(false)} 
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${!isCustom ? 'bg-red-500/20 text-red-300 border border-red-400/30' : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'}`}
            >
              Preset Profiles
            </button>
            <button 
              type="button" 
              onClick={() => setIsCustom(true)} 
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${isCustom ? 'bg-red-500/20 text-red-300 border border-red-400/30' : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'}`}
            >
              Custom Settings
            </button>
          </div>

          {!isCustom ? (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {[
                'Mobile Low', 'Mobile Medium', 'Mobile High', 
                'Console PlayStation', 'Console Xbox', 
                'Web HLS', 'Web DASH', 'Web Optimized MP4'
              ].map(p => (
                <button
                  key={p}
                  onClick={() => setProfile(p)}
                  className={`p-3 rounded-lg text-left border transition-colors ${profile === p ? 'bg-red-500/10 border-red-400/40 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                >
                  <div className="font-medium text-sm">{p}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Output Format</label>
                <select value={options.format} onChange={e => setOptions({...options, format: e.target.value})} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  {['MP4', 'MKV', 'AVI', 'WEBM', 'MOV', '3GP'].map(f => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Video Codec</label>
                <select value={options.vcodec} onChange={e => setOptions({...options, vcodec: e.target.value})} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  {['libx264', 'libx265', 'libvpx', 'libvpx-vp9', 'mpeg4'].map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Audio Codec</label>
                <select value={options.acodec} onChange={e => setOptions({...options, acodec: e.target.value})} className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white">
                  {['aac', 'mp3', 'libopus', 'flac'].map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Resolution (e.g. -2:720)</label>
                <Input value={options.resolution} onChange={e => setOptions({...options, resolution: e.target.value})} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Bitrate (e.g. 2500k)</label>
                <Input value={options.bitrate} onChange={e => setOptions({...options, bitrate: e.target.value})} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">FPS</label>
                <Input value={options.fps} onChange={e => setOptions({...options, fps: e.target.value})} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Trim Start (HH:MM:SS)</label>
                <Input value={options.trimStart} onChange={e => setOptions({...options, trimStart: e.target.value})} placeholder="00:00:00" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Trim End (HH:MM:SS)</label>
                <Input value={options.trimEnd} onChange={e => setOptions({...options, trimEnd: e.target.value})} placeholder="00:01:00" className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/10">
            <Button 
              onClick={handleConvert} 
              disabled={!sourceFile || (jobStatus && jobStatus.status === 'Processing')}
              className="bg-red-500 hover:bg-red-600 text-white w-full sm:w-auto"
            >
              <Play className="w-4 h-4 mr-2" /> Start Conversion
            </Button>
          </div>

          {jobStatus && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {jobStatus.status === 'Processing' && <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />}
                  {jobStatus.status === 'Completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {jobStatus.status === 'Failed' && <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="font-medium text-white">{jobStatus.status}</span>
                </div>
                {jobStatus.status === 'Processing' && (
                  <span className="text-sm font-medium text-orange-400">{jobStatus.progress}%</span>
                )}
              </div>
              
              {jobStatus.status === 'Processing' && (
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${jobStatus.progress}%` }} />
                </div>
              )}

              {jobStatus.resultUrl && (
                <div className="pt-2">
                  <a href={jobStatus.resultUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 w-full sm:w-auto">
                      Download Result
                    </Button>
                  </a>
                </div>
              )}
              {jobStatus.error && (
                <p className="text-sm text-red-400 bg-red-400/10 p-2 rounded">{jobStatus.error}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
