import { useState, useEffect, useRef } from 'react'
import { FileVideo, Play, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export default function WasmConverter({ token }: { token: string | null }) {
  const [files, setFiles] = useState<string[]>([])
  const [sourceFile, setSourceFile] = useState('')
  const [format, setFormat] = useState('mp4')
  
  const [isReady, setIsReady] = useState(false)
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

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    const ffmpeg = ffmpegRef.current
    ffmpeg.on('log', ({ message }: any) => {
      setLog(message)
    })
    ffmpeg.on('progress', ({ progress }: any) => {
      setProgress(Math.round(progress * 100))
    })
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    setIsReady(true)
  }

  useEffect(() => {
    loadFFmpeg().catch(err => {
      console.error('Failed to load ffmpeg:', err)
      toast.error('Failed to load WebAssembly FFmpeg engine.')
    })
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
            
            {!isReady ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-sm">Loading FFmpeg WebAssembly core...</span>
              </div>
            ) : (
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
                    <span className="text-sm text-gray-400">Ready to convert</span>
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
