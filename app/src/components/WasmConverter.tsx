import { useState, useEffect, useRef } from 'react'
import { FileVideo, Play, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export default function WasmConverter({ token }: { token: string | null }) {
  const [files, setFiles] = useState<string[]>([])
  const [sourceFile, setSourceFile] = useState('')
  const [format, setFormat] = useState('mp4')
  
  const [isReady, setIsReady] = useState(false)
  const [isLoadingWasm, setIsLoadingWasm] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isConverting, setIsConverting] = useState(false)
  const [log, setLog] = useState('')

  const ffmpegRef = useRef(new FFmpeg())

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
      console.error('Failed to fetch files', err)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [token])

  const loadFFmpeg = async () => {
    setIsLoadingWasm(true)
    setLoadError(null)
    const ffmpeg = ffmpegRef.current
    
    ffmpeg.on('log', ({ message }: any) => {
      setLog(message)
    })
    ffmpeg.on('progress', ({ progress }: any) => {
      setProgress(Math.round(progress * 100))
    })

    const fetchBlobWithTimeout = async (url: string, type: string, timeoutMs = 8000): Promise<string> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        clearTimeout(timer)
        return URL.createObjectURL(new Blob([blob], { type }))
      } catch (err) {
        clearTimeout(timer)
        throw err
      }
    }

    const candidateSources = [
      `${window.location.origin}/ffmpeg`,
      '/ffmpeg',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    ]

    let loaded = false
    for (const baseURL of candidateSources) {
      try {
        console.log(`[WASM] Attempting to load FFmpeg core from: ${baseURL}`)
        const coreURL = await fetchBlobWithTimeout(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
        const wasmURL = await fetchBlobWithTimeout(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
        
        await ffmpeg.load({ coreURL, wasmURL })
        loaded = true
        setIsReady(true)
        setIsLoadingWasm(false)
        console.log(`[WASM] FFmpeg core successfully loaded from ${baseURL}`)
        break
      } catch (err: any) {
        console.warn(`[WASM] Could not load from ${baseURL}:`, err.message || err)
      }
    }

    if (!loaded) {
      setIsLoadingWasm(false)
      setLoadError('Browser WebAssembly FFmpeg core could not load. (Use Native Server Converter above for instant conversion)')
    }
  }

  useEffect(() => {
    loadFFmpeg()
  }, [])

  const handleConvert = async () => {
    if (!sourceFile) {
      toast.error('Please select a source file')
      return
    }
    if (!isReady) {
      toast.error('FFmpeg engine is not ready yet.')
      return
    }

    try {
      setIsConverting(true)
      setProgress(0)
      setLog('Downloading file from server...')
      
      const ffmpeg = ffmpegRef.current
      
      // Fetch the file from backend (simulate local file)
      const fileUrl = `${API_BASE_URL}/download/file/${sourceFile}`
      const fileData = await fetchFile(fileUrl)
      
      // Write file to FFmpeg's virtual file system
      await ffmpeg.writeFile(sourceFile, fileData)
      
      const outputFile = `converted_${sourceFile.split('.')[0]}.${format}`
      
      setLog('Starting browser conversion...')
      // Run the conversion command
      // A simple transcoding command
      await ffmpeg.exec(['-i', sourceFile, outputFile])
      
      setLog('Conversion finished! Generating download...')
      
      // Read the output file
      const data = await ffmpeg.readFile(outputFile)
      
      // Create a URL and trigger download
      const blob = new Blob([data as any], { type: `video/${format}` })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = outputFile
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      toast.success('Conversion completed successfully!')
      
      // Clean up
      await ffmpeg.deleteFile(sourceFile)
      await ffmpeg.deleteFile(outputFile)
      URL.revokeObjectURL(url)
      
    } catch (err: any) {
      toast.error(err.message || 'Error during conversion')
      setLog(`Error: ${err.message}`)
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-white/10 shadow-xl overflow-hidden mt-6">
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 p-4 border-b border-white/10">
        <h3 className="text-xl font-bold text-white flex items-center">
          <FileVideo className="w-5 h-5 mr-2 text-purple-400" />
          Browser Video Converter (WASM)
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Convert videos entirely inside your browser. This uses your device's CPU and requires zero server processing!
        </p>
      </div>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Source File</label>
              {files.length === 0 ? (
                <div className="p-3 bg-slate-950 border border-white/10 rounded-md text-sm text-gray-500 text-center">
                  No downloaded files found on server.
                </div>
              ) : (
                <select
                  value={sourceFile}
                  onChange={e => setSourceFile(e.target.value)}
                  className="w-full flex rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                >
                  <option value="" disabled>Select a file to convert...</option>
                  {files.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Output Format</label>
              <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  className="w-full flex rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                >
                  <option value="mp4">MP4 Video</option>
                  <option value="webm">WebM Video</option>
                  <option value="gif">GIF Animation</option>
                  <option value="mp3">MP3 Audio</option>
                </select>
            </div>

            <Button
              onClick={handleConvert}
              disabled={!isReady || isConverting || !sourceFile}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isConverting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isConverting ? 'Converting in Browser...' : 'Start Browser Conversion'}
            </Button>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 border border-white/5 relative overflow-hidden">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 border-b border-white/10 pb-2">Status Output</h4>
            
            {isLoadingWasm && (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-purple-400" />
                <span className="text-sm">Loading FFmpeg WebAssembly core...</span>
                <span className="text-xs text-gray-500 mt-1">Connecting to high-speed CDN mirrors</span>
              </div>
            )}

            {!isLoadingWasm && loadError && (
              <div className="flex flex-col items-center justify-center h-32 text-center p-2">
                <p className="text-xs text-amber-400 mb-2">{loadError}</p>
                <p className="text-[11px] text-gray-400 mb-3">
                  Tip: Use the <strong>Native Video Converter & Transcoder</strong> above for instant GPU & CPU transcoding without browser limits!
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={loadFFmpeg} 
                  className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                >
                  Retry Loading WASM
                </Button>
              </div>
            )}

            {!isLoadingWasm && isReady && (
              <div className="space-y-4">
                {isConverting ? (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-4">
                      <div className="bg-purple-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="text-xs font-mono text-gray-500 h-24 overflow-y-auto bg-black/50 p-2 rounded">
                      {log}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-green-500/50">
                    <CheckCircle2 className="w-8 h-8 mb-2" />
                    <span className="text-sm text-gray-400">Ready to convert in browser</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
