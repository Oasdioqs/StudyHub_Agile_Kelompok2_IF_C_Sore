'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

type VideoItem = {
  id: string
  title: string
  sourceUrl: string
  sourceType: string
  duration: number | null
  status: string
  createdAt: string
}
type VideoDetail = VideoItem & { summary: string | null }
type InputTab = 'youtube' | 'teams' | 'text' | 'live'

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmtDuration(secs: number | null) {
  if (!secs) return null
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h > 0 ? `${h}j ${m}m ${s}d` : m > 0 ? `${m}m ${s}d` : `${s}d`
}
function fmtSecs(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function timeAgo(ds: string) {
  const diff = Math.floor((Date.now() - new Date(ds).getTime()) / 1000)
  if (diff < 60) return 'baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  return `${Math.floor(diff / 86400)} hari lalu`
}
function getYtThumbnail(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}
function sourceIcon(type: string) {
  if (type === 'youtube') return { icon: 'bi-youtube', color: '#ef4444', label: 'YouTube' }
  if (type === 'teams') return { icon: 'bi-camera-video', color: '#5059c9', label: 'Teams/Meeting' }
  if (type === 'live') return { icon: 'bi-mic-fill', color: '#10b981', label: 'Live Meeting' }
  return { icon: 'bi-file-text', color: '#6366f1', label: 'Teks' }
}
function renderMarkdown(text: string) {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _l, code) =>
      `<pre style="background:var(--sh-hover);border:1px solid var(--sh-border);border-radius:10px;padding:12px;overflow-x:auto;font-size:12.5px;margin:10px 0;"><code style="font-family:monospace;white-space:pre;">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</code></pre>`)
    .replace(/^## (.+)$/gm, '<h6 style="font-weight:700;margin:16px 0 7px;font-size:14px;">$1</h6>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•]\s(.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;"><span style="color:#6366f1;flex-shrink:0;">▸</span><span>$1</span></div>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;"><span style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">$1</span><span>$2</span></div>')
    .replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>')
}

// ── Maintenance page ──────────────────────────────────────────────────────────
function MaintenancePage() {
  return (
    <div><Sidebar /><div className="app-main"><TopbarShell />
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🚧</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 999, padding: '4px 12px', marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.05em' }}>BETA</span>
        </div>
        <h3 className="fw-bold mb-3">Fitur Sedang Dalam Pengembangan</h3>
        <p style={{ color: 'var(--sh-muted)', fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
          <strong>Video AI Summarizer</strong> saat ini masih dalam fase beta dan hanya tersedia untuk tim pengembang.
          Fitur ini akan segera diluncurkan untuk semua pengguna Premium.
        </p>
        <div className="card p-4 mb-4" style={{ borderRadius: 16, border: '1px solid var(--sh-border)', textAlign: 'left' }}>
          <div className="fw-semibold mb-3" style={{ fontSize: 14 }}>Yang akan bisa kamu lakukan:</div>
          {['🎬 Rangkum video YouTube sepanjang apapun', '🎙️ Live transcription saat meeting berlangsung', '📁 Upload transkrip Teams/SharePoint (.vtt/.srt)', '📋 Paste teks dari meeting notes apapun'].map(f => (
            <div key={f} style={{ fontSize: 13, color: 'var(--sh-muted)', marginBottom: 8 }}>{f}</div>
          ))}
        </div>
        <Link href="/upgrade" className="btn btn-primary px-5" style={{ borderRadius: 12 }}>
          <i className="bi bi-star-fill me-2" />Lihat Fitur Premium
        </Link>
        <div className="mt-3"><Link href="/dashboard" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>← Kembali ke Dashboard</Link></div>
      </main>
    </div></div>
  )
}

// ── Live Meeting Transcriber ──────────────────────────────────────────────────
type AudioMode = 'mic' | 'tab'

function LiveMeetingTab({ onTranscriptReady }: { onTranscriptReady: (text: string, duration: number, title: string) => void }) {
  const [audioMode, setAudioMode] = useState<AudioMode>('mic')
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [error, setError] = useState('')
  const [supported, setSupported] = useState(true)
  const [transcribing, setTranscribing] = useState(false)
  const [noApiKey, setNoApiKey] = useState(false)

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef('')
  const startTimeRef = useRef(0)
  // FIX: use refs to avoid stale closures in async callbacks
  const isRecordingRef = useRef(false)
  const audioModeRef = useRef<AudioMode>('mic')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const chunkPartsRef = useRef<Blob[]>([])

  useEffect(() => {
    const w = window as any
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) setSupported(false)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      recognitionRef.current?.stop()
      try { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop() } catch {}
      displayStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => { audioModeRef.current = audioMode }, [audioMode])

  // Transcribe an audio blob via Whisper (Groq free tier / OpenAI)
  const transcribeChunk = async (blob: Blob) => {
    if (blob.size < 1000) return  // skip tiny/empty chunks
    setTranscribing(true)
    try {
      const form = new FormData()
      form.append('audio', blob, blob.type.includes('ogg') ? 'chunk.ogg' : 'chunk.webm')
      const res = await axios.post('/api/video-summary/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const text: string = res.data?.text ?? ''
      if (text.trim()) {
        transcriptRef.current += text.trim() + ' '
        setTranscript(transcriptRef.current)
      }
    } catch (e: any) {
      if (e?.response?.data?.error === 'NO_TRANSCRIPTION_KEY') {
        setNoApiKey(true)
        stopRecording()
      } else {
        console.warn('Chunk transcription failed:', e)
      }
    } finally {
      setTranscribing(false)
    }
  }

  const stopRecording = () => {
    isRecordingRef.current = false
    if (audioModeRef.current === 'mic') {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    } else {
      try { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop() } catch {}
      mediaRecorderRef.current = null
      displayStreamRef.current?.getTracks().forEach(t => t.stop())
      displayStreamRef.current = null
    }
    setIsRecording(false)
    setInterimText('')
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const startMicRecording = () => {
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) { setError('Browser tidak mendukung. Gunakan Chrome atau Edge.'); return }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'id-ID'
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          transcriptRef.current += result[0].transcript + ' '
          setTranscript(transcriptRef.current)
        } else {
          interim += result[0].transcript
        }
      }
      setInterimText(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Akses mikrofon ditolak. Izinkan akses mikrofon di browser lalu coba lagi.')
        stopRecording()
      } else if (event.error === 'network') {
        recognition.stop()
        setTimeout(() => { if (isRecordingRef.current) recognition.start() }, 500)
      } else if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error)
      }
    }

    recognition.onend = () => {
      // FIX: use isRecordingRef to avoid stale closure (isRecording state would always be false here)
      if (recognitionRef.current === recognition && isRecordingRef.current) {
        try { recognition.start() } catch { /* already started */ }
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsRecording(true)
      isRecordingRef.current = true
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch {
      setError('Gagal memulai. Pastikan mikrofon terhubung.')
    }
  }

  const startTabRecording = async () => {
    try {
      const stream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: { width: 1, height: 1, frameRate: 1 },
      })

      // Stop video track immediately — we only need audio
      stream.getVideoTracks().forEach(t => t.stop())
      const audioTracks = stream.getAudioTracks()

      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop())
        setError('Tidak ada audio yang dipilih. Saat browser meminta, centang "Also share tab audio" / "Share system audio" dan pilih tab meeting kamu.')
        return
      }

      displayStreamRef.current = stream
      const audioStream = new MediaStream(audioTracks)
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? ''
      const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {})
      chunkPartsRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunkPartsRef.current.push(e.data)
      }

      // Every 20 seconds: flush buffer and transcribe the chunk
      const CHUNK_MS = 20_000
      const chunkTimer = setInterval(async () => {
        if (!isRecordingRef.current || recorder.state === 'inactive') { clearInterval(chunkTimer); return }
        recorder.requestData()
        // Give ondataavailable time to fire
        await new Promise(r => setTimeout(r, 200))
        if (chunkPartsRef.current.length > 0) {
          const blob = new Blob([...chunkPartsRef.current], { type: recorder.mimeType || 'audio/webm' })
          chunkPartsRef.current = []
          await transcribeChunk(blob)
        }
      }, CHUNK_MS)

      recorder.onstop = async () => {
        clearInterval(chunkTimer)
        // Transcribe remaining audio when recording stops
        if (chunkPartsRef.current.length > 0) {
          const blob = new Blob([...chunkPartsRef.current], { type: recorder.mimeType || 'audio/webm' })
          chunkPartsRef.current = []
          await transcribeChunk(blob)
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder

      // When user clicks "Stop sharing" in browser UI
      audioTracks.forEach(t => { t.onended = () => stopRecording() })

      setIsRecording(true)
      isRecordingRef.current = true
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

    } catch (e: any) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Izin screen sharing ditolak. Klik Allow ketika browser meminta izin.')
      } else if (e.name === 'NotSupportedError') {
        setError('Browser ini tidak mendukung Tab Audio Capture. Gunakan Chrome atau Edge terbaru.')
      } else if (e.name === 'AbortError') {
        // User cancelled dialog — no error needed
      } else {
        setError('Gagal memulai rekaman tab: ' + (e.message ?? 'Unknown error'))
      }
    }
  }

  const startRecording = () => {
    setError('')
    setNoApiKey(false)
    if (audioMode === 'mic') startMicRecording()
    else void startTabRecording()
  }

  const handleFinish = () => {
    stopRecording()
    const finalText = transcriptRef.current.trim()
    if (!finalText || finalText.length < 20) {
      setError('Transkrip terlalu singkat. Rekam lebih lama.')
      return
    }
    onTranscriptReady(finalText, elapsed, meetingTitle || 'Live Meeting')
  }

  const handleReset = () => {
    stopRecording()
    setTranscript('')
    transcriptRef.current = ''
    setElapsed(0)
    setError('')
    setNoApiKey(false)
  }

  if (!supported && audioMode === 'mic') {
    return (
      <div className="alert" style={{ borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}>
        <i className="bi bi-exclamation-triangle-fill text-danger me-2" />
        <strong>Browser tidak mendukung Live Transcription via mikrofon.</strong> Gunakan <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>, atau pilih mode <strong>Audio Tab</strong>.
      </div>
    )
  }

  return (
    <div>
      {/* Audio mode selector */}
      <div className="d-flex gap-2 mb-3">
        {[
          { key: 'mic' as const, icon: 'bi-mic-fill', label: 'Mikrofon', desc: 'Suara lewat mic (ada noise ruangan)' },
          { key: 'tab' as const, icon: 'bi-display', label: 'Audio Tab', desc: 'Audio dari tab meeting — tanpa noise!' },
        ].map(m => (
          <button key={m.key} type="button" disabled={isRecording}
            onClick={() => { setAudioMode(m.key); setError(''); setNoApiKey(false) }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '10px 8px', borderRadius: 12, border: `2px solid ${audioMode === m.key ? '#10b981' : 'var(--sh-border)'}`,
              background: audioMode === m.key ? 'rgba(16,185,129,0.08)' : 'transparent',
              cursor: isRecording ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: isRecording ? 0.6 : 1,
            }}>
            <i className={`bi ${m.icon}`} style={{ fontSize: 18, color: audioMode === m.key ? '#10b981' : 'var(--sh-muted)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: audioMode === m.key ? '#10b981' : 'var(--sh-text)' }}>{m.label}</span>
            <span style={{ fontSize: 10, color: 'var(--sh-muted)', textAlign: 'center', lineHeight: 1.3 }}>{m.desc}</span>
            {m.key === 'tab' && (
              <span style={{ fontSize: 8, background: '#10b981', color: '#fff', borderRadius: 99, padding: '1px 5px', fontWeight: 800 }}>BERSIH</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <input type="text" className="form-control" style={{ borderRadius: 10, fontSize: 13 }}
          placeholder="Nama meeting (opsional, mis: Daily Standup 1 Apr)"
          value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)}
          disabled={isRecording} />
      </div>

      {/* Recording controls */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        {!isRecording ? (
          <button type="button" className="btn btn-danger d-flex align-items-center gap-2"
            style={{ borderRadius: 12, padding: '10px 20px', fontWeight: 700 }} onClick={startRecording}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
            Mulai Rekam
          </button>
        ) : (
          <button type="button" className="btn btn-outline-danger d-flex align-items-center gap-2"
            style={{ borderRadius: 12, padding: '10px 20px', fontWeight: 700 }} onClick={stopRecording}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', flexShrink: 0 }} />
            Stop
          </button>
        )}

        {isRecording && (
          <div className="d-flex align-items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.2s infinite' }} />
            <span className="fw-bold" style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtSecs(elapsed)}</span>
            {audioMode === 'tab' && transcribing && (
              <span style={{ fontSize: 11, color: '#6366f1' }}>
                <span className="spinner-border spinner-border-sm me-1" style={{ width: 10, height: 10, borderWidth: 2 }} />
                Transkripsi...
              </span>
            )}
          </div>
        )}

        {(transcript || elapsed > 0) && !isRecording && (
          <>
            <button type="button" className="btn btn-success" style={{ borderRadius: 12, padding: '10px 20px', fontWeight: 700 }}
              onClick={handleFinish} disabled={!transcript || transcript.length < 20 || transcribing}>
              {transcribing
                ? <><span className="spinner-border spinner-border-sm me-2" />Transkripsi...</>
                : <><i className="bi bi-magic me-2" />Rangkum Meeting</>}
            </button>
            <button type="button" className="btn btn-link text-danger p-0" style={{ fontSize: 13 }} onClick={handleReset}>
              Reset
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {error && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>{error}</div>}

      {/* No API key warning for Tab mode */}
      {noApiKey && (
        <div className="alert py-3 mb-3" style={{ fontSize: 12, borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="fw-bold mb-2" style={{ color: '#f59e0b' }}>
            <i className="bi bi-key-fill me-2" />Tab Audio Transcription Butuh API Key
          </div>
          <div style={{ color: 'var(--sh-muted)', marginBottom: 8 }}>
            Mode Audio Tab menggunakan <strong>Whisper AI</strong> untuk transkripsi, butuh salah satu key ini di <code>.env</code>:
          </div>
          <div style={{ marginBottom: 6 }}>
            <code style={{ fontSize: 11 }}>GROQ_API_KEY=...</code>{' '}
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#6366f1' }}>
              Daftar gratis di console.groq.com →
            </a>
          </div>
          <div style={{ color: 'var(--sh-muted)', fontSize: 11 }}>
            Atau gunakan mode <strong>Mikrofon</strong> yang tidak butuh API key tambahan.
          </div>
        </div>
      )}

      {/* Tips saat belum mulai */}
      {!isRecording && !transcript && (
        <div className="rounded-3 p-3" style={{ background: audioMode === 'tab' ? 'rgba(99,102,241,0.07)' : 'rgba(16,185,129,0.07)', border: `1px solid ${audioMode === 'tab' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`, fontSize: 12 }}>
          {audioMode === 'mic' ? (
            <>
              <div className="fw-semibold mb-2" style={{ color: '#10b981' }}>
                <i className="bi bi-mic-fill me-2" />Mode Mikrofon:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--sh-muted)', lineHeight: 2 }}>
                <li>Buka meeting Teams/Zoom/Meet di tab lain</li>
                <li>Klik <strong>Mulai Rekam</strong> → izinkan akses mikrofon</li>
                <li>Transkrip muncul real-time saat orang bicara</li>
                <li>Klik <strong>Rangkum Meeting</strong> saat selesai</li>
              </ol>
              <div className="mt-2" style={{ color: '#f59e0b' }}>
                <i className="bi bi-exclamation-triangle me-1" />Mikrofon akan menangkap semua suara di sekitar kamu, bukan hanya suara meeting.
              </div>
            </>
          ) : (
            <>
              <div className="fw-semibold mb-2" style={{ color: '#6366f1' }}>
                <i className="bi bi-display me-2" />Mode Audio Tab — Tanpa Noise Ruangan:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--sh-muted)', lineHeight: 2 }}>
                <li>Klik <strong>Mulai Rekam</strong> → browser minta izin screen sharing</li>
                <li>Pilih tab <strong>Teams/Zoom/Meet</strong> yang sedang meeting</li>
                <li>Centang <strong>"Also share tab audio"</strong> / <strong>"Share audio"</strong> di dialog browser</li>
                <li>Hanya audio meeting yang direkam — suara ruangan tidak masuk!</li>
                <li>Klik <strong>Rangkum Meeting</strong> setelah selesai</li>
              </ol>
              <div className="mt-2" style={{ color: '#6366f1' }}>
                <i className="bi bi-info-circle me-1" />Membutuhkan <strong>GROQ_API_KEY</strong> untuk transkripsi (gratis di{' '}
                <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer">console.groq.com</a>).
              </div>
            </>
          )}
        </div>
      )}

      {/* Live transcript display */}
      {(isRecording || transcript) && (
        <div style={{ marginTop: 12, maxHeight: 220, overflowY: 'auto', padding: '12px 14px', background: 'var(--sh-hover)', borderRadius: 12, border: '1px solid var(--sh-border)', fontSize: 13, lineHeight: 1.8, color: 'var(--sh-text)' }}>
          {transcript && <span>{transcript}</span>}
          {interimText && <span style={{ color: 'var(--sh-muted)', fontStyle: 'italic' }}>{interimText}</span>}
          {isRecording && !transcript && !interimText && (
            <span style={{ color: 'var(--sh-muted)' }}>
              {audioMode === 'tab'
                ? 'Merekam audio tab... transkrip muncul tiap 20 detik.'
                : 'Mendengarkan... pastikan ada suara yang terdeteksi.'}
            </span>
          )}
        </div>
      )}

      {transcript && (
        <div className="mt-2 text-end" style={{ fontSize: 11, color: 'var(--sh-muted)' }}>
          {transcript.split(' ').filter(Boolean).length} kata · {transcript.length} karakter
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VideoSummaryPage() {
  const { data: session, status } = useSession()
  const [apiLoaded, setApiLoaded] = useState(false)
  const [isDeveloper, setIsDeveloper] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [limit, setLimit] = useState(3)
  const [lifetimeUsed, setLifetimeUsed] = useState(0)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)

  const [inputTab, setInputTab] = useState<InputTab>('live')
  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [selected, setSelected] = useState<VideoDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pollingId, setPollingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadList = async () => {
    try {
      const { data } = await axios.get('/api/video-summary')
      setVideos(data.videos ?? [])
      setIsPremium(data.isPremium ?? false)
      setIsDeveloper(data.isDeveloper ?? false)
      setLimit(data.limit ?? 3)
      setLifetimeUsed(data.lifetimeUsed ?? 0)
      setApiLoaded(true)
    } catch {
      setApiLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (status !== 'loading') void loadList() }, [status])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasProcessing = videos.some(v => v.status === 'PROCESSING') || !!pollingId
    if (!hasProcessing) return
    pollRef.current = setInterval(async () => {
      await loadList()
      if (pollingId) {
        try {
          const { data } = await axios.get(`/api/video-summary/${pollingId}`)
          setSelected(data)
          if (data.status !== 'PROCESSING') setPollingId(null)
        } catch { /* ignore */ }
      }
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [videos, pollingId])

  const sessionDeveloper = (session?.user as any)?.isDeveloper ?? false

  if (status === 'loading' || !apiLoaded) {
    return (
      <div><Sidebar /><div className="app-main"><TopbarShell />
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
          <span className="spinner-border text-primary" />
        </div>
      </div></div>
    )
  }
  if (!isDeveloper && !sessionDeveloper) return <MaintenancePage />

  const canUpload = isPremium || lifetimeUsed < limit

  const submitTranscript = async (transcript: string, duration: number, title: string, type: string) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const { data } = await axios.post('/api/video-summary', {
        sourceType: type,
        transcript,
        title,
        duration,
      })
      await loadList()
      setPollingId(data.id)
      setDetailLoading(true)
      const { data: detail } = await axios.get(`/api/video-summary/${data.id}`)
      setSelected(detail)
      setDetailLoading(false)
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error ?? 'Gagal memproses.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      let data: any
      if (inputTab === 'teams' && file) {
        const form = new FormData()
        form.append('file', file)
        if (customTitle) form.append('title', customTitle)
        ;({ data } = await axios.post('/api/video-summary', form, { headers: { 'Content-Type': 'multipart/form-data' } }))
      } else if (inputTab === 'text') {
        ;({ data } = await axios.post('/api/video-summary', { sourceType: 'text', transcript: pasteText, title: customTitle }))
      } else {
        ;({ data } = await axios.post('/api/video-summary', { sourceType: 'youtube', url, title: customTitle }))
      }
      setUrl(''); setCustomTitle(''); setPasteText(''); setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadList()
      setPollingId(data.id)
      setDetailLoading(true)
      const { data: detail } = await axios.get(`/api/video-summary/${data.id}`)
      setSelected(detail)
      setDetailLoading(false)
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error ?? 'Gagal memproses.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (id: string) => {
    setDetailLoading(true); setSelected(null)
    try {
      const { data } = await axios.get(`/api/video-summary/${id}`)
      setSelected(data)
      if (data.status === 'PROCESSING') setPollingId(id)
    } catch { /* ignore */ }
    finally { setDetailLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus ringkasan ini?')) return
    await axios.delete(`/api/video-summary/${id}`).catch(() => {})
    setVideos(prev => prev.filter(v => v.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const handleReprocess = async (id: string) => {
    try {
      await axios.post(`/api/video-summary/${id}`)
      setSelected(prev => prev ? { ...prev, status: 'PROCESSING' } : prev)
      setPollingId(id)
    } catch (err: any) { alert(err?.response?.data?.error ?? 'Gagal.') }
  }

  const TABS = [
    { key: 'live' as const,    icon: 'bi-mic-fill',      color: '#10b981', label: 'Live Meeting' },
    { key: 'youtube' as const, icon: 'bi-youtube',       color: '#ef4444', label: 'YouTube' },
    { key: 'teams' as const,   icon: 'bi-camera-video',  color: '#5059c9', label: 'Upload Transkrip' },
    { key: 'text' as const,    icon: 'bi-file-text',     color: '#6366f1', label: 'Paste Teks' },
  ]

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="page-transition" style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 80px' }}>

          {/* ── Header ── */}
          <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="bi bi-play-circle-fill" style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h4 className="mb-0 fw-bold">Video AI Summarizer</h4>
                <span style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.06em' }}>BETA</span>
                <span style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.06em' }}>DEV ONLY</span>
              </div>
              <p className="mb-0 text-muted" style={{ fontSize: 13 }}>Live meeting · YouTube · Teams/SharePoint · Paste teks</p>
            </div>
            {isPremium && <span style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>⭐ PREMIUM</span>}
          </div>

          {/* ── Limit badge ── */}
          {!isPremium && (
            <div className="d-flex align-items-center gap-2 p-3 rounded-3 mb-4"
              style={{ background: lifetimeUsed >= limit ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.07)', border: `1px solid ${lifetimeUsed >= limit ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'}` }}>
              <i className={`bi ${lifetimeUsed >= limit ? 'bi-lock-fill text-danger' : 'bi-info-circle text-primary'}`} />
              <span style={{ fontSize: 13 }}>
                {lifetimeUsed >= limit
                  ? <><b>{limit} slot gratis</b> sudah habis. <Link href="/upgrade" className="fw-bold text-danger">Upgrade Premium</Link> untuk lebih banyak.</>
                  : <>{lifetimeUsed}/{limit} slot gratis terpakai. <Link href="/upgrade" className="fw-bold" style={{ color: '#6366f1' }}>Upgrade</Link> untuk unlimited.</>}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.6fr' : '1fr', gap: 16, alignItems: 'start' }}>

            {/* ── LEFT: Input form + list ── */}
            <div>
              {canUpload && (
                <div className="card mb-3" style={{ borderRadius: 16, border: '1px solid var(--sh-border)' }}>
                  <div className="card-body p-4">

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--sh-border)', paddingBottom: 0, overflowX: 'auto' }}>
                      {TABS.map(t => (
                        <button key={t.key} type="button" onClick={() => setInputTab(t.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                            background: 'transparent',
                            color: inputTab === t.key ? t.color : 'var(--sh-muted)',
                            borderBottom: `2px solid ${inputTab === t.key ? t.color : 'transparent'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <i className={`bi ${t.icon}`} style={{ fontSize: 14 }} />
                          {t.label}
                          {t.key === 'live' && (
                            <span style={{ fontSize: 8, background: '#10b981', color: '#fff', borderRadius: 99, padding: '1px 4px', fontWeight: 800 }}>NEW</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ── Tab: Live Meeting ── */}
                    {inputTab === 'live' && (
                      <>
                        {submitting ? (
                          <div className="text-center py-4">
                            <span className="spinner-border text-primary mb-2" />
                            <div style={{ fontSize: 13 }}>AI sedang merangkum meeting...</div>
                          </div>
                        ) : (
                          <LiveMeetingTab
                            onTranscriptReady={(text, duration, title) => {
                              void submitTranscript(text, duration, title, 'live')
                            }}
                          />
                        )}
                        {submitError && <div className="alert alert-danger py-2 mt-3" style={{ fontSize: 13, borderRadius: 10 }}>{submitError}</div>}
                      </>
                    )}

                    {/* ── Tab: YouTube ── */}
                    {inputTab === 'youtube' && (
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="form-label fw-semibold" style={{ fontSize: 12 }}>URL Video YouTube</label>
                          <input type="url" className="form-control" style={{ borderRadius: 10, fontSize: 13 }}
                            placeholder="https://youtube.com/watch?v=... atau https://youtu.be/..."
                            value={url} onChange={e => setUrl(e.target.value)} required />
                        </div>
                        <div className="alert py-2 mb-3" style={{ fontSize: 12, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--sh-text)' }}>
                          <i className="bi bi-info-circle me-2 text-warning" />
                          Video harus <strong>publik</strong> dan punya <strong>caption/subtitle aktif</strong>. Video private atau tanpa caption tidak bisa diproses — gunakan tab <strong>Upload Transkrip</strong> atau <strong>Live Meeting</strong> sebagai alternatif.
                        </div>
                        <div className="mb-3">
                          <input type="text" className="form-control" style={{ borderRadius: 10, fontSize: 13 }}
                            placeholder="Judul (opsional)" value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
                        </div>
                        {submitError && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>{submitError}</div>}
                        <button type="submit" className="btn btn-primary w-100" style={{ borderRadius: 10 }} disabled={submitting || !url.trim()}>
                          {submitting ? <><span className="spinner-border spinner-border-sm me-2" />Memproses...</> : <><i className="bi bi-magic me-2" />Rangkum Video</>}
                        </button>
                      </form>
                    )}

                    {/* ── Tab: Upload Transkrip (Teams/SharePoint) ── */}
                    {inputTab === 'teams' && (
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="form-label fw-semibold" style={{ fontSize: 12 }}>Upload File Transkrip</label>
                          <div
                            style={{ border: '2px dashed var(--sh-border)', borderRadius: 12, cursor: 'pointer', padding: '20px', textAlign: 'center', background: file ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {file ? (
                              <>
                                <i className="bi bi-file-check-fill text-success mb-2" style={{ fontSize: 28, display: 'block' }} />
                                <div className="fw-semibold" style={{ fontSize: 13 }}>{file.name}</div>
                                <div className="text-muted" style={{ fontSize: 11 }}>{(file.size / 1024).toFixed(1)} KB</div>
                              </>
                            ) : (
                              <>
                                <i className="bi bi-cloud-upload text-primary mb-2" style={{ fontSize: 28, display: 'block' }} />
                                <div className="fw-semibold" style={{ fontSize: 13 }}>Klik untuk pilih file</div>
                                <div className="text-muted mt-1" style={{ fontSize: 11 }}>.vtt · .srt · .txt — Maks 5 MB</div>
                              </>
                            )}
                          </div>
                          <input ref={fileInputRef} type="file" accept=".vtt,.srt,.txt" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                        </div>

                        {/* Panduan Teams */}
                        <div className="p-3 rounded-3 mb-3" style={{ background: 'rgba(80,89,201,0.07)', border: '1px solid rgba(80,89,201,0.2)', fontSize: 12 }}>
                          <div className="fw-semibold mb-2" style={{ color: '#5059c9' }}>
                            <i className="bi bi-camera-video me-2" />Download transkrip dari Teams:
                          </div>
                          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--sh-muted)', lineHeight: 2 }}>
                            <li>Buka <strong>Microsoft Teams</strong> → Chat atau Calendar</li>
                            <li>Cari rekaman meeting → klik <strong>⋯ More options</strong></li>
                            <li>Pilih <strong>Open in Microsoft Stream</strong></li>
                            <li>Di Stream, klik <strong>Download transcript</strong> (.vtt)</li>
                            <li>Upload file .vtt ke sini</li>
                          </ol>
                          <div className="mt-2" style={{ color: '#f59e0b' }}>
                            <i className="bi bi-exclamation-triangle me-1" />
                            Jika transcript tidak tersedia di rekaman, gunakan tab <strong>Live Meeting</strong> saat meeting berlangsung!
                          </div>
                        </div>

                        <div className="mb-3">
                          <input type="text" className="form-control" style={{ borderRadius: 10, fontSize: 13 }}
                            placeholder="Judul meeting (opsional)" value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
                        </div>
                        {submitError && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>{submitError}</div>}
                        <button type="submit" className="btn btn-primary w-100" style={{ borderRadius: 10 }} disabled={submitting || !file}>
                          {submitting ? <><span className="spinner-border spinner-border-sm me-2" />Memproses...</> : <><i className="bi bi-magic me-2" />Rangkum Transkrip</>}
                        </button>
                      </form>
                    )}

                    {/* ── Tab: Paste Teks ── */}
                    {inputTab === 'text' && (
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="form-label fw-semibold" style={{ fontSize: 12 }}>Paste Teks / Catatan Meeting</label>
                          <textarea className="form-control" rows={8} style={{ borderRadius: 10, fontSize: 12, resize: 'vertical' }}
                            placeholder="Paste teks transkrip, meeting notes, atau konten apapun yang ingin dirangkum AI..."
                            value={pasteText} onChange={e => setPasteText(e.target.value)} required />
                          <div className="text-muted mt-1" style={{ fontSize: 11 }}>{pasteText.length.toLocaleString()} karakter</div>
                        </div>
                        <div className="mb-3">
                          <input type="text" className="form-control" style={{ borderRadius: 10, fontSize: 13 }}
                            placeholder="Judul (opsional)" value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
                        </div>
                        {submitError && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>{submitError}</div>}
                        <button type="submit" className="btn btn-primary w-100" style={{ borderRadius: 10 }} disabled={submitting || pasteText.length < 50}>
                          {submitting ? <><span className="spinner-border spinner-border-sm me-2" />Memproses...</> : <><i className="bi bi-magic me-2" />Rangkum Teks</>}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* ── History list ── */}
              {loading ? (
                <div className="text-center py-4"><span className="spinner-border spinner-border-sm" /></div>
              ) : videos.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                  <div className="fw-semibold mb-1">Belum ada ringkasan</div>
                  <div style={{ fontSize: 13 }}>Mulai dengan Live Meeting atau YouTube di atas</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {videos.map(v => {
                    const thumb = v.sourceType === 'youtube' ? getYtThumbnail(v.sourceUrl) : null
                    const isActive = selected?.id === v.id
                    const src = sourceIcon(v.sourceType)
                    return (
                      <div key={v.id} className="card" style={{ borderRadius: 14, cursor: 'pointer', border: isActive ? '2px solid #6366f1' : '1px solid var(--sh-border)', background: isActive ? 'rgba(99,102,241,0.06)' : 'var(--sh-card-bg)' }} onClick={() => openDetail(v.id)}>
                        <div className="card-body p-3 d-flex align-items-center gap-3">
                          {thumb
                            ? <img src={thumb} alt="" style={{ width: 72, height: 46, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 72, height: 46, borderRadius: 8, background: `${src.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <i className={`bi ${src.icon}`} style={{ color: src.color, fontSize: 20 }} />
                              </div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="fw-semibold text-truncate" style={{ fontSize: 13 }}>{v.title}</div>
                            <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 7px', background: v.status === 'READY' ? 'rgba(16,185,129,0.12)' : v.status === 'ERROR' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: v.status === 'READY' ? '#10b981' : v.status === 'ERROR' ? '#ef4444' : '#f59e0b' }}>
                                {v.status === 'READY' ? '✓ Siap' : v.status === 'ERROR' ? '✗ Error' : '⏳ Proses...'}
                              </span>
                              <span style={{ fontSize: 10, color: src.color, fontWeight: 600 }}>{src.label}</span>
                              {v.duration && <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>{fmtDuration(v.duration)}</span>}
                              <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>{timeAgo(v.createdAt)}</span>
                            </div>
                          </div>
                          <button className="btn btn-sm" style={{ padding: '2px 6px', color: '#ef4444', flexShrink: 0 }} onClick={e => { e.stopPropagation(); handleDelete(v.id) }} title="Hapus">
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT: Detail panel ── */}
            {selected && (
              <div className="card" style={{ borderRadius: 18, border: '1px solid var(--sh-border)', position: 'sticky', top: 80 }}>
                <div className="card-body p-0" style={{ overflow: 'hidden', borderRadius: 18 }}>
                  {/* Header */}
                  {(() => {
                    const thumb = selected.sourceType === 'youtube' ? getYtThumbnail(selected.sourceUrl) : null
                    const src = sourceIcon(selected.sourceType)
                    return thumb ? (
                      <div style={{ position: 'relative' }}>
                        <img src={thumb} alt={selected.title} style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.75))' }} />
                        <div style={{ position: 'absolute', bottom: 10, left: 14, right: 48 }}>
                          <div className="fw-bold text-white" style={{ fontSize: 13, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{selected.title}</div>
                          {selected.duration && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{fmtDuration(selected.duration)}</div>}
                        </div>
                        <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"
                          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '3px 7px', color: '#fff', fontSize: 11, textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}>
                          <i className="bi bi-youtube me-1 text-danger" />Buka
                        </a>
                      </div>
                    ) : (
                      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--sh-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${src.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`bi ${src.icon}`} style={{ color: src.color, fontSize: 17 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="fw-bold text-truncate" style={{ fontSize: 14 }}>{selected.title}</div>
                          <div style={{ fontSize: 11, color: src.color, fontWeight: 600 }}>{src.label}{selected.duration ? ` · ${fmtDuration(selected.duration)}` : ''}</div>
                        </div>
                        <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--sh-muted)' }} onClick={() => setSelected(null)}>✕</button>
                      </div>
                    )
                  })()}

                  <div style={{ padding: '16px 18px', maxHeight: '65vh', overflowY: 'auto' }}>
                    {detailLoading || selected.status === 'PROCESSING' ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary mb-3" />
                        <div className="fw-semibold">AI sedang merangkum...</div>
                        <div className="text-muted" style={{ fontSize: 13 }}>Proses bisa 1-3 menit untuk konten panjang</div>
                      </div>
                    ) : selected.status === 'ERROR' ? (
                      <div className="text-center py-4">
                        <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
                        <div className="fw-semibold mb-2">Gagal Memproses</div>
                        <div className="text-muted small mb-3" style={{ lineHeight: 1.6 }}>{selected.summary}</div>
                        <button className="btn btn-primary btn-sm" onClick={() => handleReprocess(selected.id)}>
                          <i className="bi bi-arrow-clockwise me-1" />Proses Ulang
                        </button>
                      </div>
                    ) : selected.summary ? (
                      <>
                        <div style={{ fontSize: 13, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.summary) }} />
                        <div className="mt-3 pt-3 d-flex gap-2 flex-wrap" style={{ borderTop: '1px solid var(--sh-border)' }}>
                          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12, borderRadius: 8 }} onClick={() => handleReprocess(selected.id)}>
                            <i className="bi bi-arrow-clockwise me-1" />Buat Ulang
                          </button>
                          <button className="btn btn-sm btn-outline-primary" style={{ fontSize: 12, borderRadius: 8 }} onClick={() => navigator.clipboard.writeText(selected.summary ?? '')}>
                            <i className="bi bi-clipboard me-1" />Salin
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-muted">Ringkasan belum tersedia.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
