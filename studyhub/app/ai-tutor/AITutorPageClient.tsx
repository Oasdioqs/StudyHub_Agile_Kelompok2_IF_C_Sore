'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

type UploadItem = { type: 'image' | 'text' | 'file'; name: string; content: string; mimeType?: string; preview?: string }
type Message = { role: 'user' | 'assistant'; content: string; id?: string; attachments?: UploadItem[] }
type ChatSession = { id: string; title: string; updatedAt: string }
type AiMode = 'fast' | 'detail' | 'exam'
type TaskFormSubmissionPayload = {
  title: string
  subject: string
  deadline: string
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
}
type TaskListModeNav = 'all' | 'upcoming' | 'today' | 'tomorrow'
type SessionChatSettings = {
  botName: string
  userName: string
  tone: 'genz' | 'formal' | 'santai' | 'mentor'
  detailLevel: 'ringkas' | 'normal' | 'detail'
  emojiLevel: 'minim' | 'normal'
  language: 'id' | 'en'
  responseFormat: 'markdown' | 'bullet' | 'table' | 'paragraph'
}

const defaultSessionSettings = (username?: string): SessionChatSettings => ({
  botName: 'StudyHub Bot',
  userName: username?.trim() || 'Kamu',
  tone: 'genz',
  detailLevel: 'normal',
  emojiLevel: 'normal',
  language: 'id',
  responseFormat: 'markdown',
})

export default function AITutorPageClient() {
  const { data: authSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [showHistory, setShowHistory] = useState(true)
  const [aiMode, setAiMode] = useState<AiMode>('fast')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [showUploadsPanel, setShowUploadsPanel] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null)
  const [sessionSettingsMap, setSessionSettingsMap] = useState<Record<string, SessionChatSettings>>({})
  const [settingsSessionId, setSettingsSessionId] = useState<string | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<SessionChatSettings>(defaultSessionSettings())
  const [taskForm, setTaskForm] = useState({
    title: '',
    subject: '',
    deadline: '',
    status: '',
    priority: '',
  })
  const [taskFormError, setTaskFormError] = useState('')
  const [taskFormCompleted, setTaskFormCompleted] = useState(false)
  const [taskFormSignature, setTaskFormSignature] = useState('')
  const [taskEditForm, setTaskEditForm] = useState<{
    visible: boolean
    targetNo: number | null
    targetTitle: string
    newTitle: string
    status: string
    deadline: string
  }>({
    visible: false,
    targetNo: null,
    targetTitle: '',
    newTitle: '',
    status: '',
    deadline: '',
  })
  const [taskEditError, setTaskEditError] = useState('')
  const [keyboardInset, setKeyboardInset] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolsMenuRef = useRef<HTMLFormElement | null>(null)
  const hasAutoAskedRef = useRef(false)
  const requestAbortRef = useRef<AbortController | null>(null)
  const stopTypingRef = useRef(false)

  // ── Call Mode State ────────────────────────────────────────────────────────
  const [isCallMode, setIsCallMode] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const [callTranscript, setCallTranscript] = useState('')
  const [callResponse, setCallResponse] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const callActiveRef = useRef(false)
  const callStatusRef = useRef<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const recognitionRef = useRef<any>(null)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSpeechTimeRef = useRef<number>(0)
  const pendingTranscriptRef = useRef<string>('')
  const silenceThreshold = 1200 // ms of silence before sending

  // ── Call Mode persistent history ─────────────────────────────────────────────
  const callHistoryRef = useRef<Array<{role: 'user' | 'assistant', content: string}>>([])

  // Start Call Mode
  const startCallMode = async () => {
    setIsCallMode(true)
    callActiveRef.current = true
    callStatusRef.current = 'listening'
    setCallStatus('listening')
    setCallTranscript('')
    setCallResponse('')
    setMicError(null)
    // Keep existing call history, don't reset

    // Small delay to ensure state is set
    await new Promise(resolve => setTimeout(resolve, 100))
    startCallListening()
  }

  // End Call Mode
  const endCallMode = () => {
    callActiveRef.current = false
    setIsCallMode(false)
    setCallStatus('idle')
    callStatusRef.current = 'idle'
    stopCallListening()
    window.speechSynthesis.cancel()

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    setCallTranscript('')
    setCallResponse('')
  }

  // Start listening in call mode (continuous with silence detection)
  const startCallListening = () => {
    if (typeof window === 'undefined' || !callActiveRef.current) return
    if (callStatusRef.current !== 'listening') return // Don't start if not in listening state

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      setMicError('Speech Recognition tidak tersedia di browser ini. Gunakan Chrome atau Edge.')
      return
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true // Continuous for silence detection
    recognition.interimResults = true
    recognition.lang = 'id-ID'
    recognition.maxAlternatives = 1

    let hasReceivedSpeech = false

    recognition.onstart = () => {
      setMicError(null)
    }

    recognition.onresult = (event: any) => {
      if (!callActiveRef.current || callStatusRef.current !== 'listening') return

      hasReceivedSpeech = true
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }

      setCallTranscript(transcript)
      lastSpeechTimeRef.current = Date.now()
      pendingTranscriptRef.current = transcript.trim()

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }

      if (transcript.trim().length > 0 && callActiveRef.current && callStatusRef.current === 'listening') {
        silenceTimerRef.current = setTimeout(() => {
          if (callActiveRef.current && pendingTranscriptRef.current.length > 0 && callStatusRef.current === 'listening') {
            const finalText = pendingTranscriptRef.current
            pendingTranscriptRef.current = ''
            setCallTranscript('')
            processCallInput(finalText)
          }
        }, silenceThreshold)
      }
    }

    recognition.onerror = (event: any) => {
      hasReceivedSpeech = false // Reset on error

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setMicError('Izin mikrofon ditolak. Mohon izinkan akses mikrofon di pengaturan browser.')
        return
      }

      if (event.error === 'no-speech' && callActiveRef.current && callStatusRef.current === 'listening') {
        setTimeout(() => {
          if (callActiveRef.current && callStatusRef.current === 'listening') startCallListening()
        }, 500)
      } else if (event.error !== 'aborted' && event.error !== 'no-speech' && callActiveRef.current) {
        setTimeout(() => {
          if (callActiveRef.current && callStatusRef.current === 'listening') startCallListening()
        }, 1000)
      }
    }

    recognition.onend = () => {
      // Only restart if we actually received speech and we're still supposed to be listening
      if (callActiveRef.current && callStatusRef.current === 'listening' && hasReceivedSpeech) {
        hasReceivedSpeech = false
        setTimeout(() => {
          if (callActiveRef.current && callStatusRef.current === 'listening') startCallListening()
        }, 300)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      setMicError('Gagal mengakses mikrofon. Pastikan mikrofon terhubung dan tidak sedang digunakan aplikasi lain.')
    }
  }

  // Stop call listening
  const stopCallListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }

  // Process voice input in call mode
  const processCallInput = async (text: string) => {
    if (!text.trim() || !callActiveRef.current) return

    stopCallListening()
    callStatusRef.current = 'thinking'
    setCallStatus('thinking')

    // Use ref for persistent history
    const newHistory = [...callHistoryRef.current, { role: 'user' as const, content: text }]
    callHistoryRef.current = newHistory
    setCallTranscript('')
    setCallResponse('Memproses...')

    try {
      const response = await axios.post('/api/ai', {
        message: text,
        mode: aiMode,
        historyOverride: newHistory.slice(-10),
      }, { timeout: 30000 })

      const reply = response.data?.reply || 'Maaf, saya tidak bisa menjawab saat ini.'
      const cleanReply = reply
        .replace(/\[STUDYHUB_ACTION:\{[\s\S]*?\}\]/g, '')
        .replace(/```[\s\S]*?```/g, '[kode]')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#+\s*/g, '')
        .replace(/\n+/g, '. ')
        .trim()

      callHistoryRef.current = [...callHistoryRef.current, { role: 'assistant' as const, content: cleanReply }]
      setCallResponse(cleanReply)

      if (callActiveRef.current) {
        callStatusRef.current = 'speaking'
        setCallStatus('speaking')
        speakCallText(cleanReply)
      }
    } catch (err) {
      const errorMsg = 'Maaf, terjadi kesalahan. Coba lagi.'
      setCallResponse(errorMsg)
      callHistoryRef.current = [...callHistoryRef.current, { role: 'assistant' as const, content: errorMsg }]
      if (callActiveRef.current) {
        callStatusRef.current = 'speaking'
        setCallStatus('speaking')
        speakCallText(errorMsg)
      }
    }
  }

  // Speak text in call mode (user CAN interrupt when AI is speaking)
  const speakCallText = (text: string) => {
    if (typeof window === 'undefined') return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID'
    utterance.rate = 1.0
    utterance.volume = 1.0
    utterance.pitch = 1.0

    // Try to get Indonesian voice first, fallback to any available
    const voices = window.speechSynthesis.getVoices()
    const idVoice = voices.find(v => v.lang.startsWith('id'))
    if (idVoice) {
      utterance.voice = idVoice
    } else {
      // For mobile, try to use any female voice or first available
      const preferredVoice = voices.find(v =>
        v.lang.includes('id') ||
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('wanita')
      )
      if (preferredVoice) utterance.voice = preferredVoice
    }

    utterance.onstart = () => {
      if (callActiveRef.current) {
        callStatusRef.current = 'speaking'
        setCallStatus('speaking')
      }
    }
    utterance.onend = () => {
      if (callActiveRef.current) {
        callStatusRef.current = 'listening'
        setCallStatus('listening')
        setCallResponse('')
        setTimeout(() => startCallListening(), 500)
      }
    }
    utterance.onerror = () => {
      if (callActiveRef.current) {
        callStatusRef.current = 'listening'
        setCallStatus('listening')
        setTimeout(() => startCallListening(), 500)
      }
    }

    speechSynthRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  // Interrupt AI speech when user starts speaking
  const interruptAISpeech = () => {
    if (callStatusRef.current !== 'speaking') return

    window.speechSynthesis.cancel()
    stopCallListening()

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    // Clear current recognition to start fresh
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }

    callStatusRef.current = 'listening'
    setCallStatus('listening')
    setCallResponse('')
    setIsUserSpeaking(true)
    lastSpeechTimeRef.current = Date.now()

    // Start recognition immediately
    setTimeout(() => startCallListening(), 100)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchSessions = async () => {
    setLoadingSessions(true)
    try {
      const { data } = await axios.get('/api/ai')
      setSessions(data)
      setSessionSettingsMap((prev) => {
        const next = { ...prev }
        for (const s of data as ChatSession[]) {
          if (!next[s.id]) next[s.id] = defaultSessionSettings(authSession?.user?.name || undefined)
        }
        return next
      })
      setSessionsError('')
    } catch (err: any) {
      setSessions([])
      setSessionsError(err?.response?.data?.error || 'Riwayat chat belum bisa dimuat.')
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    void fetchSessions()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 992) {
      setShowHistory(false)
    }
  }, [])

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!toolsMenuRef.current) return
      const target = ev.target as Node
      if (!toolsMenuRef.current.contains(target)) {
        setShowToolsMenu(false)
        setShowUploadsPanel(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('ai-session-settings-v1')
      if (raw) {
        setSessionSettingsMap(JSON.parse(raw))
      }
    } catch {
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('ai-session-settings-v1', JSON.stringify(sessionSettingsMap))
  }, [sessionSettingsMap])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const updateKeyboardInset = () => {
      const vv = window.visualViewport
      if (!vv) return
      const rawInset = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardInset(rawInset > 0 ? Math.round(rawInset) : 0)
    }
    updateKeyboardInset()
    window.visualViewport.addEventListener('resize', updateKeyboardInset)
    window.visualViewport.addEventListener('scroll', updateKeyboardInset)
    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardInset)
      window.visualViewport?.removeEventListener('scroll', updateKeyboardInset)
    }
  }, [])

  useEffect(() => {
    if (hasAutoAskedRef.current) return
    const ask = searchParams.get('ask')?.trim()
    if (!ask) return
    hasAutoAskedRef.current = true
    void sendMessageText(ask)
    router.replace('/ai-tutor')
  }, [router, searchParams])

  // ── Action System: parse & execute [STUDYHUB_ACTION:{...}] dari AI ──────────
  const executeActions = async (reply: string): Promise<string> => {
    const actionRegex = /\[STUDYHUB_ACTION:(\{[^[\]]+\})\]/g
    const actions: Array<{ type: string; data: Record<string, any> }> = []
    let match: RegExpExecArray | null

    while ((match = actionRegex.exec(reply)) !== null) {
      try {
        const parsed = JSON.parse(match[1])
        if (parsed?.type) actions.push(parsed)
      } catch { /* skip invalid */ }
    }

    // Strip action blocks from display text
    const cleanReply = reply.replace(/\[STUDYHUB_ACTION:\{[^[\]]+\}\]/g, '').trim()

    if (actions.length === 0) return cleanReply

    // Execute each action
    const results: string[] = []
    for (const action of actions) {
      try {
        let res: Response
        let msg = ''

        switch (action.type) {
          case 'create_task':
            res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.data) })
            msg = res.ok ? `✅ Tugas **"${action.data.title}"** berhasil dibuat!` : `❌ Gagal buat tugas: ${(await res.json()).error}`
            break

          case 'edit_task':
            res = await fetch(`/api/tasks/${action.data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.data) })
            msg = res.ok ? `✅ Tugas **"${action.data.title || action.data.id}"** berhasil diupdate!` : `❌ Gagal update tugas`
            break

          case 'delete_task':
            res = await fetch(`/api/tasks/${action.data.id}`, { method: 'DELETE' })
            msg = res.ok ? `🗑️ Tugas **"${action.data.title}"** berhasil dihapus.` : `❌ Gagal hapus tugas`
            break

          case 'create_note':
            res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.data) })
            msg = res.ok ? `✅ Catatan **"${action.data.title}"** berhasil dibuat!` : `❌ Gagal buat catatan`
            break

          case 'create_schedule': {
            // GET current slots, tambah slot baru, PUT semua kembali
            const currRes = await fetch('/api/schedule')
            const currData = currRes.ok ? await currRes.json() : { slots: [] }
            const currentSlots = currData.slots || []
            const newSlots = [...currentSlots, action.data]
            res = await fetch('/api/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots: newSlots }) })
            msg = res.ok ? `✅ Jadwal **"${action.data.title}"** berhasil ditambahkan!` : `❌ Gagal tambah jadwal`
            break
          }

          case 'delete_schedule': {
            // GET current slots, hapus yang sesuai ID, PUT sisanya
            const currRes2 = await fetch('/api/schedule')
            const currData2 = currRes2.ok ? await currRes2.json() : { slots: [] }
            const filteredSlots = (currData2.slots || []).filter((s: any) => s.id !== action.data.id)
            res = await fetch('/api/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots: filteredSlots }) })
            msg = res.ok ? `🗑️ Jadwal berhasil dihapus.` : `❌ Gagal hapus jadwal`
            break
          }

          default:
            continue
        }
        results.push(msg)
      } catch {
        results.push(`❌ Gagal eksekusi aksi: ${action.type}`)
      }
    }

    if (results.length > 0) {
      return cleanReply + '\n\n' + results.join('\n')
    }
    return cleanReply
  }

  const sendMessageText = async (
    text: string,
    opts?: {
      historyOverride?: Message[]
      skipAppendUser?: boolean
      forcedMode?: AiMode
      forcedUploads?: UploadItem[]
      taskFormSubmission?: TaskFormSubmissionPayload
      replaceAssistantIndex?: number
    },
  ): Promise<string | null> => {
    const userMsg = text.trim()
    const selectedUploads = (opts?.forcedUploads ?? uploads).slice(0, 4)
    if ((!userMsg && selectedUploads.length === 0) || loading) return null
    const settingsKey = sessionId ?? '__draft__'
    const activeSessionSettings = {
      ...defaultSessionSettings(authSession?.user?.name || undefined),
      ...(sessionSettingsMap[settingsKey] || {}),
    }
    const displayUserMsg = userMsg || 'Lampiran dikirim.'
    if (!opts?.skipAppendUser) {
      setMessages(prev => [...prev, { role: 'user', content: displayUserMsg, id: crypto.randomUUID(), attachments: selectedUploads }])
    }
    setLoading(true)
    stopTypingRef.current = false
    const abortController = new AbortController()
    requestAbortRef.current = abortController

    try {
      const payloadUploads = selectedUploads.map((u) => ({
        type: u.type,
        name: u.name,
        content: u.content,
        mimeType: u.mimeType,
      }))
      const { data } = await axios.post('/api/ai', {
        message: userMsg,
        sessionId,
        mode: opts?.forcedMode ?? aiMode,
        historyOverride: opts?.historyOverride,
        attachments: payloadUploads,
        sessionSettings: activeSessionSettings,
        taskFormSubmission: opts?.taskFormSubmission,
      }, { signal: abortController.signal })
      if (typeof opts?.replaceAssistantIndex === 'number' && opts.replaceAssistantIndex >= 0) {
        setMessages((prev) => {
          if (opts.replaceAssistantIndex === undefined || opts.replaceAssistantIndex >= prev.length) return prev
          const next = [...prev]
          const target = next[opts.replaceAssistantIndex]
          if (!target || target.role !== 'assistant') return prev
          next[opts.replaceAssistantIndex] = { ...target, content: '' }
          return next
        })
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      }
      const rawReply: string = data.reply || ''
      // Parse & execute actions, get clean display text
      const fullReply = await executeActions(rawReply)
      let current = ''
      for (let i = 0; i < fullReply.length; i += 1) {
        if (stopTypingRef.current) break
        current += fullReply[i]
        setMessages(prev => {
          const next = [...prev]
          if (typeof opts?.replaceAssistantIndex === 'number' && opts.replaceAssistantIndex >= 0) {
            const target = next[opts.replaceAssistantIndex]
            if (target?.role === 'assistant') next[opts.replaceAssistantIndex] = { ...target, content: current }
          } else {
            const last = next[next.length - 1]
            if (last?.role === 'assistant') next[next.length - 1] = { role: 'assistant', content: current }
          }
          return next
        })
        await new Promise((res) => setTimeout(res, 9))
      }
      const oldSessionId = sessionId
      setSessionId(data.sessionId)
      if (!oldSessionId && data.sessionId) {
        setSessionSettingsMap((prev) => {
          if (prev[data.sessionId]) return prev
          return {
            ...prev,
            [data.sessionId]: prev.__draft__ || defaultSessionSettings(authSession?.user?.name || undefined),
          }
        })
      }
      setUploads([])
      void fetchSessions()
      return fullReply
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return null
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error ?? 'Terjadi kesalahan. Coba lagi.',
      }])
      return null
    } finally {
      requestAbortRef.current = null
      setLoading(false)
    }
  }

  const stopAssistant = () => {
    stopTypingRef.current = true
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    setLoading(false)
  }

  const sendMessage = async () => {
    if (loading) return
    if (!input.trim() && uploads.length === 0) return
    const userMsg = input.trim()
    setInput('')
    if (editIndex !== null) {
      const baseHistory = messages.slice(0, editIndex)
      const nextHistory = [...baseHistory, { role: 'user' as const, content: userMsg, attachments: uploads.slice(0, 4) }]
      setMessages(nextHistory)
      setEditIndex(null)
      await sendMessageText(userMsg, {
        historyOverride: nextHistory,
        skipAppendUser: true,
      })
      return
    }
    await sendMessageText(userMsg || 'Ringkas isi lampiran ini.')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if ((e.nativeEvent as any)?.isComposing) return
    if (e.key === 'Escape' && editIndex !== null) {
      e.preventDefault()
      setEditIndex(null)
      setInput('')
      return
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const newChat = () => {
    setMessages([])
    setSessionId(null)
    setInput('')
    setUploads([])
    setEditIndex(null)
  }

  const openSession = async (id: string) => {
    if (loading) return
    try {
      const { data } = await axios.get(`/api/ai/${id}`)
      setSessionId(data.id)
      setMessages((data.messages as Message[]) ?? [])
      setSessionSettingsMap((prev) => (
        prev[id] ? prev : { ...prev, [id]: defaultSessionSettings(authSession?.user?.name || undefined) }
      ))
      if (typeof window !== 'undefined' && window.innerWidth <= 992) {
        setShowHistory(false)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Gagal membuka riwayat chat. Coba lagi sebentar.',
      }])
    }
  }

  const startRename = (s: ChatSession) => {
    setRenamingId(s.id)
    setRenameDraft(s.title || '')
  }

  const openSettings = (id: string) => {
    setSettingsSessionId(id)
    setSettingsDraft({
      ...defaultSessionSettings(authSession?.user?.name || undefined),
      ...(sessionSettingsMap[id] || {}),
    })
  }

  const saveSessionSettings = () => {
    if (!settingsSessionId) return
    setSessionSettingsMap((prev) => ({
      ...prev,
      [settingsSessionId]: settingsDraft,
    }))
    setSettingsSessionId(null)
  }

  const saveRename = async (id: string) => {
    const title = renameDraft.trim()
    if (!title) return
    try {
      await axios.patch(`/api/ai/${id}`, { title })
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)))
      setRenamingId(null)
      setRenameDraft('')
    } catch {
    }
  }

  const deleteSession = async (id: string) => {
    try {
      await axios.delete(`/api/ai/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (sessionId === id) {
        setSessionId(null)
        setMessages([])
      }
      setRenamingId(null)
      setRenameDraft('')
      setDeleteConfirmId(null)
    } catch {
    }
  }

  const onPickFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files ?? [])
    if (!files.length) return
    const next: UploadItem[] = []
    const extractPdfText = async (file: File): Promise<string> => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const raw = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(raw),
      })
      const pdf = await loadingTask.promise
      const maxPages = Math.min(pdf.numPages, 8)
      let text = ''
      for (let p = 1; p <= maxPages; p += 1) {
        const page = await pdf.getPage(p)
        const content = await page.getTextContent()
        const pageText = content.items.map((item: any) => String(item.str || '')).join(' ')
        text += `\n[Halaman ${p}]\n${pageText}\n`
        if (text.length > 12000) break
      }
      return text.trim().slice(0, 12000)
    }
    const renderPdfPagesAsImages = async (file: File): Promise<string[]> => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const raw = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(raw),
      })
      const pdf = await loadingTask.promise
      const maxPages = Math.min(pdf.numPages, 3)
      const images: string[] = []
      for (let p = 1; p <= maxPages; p += 1) {
        const page = await pdf.getPage(p)
        const viewport = page.getViewport({ scale: 1.4 })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({ canvas, canvasContext: ctx, viewport } as any).promise
        images.push(canvas.toDataURL('image/jpeg', 0.9))
      }
      return images
    }
    for (const file of files.slice(0, 4)) {
      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(String(fr.result || ''))
          fr.onerror = reject
          fr.readAsDataURL(file)
        })
        next.push({ type: 'image', name: file.name, content: dataUrl, mimeType: file.type, preview: dataUrl })
      } else {
        const mime = file.type || 'application/octet-stream'
        const isTextLike =
          mime.startsWith('text/') ||
          /\.(txt|md|csv|json|js|ts|tsx|py)$/i.test(file.name)

        if (isTextLike) {
          const text = await file.text().catch(() => '')
          if (text.trim()) {
            next.push({ type: 'text', name: file.name, content: text.slice(0, 8000), mimeType: mime })
          }
        } else if (/\.pdf$/i.test(file.name) || mime === 'application/pdf') {
          let gotAny = false
          try {
            const pageImages = await renderPdfPagesAsImages(file)
            if (pageImages.length) {
              gotAny = true
              pageImages.forEach((img, idx) => {
                next.push({
                  type: 'image',
                  name: `${file.name} - halaman ${idx + 1}`,
                  mimeType: 'image/jpeg',
                  content: img,
                  preview: img,
                })
              })
            }
          } catch {
          }

          try {
            const pdfText = await extractPdfText(file)
            if (pdfText.trim()) {
              gotAny = true
              next.push({
                type: 'text',
                name: `${file.name} (teks)`,
                mimeType: 'text/plain',
                content: `Ekstrak isi PDF (${file.name}):\n${pdfText}`,
              })
            }
          } catch {
          }

          if (!gotAny) {
            try {
              const pdfDataUrl = await new Promise<string>((resolve, reject) => {
                const fr = new FileReader()
                fr.onload = () => resolve(String(fr.result || ''))
                fr.onerror = reject
                fr.readAsDataURL(file)
              })
              next.push({
                type: 'file',
                name: file.name,
                mimeType: mime,
                content: pdfDataUrl,
              })
            } catch {
              next.push({
                type: 'file',
                name: file.name,
                mimeType: mime,
                content: `File PDF terlampir: ${file.name}. Gagal ekstrak isi PDF.`,
              })
            }
          }
        } else {
          next.push({
            type: 'file',
            name: file.name,
            mimeType: mime,
            content: `File terlampir: ${file.name} (${mime}), ukuran ${(file.size / 1024 / 1024).toFixed(2)} MB.`,
          })
        }
      }
    }
    setUploads((prev) => [...prev, ...next].slice(-4))
    setShowUploadsPanel(true)
    ev.target.value = ''
  }

  const suggestions = [
    'Jelaskan konsep integral dalam kalkulus',
    'Apa perbedaan mitosis dan meiosis?',
    'Bagaimana cara menghitung determinan matriks?',
    'Rangkum konsep hukum Newton',
  ]

  const shouldShowInlineTaskForm = (msg: Message, index: number) => {
    if (msg.role !== 'assistant') return false
    const lower = (msg.content || '').toLowerCase()
    const asksForTaskDetail =
      /(sebelum aku simpan|info ini belum lengkap|kirim format ini|lengkapi dulu)/i.test(lower) &&
      /(judul|mapel|mata pelajaran|deadline)/i.test(lower)
    if (!asksForTaskDetail) return false
    for (let i = index + 1; i < messages.length; i += 1) {
      if (messages[i]?.role === 'assistant') {
        const nextLower = messages[i].content.toLowerCase()
        if (/(konfirmasi dulu ya|sudah ditambahkan|berikut daftar tugas|daftar tugas|simpan tugas)/i.test(nextLower)) {
          return false
        }
      }
    }
    return true
  }

  const extractListModeFromAssistantMessage = (text: string): TaskListModeNav | null => {
    const match = text.match(/Daftar tugas \(([^)]+)\):/i)
    if (!match) return null
    const raw = String(match[1] || '').trim().toLowerCase()
    if (raw === 'all') return 'all'
    if (raw === 'upcoming') return 'upcoming'
    if (raw === 'today') return 'today'
    if (raw === 'tomorrow') return 'tomorrow'
    return null
  }
  const extractListModeFromUserMessage = (text: string): TaskListModeNav | null => {
    const lower = String(text || '').toLowerCase()
    if (/\b(mendatang|upcoming)\b/.test(lower)) return 'upcoming'
    if (/\b(hari ini|hri ini|today)\b/.test(lower)) return 'today'
    if (/\b(besok|bsk|tomorrow)\b/.test(lower)) return 'tomorrow'
    if (/\b(list|daftar)\b.*\b(semua|all)\b|\bsemua\b.*\b(tugas|task|tgs)\b/.test(lower)) return 'all'
    return null
  }

  const listModeOrder: TaskListModeNav[] = ['all', 'upcoming', 'today', 'tomorrow']
  const listModeLabel: Record<TaskListModeNav, string> = {
    all: 'Semua',
    upcoming: 'Mendatang',
    today: 'Hari Ini',
    tomorrow: 'Besok',
  }
  const listModeCommand: Record<TaskListModeNav, string> = {
    all: 'list semua tugas',
    upcoming: 'list tugas mendatang',
    today: 'list tugas hari ini',
    tomorrow: 'list tugas besok',
  }

  const getAdjacentListMode = (current: TaskListModeNav, direction: 'left' | 'right') => {
    const idx = listModeOrder.indexOf(current)
    if (idx < 0) return null
    const nextIdx = direction === 'left' ? idx - 1 : idx + 1
    if (nextIdx < 0 || nextIdx >= listModeOrder.length) return null
    return listModeOrder[nextIdx]
  }

  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]
      if (m.role !== 'assistant') continue
      if (shouldShowInlineTaskForm(m, i)) {
        const signature = `${i}:${m.content.slice(0, 120)}`
        if (signature !== taskFormSignature) {
          setTaskFormSignature(signature)
          setTaskFormCompleted(false)
          setTaskFormError('')
        }
        return
      }
    }
  }, [messages, taskFormSignature])

  const submitInlineTaskForm = async () => {
    if (taskFormCompleted) return
    const title = taskForm.title.trim()
    const subject = taskForm.subject.trim()
    const deadline = taskForm.deadline.trim()
    const status = taskForm.status.trim().toUpperCase()
    const priority = taskForm.priority.trim().toUpperCase()
    if (!title || !subject || !deadline) {
      setTaskFormError('Judul, mapel, dan deadline wajib diisi.')
      return
    }
    if (status && !['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
      setTaskFormError('Status opsional hanya boleh: TODO, IN_PROGRESS, DONE.')
      return
    }
    if (priority && !['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
      setTaskFormError('Prioritas opsional hanya boleh: LOW, MEDIUM, HIGH.')
      return
    }
    setTaskFormError('')
    const reply = await sendMessageText('Tambah tugas lewat form.', {
      taskFormSubmission: {
        title,
        subject,
        deadline,
        ...(status ? { status: status as 'TODO' | 'IN_PROGRESS' | 'DONE' } : {}),
        ...(priority ? { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' } : {}),
      },
    })
    if (reply && /(berhasil disimpan|sudah dibuat|sudah ditambahkan|berhasil dibuat)/i.test(reply)) {
      setTaskFormCompleted(true)
      setTaskFormError('')
      setTaskForm((prev) => ({ ...prev, deadline: '', status: '', priority: '' }))
      return
    }
    setTaskFormError('Tugas belum berhasil disimpan. Coba cek deadline lalu klik Add lagi.')
  }

  const submitInlineTaskEditForm = async () => {
    if (!taskEditForm.targetNo && !taskEditForm.targetTitle) {
      setTaskEditError('Target tugas belum valid.')
      return
    }
    if (!taskEditForm.newTitle.trim() && !taskEditForm.status.trim() && !taskEditForm.deadline.trim()) {
      setTaskEditError('Isi minimal satu perubahan: judul/status/deadline.')
      return
    }
    const edits: string[] = []
    if (taskEditForm.newTitle.trim()) edits.push(`judul jadi "${taskEditForm.newTitle.trim()}"`)
    if (taskEditForm.status.trim()) edits.push(`status jadi ${taskEditForm.status.trim().toUpperCase()}`)
    if (taskEditForm.deadline.trim()) edits.push(`deadline jadi ${taskEditForm.deadline.trim()}`)
    const target = taskEditForm.targetNo ? `tugas ke ${taskEditForm.targetNo}` : `tugas "${taskEditForm.targetTitle}"`
    const cmd = `edit ${target} ${edits.join(', ')}`
    const reply = await sendMessageText(cmd)
    if (reply) {
      setTaskEditError('')
      setTaskEditForm({
        visible: false,
        targetNo: null,
        targetTitle: '',
        newTitle: '',
        status: '',
        deadline: '',
      })
    }
  }

  const groupedSessions = (() => {
    const now = new Date()
    const result: Record<'today' | 'week' | 'monthPlus', ChatSession[]> = {
      today: [],
      week: [],
      monthPlus: [],
    }
    for (const s of sessions) {
      const d = new Date(s.updatedAt)
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 0) result.today.push(s)
      else if (diffDays <= 7) result.week.push(s)
      else result.monthPlus.push(s)
    }
    return result
  })()
  const shortHistoryTitle = (raw: string) => {
    const text = String(raw || '').trim()
    if (!text) return 'Chat tanpa judul'
    return text.length > 18 ? `${text.slice(0, 18)}...` : text
  }

  const renderAssistantContent = (text: string, messageIndex?: number) => {
    const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g
    const parts: Array<{ type: 'text'; content: string } | { type: 'code'; lang: string; code: string }> = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }
      parts.push({
        type: 'code',
        lang: (match[1] || 'text').toLowerCase(),
        code: (match[2] || '').trimEnd(),
      })
      lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) })
    }
    if (!parts.length) {
      parts.push({ type: 'text', content: text })
    }

    const isProbablyCodeLine = (line: string) => {
      const t = line.trim()
      if (!t) return false
      return (
        t.startsWith('//') ||
        t.startsWith('#include') ||
        t.startsWith('import ') ||
        t.startsWith('from ') ||
        t.startsWith('def ') ||
        t.startsWith('class ') ||
        t.startsWith('function ') ||
        t.startsWith('const ') ||
        t.startsWith('let ') ||
        t.startsWith('var ') ||
        t.startsWith('if ') ||
        t.startsWith('for ') ||
        t.startsWith('while ') ||
        t.startsWith('return ') ||
        /[{}();=<>]/.test(t)
      )
    }

    const detectLang = (code: string) => {
      const c = code.toLowerCase()
      if (/^\s*def\s+|print\(|import\s+\w+|from\s+\w+\s+import/m.test(c)) return 'python'
      if (/^\s*<\w+|<\/\w+>/m.test(c)) return 'html'
      if (/^\s*#include|std::|cout|cin|int\s+main/m.test(c)) return 'cpp'
      if (/^\s*public\s+class|system\.out\.println|new\s+\w+\(/m.test(c)) return 'java'
      if (/^\s*const\s+|let\s+|var\s+|=>|console\.log|function\s+/m.test(c)) return 'javascript'
      if (/^\s*select\s+|insert\s+into|update\s+\w+\s+set|delete\s+from/m.test(c)) return 'sql'
      return 'text'
    }

      const renderMarkdownText = (raw: string, keyPrefix: string) => {
      let normalizedRaw = raw
      const hasTaskTable = /\|\s*No\s*\|\s*Judul\s*\|/i.test(raw)
      const isEmptyTaskListReply =
        /tidak ada tugas(?:\s+(?:untuk|di|pada))?/i.test(raw) ||
        /belum ada tugas/i.test(raw) ||
        /daftar tugas kosong/i.test(raw)
      if (
        isEmptyTaskListReply &&
        !hasTaskTable
      ) {
        let inferredMode: TaskListModeNav = 'all'
        if (typeof messageIndex === 'number' && messageIndex > 0) {
          for (let mi = messageIndex - 1; mi >= 0; mi -= 1) {
            const prev = messages[mi]
            if (prev?.role !== 'user') continue
            const guessed = extractListModeFromUserMessage(prev.content)
            if (guessed) inferredMode = guessed
            break
          }
        }
        normalizedRaw = [
          `Daftar tugas (${inferredMode}):`,
          '',
          '| No | Judul | Mapel | Status | Prioritas | Deadline |',
          '|---:|---|---|---|---|---|',
        ].join('\n')
      }

      const lines = normalizedRaw.split('\n')
      const currentListModeInBubble = extractListModeFromAssistantMessage(normalizedRaw)
      const allNonEmpty = lines.filter((l) => l.trim())
      const codeLikeCount = allNonEmpty.filter(isProbablyCodeLine).length
      const shouldRenderAsCode =
        allNonEmpty.length >= 2 &&
        (codeLikeCount / Math.max(allNonEmpty.length, 1) >= 0.6 || allNonEmpty.some((l) => l.trim().startsWith('//')))

      if (shouldRenderAsCode) {
        const code = raw.trimEnd()
        const lang = detectLang(code)
        const html = highlightCode(code, lang)
        const codeKey = `${keyPrefix}-auto-code`
        return (
          <div className="vscode-code-card">
            <div className="vscode-code-head">
              <span className="vscode-lang-tag">{lang}</span>
              <button
                className="vscode-copy-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(code)
                  setCopiedCodeKey(codeKey)
                  setTimeout(() => setCopiedCodeKey((prev) => (prev === codeKey ? null : prev)), 1400)
                }}
                title="Copy code"
              >
                <i className={`bi ${copiedCodeKey === codeKey ? 'bi-check2' : 'bi-clipboard'}`}></i>
                {copiedCodeKey === codeKey ? ' Copied!' : ' Copy'}
              </button>
            </div>
            <pre className="vscode-pre"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
          </div>
        )
      }

      const isTableSeparator = (line: string) => /^\s*\|?[\s:-]+\|[\s|:-]*\s*$/.test(line.trim())
      const isTableRow = (line: string) => line.includes('|')
      const parseRow = (line: string) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())
      const getDeadlineBadgeClass = (value: string) => {
        const raw = String(value || '').trim()
        if (!raw || raw === '-') return 'none'
        const lower = raw.toLowerCase()
        if (/lewat|overdue|terlambat/.test(lower)) return 'overdue'
        if (/hari ini|today|besok|tomorrow|dekat|soon/.test(lower)) return 'soon'
        if (/aman|safe/.test(lower)) return 'safe'

        const monthMap: Record<string, number> = {
          jan: 0, januari: 0, january: 0,
          feb: 1, februari: 1, february: 1,
          mar: 2, maret: 2, march: 2,
          apr: 3, april: 3,
          mei: 4, may: 4,
          jun: 5, juni: 5, june: 5,
          jul: 6, juli: 6, july: 6,
          agu: 7, agt: 7, agustus: 7, aug: 7, august: 7,
          sep: 8, september: 8,
          okt: 9, october: 9, oktober: 9, oct: 9,
          nov: 10, november: 10,
          des: 11, desember: 11, dec: 11, december: 11,
        }
        const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?(?:[,\s]+(\d{1,2})[:.](\d{2}))?/)
        if (!m) return 'safe'
        const day = Number(m[1])
        const monKey = String(m[2] || '').toLowerCase()
        const year = m[3] ? Number(m[3]) : new Date().getFullYear()
        const hour = m[4] ? Number(m[4]) : 23
        const minute = m[5] ? Number(m[5]) : 59
        const month = monthMap[monKey]
        if (Number.isNaN(day) || Number.isNaN(year) || month === undefined) return 'safe'

        const deadline = new Date(year, month, day, hour, minute, 0, 0)
        if (Number.isNaN(deadline.getTime())) return 'safe'
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        const dayAfterTomorrowStart = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000)
        const threeDaysAhead = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)

        if (deadline < now) return 'overdue'
        if (deadline >= todayStart && deadline < dayAfterTomorrowStart) return 'soon'
        if (deadline >= dayAfterTomorrowStart && deadline < threeDaysAhead) return 'soon'
        return 'safe'
      }

      const blocks: React.ReactNode[] = []
      const renderInlineFormatting = (line: string, keyPrefixInline: string) => {
        // Parse bold (**text**) and links ([text](url))
        const tokenRegex = /(\*\*[^*]+\*\*)|\[([^\]]+)\]\(([^)]+)\)/g
        const result: React.ReactNode[] = []
        let lastIdx = 0
        let matchInline: RegExpExecArray | null
        let partIdx = 0

        while ((matchInline = tokenRegex.exec(line)) !== null) {
          // Text before match
          if (matchInline.index > lastIdx) {
            result.push(<span key={`${keyPrefixInline}-t-${partIdx++}`}>{line.slice(lastIdx, matchInline.index)}</span>)
          }

          if (matchInline[1]) {
            // Bold **text**
            const boldText = matchInline[1].slice(2, -2)
            result.push(<strong key={`${keyPrefixInline}-b-${partIdx++}`}>{boldText}</strong>)
          } else if (matchInline[2] && matchInline[3]) {
            // Link [text](url)
            const linkText = matchInline[2]
            const linkUrl = matchInline[3]
            const isInternal = linkUrl.startsWith('/')
            if (isInternal) {
              result.push(
                <a
                  key={`${keyPrefixInline}-a-${partIdx++}`}
                  href={linkUrl}
                  onClick={(ev) => { ev.preventDefault(); router.push(linkUrl) }}
                  className="ai-inline-link"
                >
                  {linkText}
                </a>
              )
            } else {
              result.push(
                <a
                  key={`${keyPrefixInline}-a-${partIdx++}`}
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-inline-link external"
                >
                  {linkText} ↗
                </a>
              )
            }
          }
          lastIdx = tokenRegex.lastIndex
        }

        // Remaining text
        if (lastIdx < line.length) {
          result.push(<span key={`${keyPrefixInline}-t-${partIdx++}`}>{line.slice(lastIdx)}</span>)
        }

        return result.length > 0 ? result : [<span key={`${keyPrefixInline}-raw`}>{line}</span>]
      }
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()

        if (
          i + 1 < lines.length &&
          isTableRow(lines[i]) &&
          isTableSeparator(lines[i + 1])
        ) {
          const header = parseRow(lines[i])
          const headerLower = header.map((h) => h.toLowerCase())
          const statusIdx = headerLower.findIndex((h) => /status/.test(h))
          const deadlineIdx = headerLower.findIndex((h) => /deadline|batas|due/.test(h))
          const titleIdx = headerLower.findIndex((h) => /judul|title/.test(h))
          const noIdx = headerLower.findIndex((h) => /\bno\b|nomor/.test(h))
          const isTaskTable = titleIdx >= 0 && statusIdx >= 0 && deadlineIdx >= 0
          const rows: string[][] = []
          i += 2
          while (i < lines.length && isTableRow(lines[i])) {
            rows.push(parseRow(lines[i]))
            i += 1
          }
          blocks.push(
            <div key={`${keyPrefix}-tbl-${i}`} className="assistant-table-wrap">
              {isTaskTable && (
                <div className="assistant-table-actions-top">
                  <button
                    type="button"
                    className="assistant-table-top-btn"
                    disabled={loading}
                    onClick={() => setInput('bisa tambahkan tugas baru?')}
                  >
                    <i className="bi bi-plus-lg"></i> Add Task
                  </button>
                  <button
                    type="button"
                    className="assistant-table-top-btn danger"
                    disabled={loading || !currentListModeInBubble}
                    onClick={() => {
                      if (!currentListModeInBubble) return
                      void sendMessageText('hapus semua')
                    }}
                    title={currentListModeInBubble ? `Hapus semua di list ${listModeLabel[currentListModeInBubble as TaskListModeNav]}` : 'Hapus list ini'}
                  >
                    <i className="bi bi-trash3"></i> Hapus List
                  </button>
                </div>
              )}
              <table className="assistant-table">
                <thead>
                  <tr>
                    {header.map((h, hi) => <th key={`${keyPrefix}-th-${i}-${hi}`}>{h}</th>)}
                    {isTaskTable && <th>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={`${keyPrefix}-tr-${i}-${ri}`}>
                      {header.map((_, ci) => {
                        const cell = r[ci] || '-'
                        if (ci === statusIdx) {
                          const isDone = /done|selesai|completed/i.test(cell)
                          const isDoneLate = /done late/i.test(cell)
                          const isFailed = /failed/i.test(cell)
                          const isProgress = /progress|in[_\s-]?progress|dikerjakan/i.test(cell)
                          return (
                            <td key={`${keyPrefix}-td-${i}-${ri}-${ci}`}>
                              <span className={`assistant-status-badge ${isFailed || isDoneLate ? 'failed' : isDone ? 'done' : isProgress ? 'progress' : 'todo'}`}>
                                {cell}
                              </span>
                            </td>
                          )
                        }
                        if (ci === deadlineIdx) {
                          const isEmpty = cell === '-' || !cell.trim()
                          const deadlineClass = isEmpty ? 'none' : getDeadlineBadgeClass(cell)
                          return (
                            <td key={`${keyPrefix}-td-${i}-${ri}-${ci}`}>
                              <span className={`assistant-deadline-badge ${deadlineClass}`}>{cell}</span>
                            </td>
                          )
                        }
                        return <td key={`${keyPrefix}-td-${i}-${ri}-${ci}`}>{cell}</td>
                      })}
                      {isTaskTable && (
                        <td key={`${keyPrefix}-td-actions-${i}-${ri}`}>
                          <div className="assistant-task-row-actions">
                            <button
                              type="button"
                              className="assistant-task-action-btn info"
                              disabled={loading}
                              onClick={() => {
                                const noText = noIdx >= 0 ? String(r[noIdx] || '').trim() : ''
                                const no = Number(noText)
                                if (!Number.isNaN(no) && no > 0) {
                                  void sendMessageText(`detail tugas ke ${no}`, {
                                    skipAppendUser: true,
                                    ...(typeof messageIndex === 'number' ? { replaceAssistantIndex: messageIndex } : {}),
                                  })
                                  return
                                }
                                const title = titleIdx >= 0 ? String(r[titleIdx] || '').trim() : ''
                                if (title) {
                                  void sendMessageText(`detail tugas ${title}`, {
                                    skipAppendUser: true,
                                    ...(typeof messageIndex === 'number' ? { replaceAssistantIndex: messageIndex } : {}),
                                  })
                                }
                              }}
                              title="Lihat detail"
                            >
                              <i className="bi bi-info-circle"></i>
                            </button>
                            <button
                              type="button"
                              className="assistant-task-action-btn edit"
                              disabled={loading}
                              onClick={() => {
                                const noText = noIdx >= 0 ? String(r[noIdx] || '').trim() : ''
                                const no = Number(noText)
                                const title = titleIdx >= 0 ? String(r[titleIdx] || '').trim() : ''
                                setTaskEditError('')
                                setTaskEditForm({
                                  visible: true,
                                  targetNo: !Number.isNaN(no) && no > 0 ? no : null,
                                  targetTitle: title,
                                  newTitle: title,
                                  status: '',
                                  deadline: '',
                                })
                              }}
                              title="Edit tugas"
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                            <button
                              type="button"
                              className="assistant-task-action-btn delete"
                              disabled={loading}
                              onClick={() => {
                                const noText = noIdx >= 0 ? String(r[noIdx] || '').trim() : ''
                                const no = Number(noText)
                                if (!Number.isNaN(no) && no > 0) {
                                  void sendMessageText(`hapus tugas ke ${no}`)
                                  return
                                }
                                const title = titleIdx >= 0 ? String(r[titleIdx] || '').trim() : ''
                                if (title) void sendMessageText(`hapus tugas "${title}"`)
                              }}
                              title="Hapus tugas"
                            >
                              <i className="bi bi-trash3"></i>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {taskEditForm.visible && (
                <div className="inline-edit-form-wrap">
                  <div className="inline-edit-form-title">
                    <i className="bi bi-pencil-square"></i> Edit {taskEditForm.targetNo ? `Tugas #${taskEditForm.targetNo}` : taskEditForm.targetTitle || 'Tugas'}
                  </div>
                  <div className="inline-edit-form-grid">
                    <input
                      className="inline-edit-form-input"
                      placeholder="Judul baru (opsional)"
                      value={taskEditForm.newTitle}
                      onChange={(e) => setTaskEditForm((prev) => ({ ...prev, newTitle: e.target.value }))}
                      disabled={loading}
                    />
                    <select
                      className="inline-edit-form-input"
                      value={taskEditForm.status}
                      onChange={(e) => setTaskEditForm((prev) => ({ ...prev, status: e.target.value }))}
                      disabled={loading}
                    >
                      <option value="">Status (opsional)</option>
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="DONE">DONE</option>
                    </select>
                    <input
                      className="inline-edit-form-input"
                      placeholder="Deadline baru (opsional) - contoh: besok jam 20:00"
                      value={taskEditForm.deadline}
                      onChange={(e) => setTaskEditForm((prev) => ({ ...prev, deadline: e.target.value }))}
                      disabled={loading}
                    />
                  </div>
                  {taskEditError && <div className="inline-edit-form-error">{taskEditError}</div>}
                  <div className="inline-edit-form-actions">
                    <button
                      type="button"
                      className="inline-edit-cancel-btn"
                      disabled={loading}
                      onClick={() => {
                        setTaskEditError('')
                        setTaskEditForm({
                          visible: false,
                          targetNo: null,
                          targetTitle: '',
                          newTitle: '',
                          status: '',
                          deadline: '',
                        })
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="inline-edit-save-btn"
                      disabled={loading}
                      onClick={() => void submitInlineTaskEditForm()}
                    >
                      {loading ? 'Menyimpan...' : 'Simpan Edit'}
                    </button>
                  </div>
                </div>
              )}
            </div>,
          )
          continue
        }

        if (!trimmed) {
          blocks.push(<div key={`${keyPrefix}-sp-${i}`} className="md-spacer" />)
          i += 1
          continue
        }
        if (trimmed.startsWith('### ')) {
          blocks.push(<h5 key={`${keyPrefix}-h3-${i}`} className="md-h3">{renderInlineFormatting(trimmed.slice(4), `${keyPrefix}-h3-${i}`)}</h5>)
          i += 1
          continue
        }
        if (trimmed.startsWith('## ')) {
          blocks.push(<h4 key={`${keyPrefix}-h2-${i}`} className="md-h2">{renderInlineFormatting(trimmed.slice(3), `${keyPrefix}-h2-${i}`)}</h4>)
          i += 1
          continue
        }
        if (trimmed.startsWith('# ')) {
          blocks.push(<h3 key={`${keyPrefix}-h1-${i}`} className="md-h1">{renderInlineFormatting(trimmed.slice(2), `${keyPrefix}-h1-${i}`)}</h3>)
          i += 1
          continue
        }
        if (/^[-*]\s+/.test(trimmed)) {
          blocks.push(
            <div key={`${keyPrefix}-li-${i}`} className="md-li">
              {renderInlineFormatting(trimmed.replace(/^[-*]\s+/, '• '), `${keyPrefix}-li-${i}`)}
            </div>,
          )
          i += 1
          continue
        }
        blocks.push(<div key={`${keyPrefix}-p-${i}`} className="md-p">{renderInlineFormatting(line, `${keyPrefix}-p-${i}`)}</div>)
        i += 1
      }

      return <div className="assistant-md-text">{blocks}</div>
    }

    const highlightCode = (code: string, lang: string) => {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value
        }
      } catch {
      }
      return hljs.highlightAuto(code).value
    }

    return (
      <div className="d-flex flex-column gap-2">
        {parts.map((part, idx) => {
          if (part.type === 'text') {
            return (
              <div key={`txt-${idx}`}>{renderMarkdownText(part.content, `txt-${idx}`)}</div>
            )
          }
          const html = highlightCode(part.code, part.lang)
          const codeKey = `code-${idx}`
          return (
            <div key={`code-${idx}`} className="vscode-code-card">
              <div className="vscode-code-head">
                <span className="vscode-lang-tag">{part.lang}</span>
                <button
                  className="vscode-copy-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(part.code)
                    setCopiedCodeKey(codeKey)
                    setTimeout(() => setCopiedCodeKey((prev) => (prev === codeKey ? null : prev)), 1400)
                  }}
                  title="Copy code"
                >
                  <i className={`bi ${copiedCodeKey === codeKey ? 'bi-check2' : 'bi-clipboard'}`}></i>
                  {copiedCodeKey === codeKey ? ' Copied!' : ' Copy'}
                </button>
              </div>
              <pre className="vscode-pre"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />

        <main className="p-0 d-flex flex-column ai-main-shell">

          
          <div className="border-bottom ai-surface px-4 py-3 d-flex justify-content-between align-items-center flex-shrink-0 ai-chat-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.35)', flexShrink: 0 }}>
                <i className="bi bi-robot" style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--sh-text)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>StudyHub AI</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                  <span style={{ fontSize: 11, color: 'var(--sh-muted)', fontWeight: 600 }}>Online · DeepSeek R1</span>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="ai-mode-wrap">
                <div className="ai-mode-row">
                  <i className="bi bi-sliders2-vertical"></i>
                  <select
                    className="ai-mode-select"
                    value={aiMode}
                    onChange={(e) => setAiMode(e.target.value as AiMode)}
                  >
                    <option value="fast">Mode Cepat</option>
                    <option value="detail">Mode Detail</option>
                    <option value="exam">Mode Ujian</option>
                  </select>
                </div>
                <div className="ai-mode-active-desc">
                  {aiMode === 'fast'
                    ? 'Jawaban singkat, langsung inti'
                    : aiMode === 'detail'
                      ? 'Penjelasan bertahap lebih lengkap'
                      : 'Fokus strategi jawab cepat'}
                </div>
              </div>
              <button
                className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setShowHistory((prev) => !prev)}
              >
                <i className="bi bi-clock-history me-1"></i><span className="ai-toolbar-label">{showHistory ? 'Sembunyikan Riwayat' : 'Lihat Riwayat'}</span>
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={newChat}>
                <i className="bi bi-plus-circle me-1"></i><span className="ai-toolbar-label">Chat Baru</span>
              </button>
              <button
                className="btn btn-sm"
                onClick={isCallMode ? endCallMode : startCallMode}
                style={{
                  background: isCallMode ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                <i className={`bi ${isCallMode ? 'bi-telephone-x-fill' : 'bi-telephone-fill'} me-1`}></i>
                <span className="ai-toolbar-label">{isCallMode ? 'Akhiri' : 'Telpon'}</span>
              </button>
            </div>
          </div>

          <div className={`d-flex flex-grow-1 ai-layout ${showHistory ? 'history-open' : 'history-closed'}`} style={{ minHeight: 0 }}>
            <aside className="ai-history-panel border-end ai-surface">
              <div className="px-3 py-2 border-bottom" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Riwayat Chat
              </div>
              <div className="ai-history-scroll" style={{ overflowY: 'auto', maxHeight: '100%' }}>
                {loadingSessions ? (
                  <div className="p-3 text-muted" style={{ fontSize: 12 }}>Memuat riwayat...</div>
                ) : sessionsError ? (
                  <div className="p-3" style={{ fontSize: 12, color: '#b91c1c' }}>{sessionsError}</div>
                ) : sessions.length === 0 ? (
                  <div className="p-3 text-muted" style={{ fontSize: 12 }}>Belum ada chat sebelumnya.</div>
                ) : (
                  <>
                    {[
                      { key: 'today', label: 'Today', data: groupedSessions.today },
                      { key: 'week', label: '1 Week Ago', data: groupedSessions.week },
                      { key: 'monthPlus', label: '1 Month+ Ago', data: groupedSessions.monthPlus },
                    ].map((group) =>
                      group.data.length ? (
                        <div key={group.key} className="ai-history-group">
                          <div className="ai-history-group-label">{group.label}</div>
                          {group.data.map((s) => (
                    <div key={s.id} className={`ai-history-item ${sessionId === s.id ? 'active' : ''}`}>
                      {renamingId === s.id ? (
                        <div className="d-flex gap-1">
                          <input
                            className="form-control form-control-sm"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveRename(s.id)
                            }}
                            autoFocus
                          />
                          <button className="btn btn-sm btn-primary" onClick={() => void saveRename(s.id)}>
                            OK
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="ai-history-row">
                            <button
                              onClick={() => openSession(s.id)}
                              className="ai-history-open"
                            >
                              <div className="ai-history-title">{shortHistoryTitle(s.title || 'Chat tanpa judul')}</div>
                              <div className="ai-history-time">
                                Last modified {new Date(s.updatedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </button>
                            <button
                              className="btn btn-sm btn-link p-0 text-decoration-none ai-rename-btn"
                              onClick={() => startRename(s)}
                              title="Rename chat"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-link p-0 text-decoration-none ai-settings-btn"
                              onClick={() => openSettings(s.id)}
                              title="Chat settings"
                            >
                              <i className="bi bi-gear"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-link p-0 text-decoration-none ai-delete-btn"
                              onClick={() => setDeleteConfirmId(s.id)}
                              title="Hapus chat"
                            >
                              <i className="bi bi-trash3"></i>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                          ))}
                        </div>
                      ) : null,
                    )}
                  </>
                )}
              </div>
            </aside>
            <div
              className={`ai-history-backdrop ${showHistory ? 'show' : ''}`}
              onClick={() => setShowHistory(false)}
            />

            
            <div className="flex-grow-1 overflow-auto px-4 py-3 chat-bg">

            {messages.length === 0 ? (
              <div className="text-center py-5">
                <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 72, height: 72, background: '#ede9fe' }}>
                  <i className="bi bi-robot" style={{ fontSize: 32, color: '#4f46e5' }}></i>
                </div>

                <h5 className="fw-bold mb-2">Halo! Saya StudyHub Bot kamu 👋</h5>

                <p className="text-muted mb-4" style={{ fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
                  Tanyakan apa saja seputar pelajaran — saya siap membantu.
                </p>

                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  {suggestions.map((s, i) => (
                    <button key={i}
                      className="btn btn-sm btn-outline-primary"
                      style={{ fontSize: 13, borderRadius: 20 }}
                      onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3" style={{ maxWidth: 760, margin: '0 auto' }}>

                {messages.map((msg, i) => (
                  <div key={i} className={`d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>

                    {msg.role === 'assistant' && (
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 me-2 align-self-end"
                        style={{
                          width: 32,
                          height: 32,
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.4)'
                        }}>
                        <i className="bi bi-robot"></i>
                      </div>
                    )}

                    <div
                      className={`px-3 py-2 chat-message-shell ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
                      style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      <div className="message-content-row">
                        <div className="message-content-text">
                          {msg.role === 'assistant' ? renderAssistantContent(msg.content, i) : msg.content}
                          {shouldShowInlineTaskForm(msg, i) && (
                            <div className={`inline-task-form-wrap mt-2 ${taskFormCompleted ? 'completed' : loading ? 'processing' : ''}`}>
                              <div className="inline-task-form-grid">
                                <input
                                  className="inline-task-form-input"
                                  placeholder="Judul tugas (wajib)"
                                  value={taskForm.title}
                                  onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                                  disabled={loading || taskFormCompleted}
                                />
                                <input
                                  className="inline-task-form-input"
                                  placeholder="Mapel (wajib)"
                                  value={taskForm.subject}
                                  onChange={(e) => setTaskForm((prev) => ({ ...prev, subject: e.target.value }))}
                                  disabled={loading || taskFormCompleted}
                                />
                                <input
                                  className="inline-task-form-input"
                                  placeholder="Deadline (wajib) - contoh: besok jam 19:00"
                                  value={taskForm.deadline}
                                  onChange={(e) => setTaskForm((prev) => ({ ...prev, deadline: e.target.value }))}
                                  disabled={loading || taskFormCompleted}
                                />
                                <select
                                  className="inline-task-form-input"
                                  value={taskForm.status}
                                  onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}
                                  disabled={loading || taskFormCompleted}
                                >
                                  <option value="">Status (opsional)</option>
                                  <option value="TODO">TODO</option>
                                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                                  <option value="DONE">DONE</option>
                                </select>
                                <select
                                  className="inline-task-form-input"
                                  value={taskForm.priority}
                                  onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                                  disabled={loading || taskFormCompleted}
                                >
                                  <option value="">Prioritas (opsional)</option>
                                  <option value="LOW">LOW</option>
                                  <option value="MEDIUM">MEDIUM</option>
                                  <option value="HIGH">HIGH</option>
                                </select>
                              </div>
                              {taskFormError && <div className="inline-task-form-error">{taskFormError}</div>}
                              {taskFormCompleted && <div className="inline-task-form-success">Form terkunci karena tugas sudah berhasil disimpan.</div>}
                              <div className="mt-2 d-flex justify-content-end">
                                <button
                                  className="inline-task-form-add-btn"
                                  type="button"
                                  disabled={loading || taskFormCompleted}
                                  onClick={() => void submitInlineTaskForm()}
                                >
                                  {taskFormCompleted ? 'Saved' : loading ? 'Processing...' : 'Add'}
                                </button>
                              </div>
                            </div>
                          )}
                          {msg.role === 'assistant' && extractListModeFromAssistantMessage(msg.content) && (
                            (() => {
                              const currentMode = extractListModeFromAssistantMessage(msg.content) as TaskListModeNav
                              const leftMode = getAdjacentListMode(currentMode, 'left')
                              const rightMode = getAdjacentListMode(currentMode, 'right')
                              return (
                                <div className="task-list-nav-wrap mt-2">
                                  <button
                                    type="button"
                                    className="task-list-nav-btn"
                                    disabled={loading || !leftMode}
                                    onClick={() => leftMode ? void sendMessageText(listModeCommand[leftMode], {
                                      skipAppendUser: true,
                                      replaceAssistantIndex: i,
                                    }) : undefined}
                                  >
                                    <i className="bi bi-chevron-left"></i> {leftMode ? listModeLabel[leftMode] : '—'}
                                  </button>
                                  <span className="task-list-nav-current">{listModeLabel[currentMode]}</span>
                                  <button
                                    type="button"
                                    className="task-list-nav-btn"
                                    disabled={loading || !rightMode}
                                    onClick={() => rightMode ? void sendMessageText(listModeCommand[rightMode], {
                                      skipAppendUser: true,
                                      replaceAssistantIndex: i,
                                    }) : undefined}
                                  >
                                    {rightMode ? listModeLabel[rightMode] : '—'} <i className="bi bi-chevron-right"></i>
                                  </button>
                                </div>
                              )
                            })()
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="message-actions">
                            <button
                              className="chat-action-btn"
                              title="Edit pesan ini"
                              onClick={() => {
                                setInput(msg.content)
                                setEditIndex(i)
                              }}
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (msg.attachments?.length ?? 0) > 0 && (
                        <div className="mt-2 d-flex flex-wrap gap-2">
                          {msg.attachments?.map((att, idx) => (
                            <div key={`${att.name}-${idx}`}>
                              {att.type === 'image' ? (
                                <img
                                  src={att.preview || att.content}
                                  alt={att.name}
                                  className="chat-image-thumb"
                                  onClick={() => setPreviewImage(att.preview || att.content)}
                                />
                              ) : (
                                <div className="chat-file-chip">📄 {att.name}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                ))}

                {loading && (
                  <div className="d-flex align-items-center gap-2">
                    <div className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: 32,
                        height: 32,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white'
                      }}>
                      <i className="bi bi-robot"></i>
                    </div>

                    <div className="chat-bubble-ai px-3 py-2">
                      <div className="d-flex gap-1 align-items-center" style={{ height: 20 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i}
                            className="rounded-circle bg-secondary"
                            style={{
                              width: 6,
                              height: 6,
                              opacity: 0.5,
                              animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`
                            }}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
            </div>
          </div>

          
          <div
            className={`border-top ai-surface px-4 py-3 flex-shrink-0 chat-input-footer ${showHistory ? 'history-open' : 'history-closed'}`}
            style={{ paddingBottom: `calc(8px + env(safe-area-inset-bottom) + ${keyboardInset}px)` }}
          >
            <div className={`ai-input-wrap ${showHistory ? 'history-open' : 'history-closed'}`}>
              {editIndex !== null && (
                <div className="mb-2 d-flex align-items-center justify-content-between gap-2">
                  <div className="small text-primary fw-semibold">
                    Mode edit aktif - kirim untuk replace dari pesan itu.
                  </div>
                  <button
                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                    onClick={() => {
                      setEditIndex(null)
                      setInput('')
                    }}
                  >
                    Batal Edit
                  </button>
                </div>
              )}
              <form
                className="chat-input-shell"
                ref={toolsMenuRef}
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendMessage()
                }}
              >
                <button
                  className="chat-tool-plus"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowToolsMenu((prev) => !prev)
                  }}
                  title="Buka menu tools"
                >
                  <i className="bi bi-plus-lg"></i>
                </button>
                <div className={`chat-tools-menu ${showToolsMenu ? 'show' : ''}`}>
                  <button
                    className="chat-tools-menu-item"
                    type="button"
                    onClick={() => {
                      setShowToolsMenu(false)
                      fileInputRef.current?.click()
                    }}
                  >
                    <i className="bi bi-paperclip"></i>
                    <span>Upload Photo & Files</span>
                  </button>
                </div>
                {uploads.length > 0 && (
                  <div
                    className="upload-toggle-wrap"
                    onMouseEnter={() => setShowUploadsPanel(true)}
                    onMouseLeave={() => setShowUploadsPanel(false)}
                  >
                    <button
                      className="upload-toggle-btn"
                      type="button"
                      onClick={() => setShowUploadsPanel((p) => !p)}
                      title="Lihat lampiran"
                    >
                      <i className="bi bi-paperclip"></i> {uploads.length}
                    </button>
                    <div className={`upload-floating-panel ${showUploadsPanel ? 'show' : ''}`}>
                      <div className="upload-preview-wrap">
                        {uploads.map((u, idx) => (
                          <div key={`${u.name}-${idx}`} className="upload-preview-card">
                            {u.type === 'image' ? (
                              <img src={u.preview || u.content} alt={u.name} className="upload-preview-image" />
                            ) : (
                              <div className="upload-preview-file-icon">📄</div>
                            )}
                            <div className="upload-preview-meta">
                              <div className="upload-preview-name">{u.name}</div>
                              <div className="upload-preview-type">
                                {u.type === 'image' ? 'Gambar' : u.type === 'text' ? 'File teks' : 'File/PDF/Video'}
                              </div>
                            </div>
                            <button
                              className="upload-preview-remove"
                              title="Hapus lampiran"
                              onClick={() => setUploads((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <textarea
                  className="chat-composer-input"
                  placeholder="Tanyakan soal atau materi..."
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  style={{ resize: 'none' }}
                />
                <button
                  className="chat-send-btn"
                  type="submit"
                  onClick={loading ? stopAssistant : undefined}
                  disabled={!loading && !input.trim() && uploads.length === 0}
                  title={loading ? 'Stop respons AI' : 'Kirim pesan'}
                >
                  {loading
                    ? <i className="bi bi-stop-fill"></i>
                    : <i className="bi bi-send-fill"></i>}
                </button>
              </form>

              <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                <i className="bi bi-shield-check me-1"></i>
                AI dapat membuat kesalahan. Selalu verifikasi jawaban penting.
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.tsx,.py,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                className="d-none"
                onChange={(e) => void onPickFile(e)}
              />
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        .chat-bg {
          background:
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(79,70,229,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 70%, rgba(14,165,233,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 40% 35% at 60% 10%, rgba(124,58,237,0.05) 0%, transparent 50%),
            var(--sh-bg);
          background-attachment: fixed;
        }
        .ai-surface {
          background: var(--sh-card-bg);
          border-color: var(--sh-border) !important;
        }
        .ai-modal-surface {
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
        }
        .ai-main-shell {
          height: calc(100vh - 65px);
          height: calc(100dvh - 65px);
          min-height: 0;
        }
        .ai-chat-toolbar {
          flex-wrap: wrap;
          gap: 8px;
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        
        .chat-bubble-user {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border-radius: 20px 20px 6px 20px;
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 8px 24px rgba(79,70,229,0.30), 0 2px 8px rgba(79,70,229,0.15);
          max-width: min(76%, 720px);
          transition: box-shadow 0.2s ease, transform 0.2s ease;
          padding-right: 42px !important;
        }

        .chat-bubble-user:hover {
          box-shadow: 0 12px 32px rgba(79,70,229,0.38);
          transform: translateY(-1px);
        }

        .chat-bubble-ai {
          background: var(--sh-card-bg);
          color: var(--sh-text);
          border-radius: 20px 20px 20px 6px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04);
          border: 1px solid var(--sh-border);
          max-width: min(82%, 760px);
          backdrop-filter: blur(8px);
        }

        
        .chat-bubble-user,
        .chat-bubble-ai {
          animation: fadeUp 0.25s ease;
        }
        .ai-mode-wrap {
          border: 1px solid #dbe2ea;
          background: #ffffff;
          border-radius: 12px;
          padding: 4px 8px;
          min-width: 205px;
          box-shadow: 0 4px 10px rgba(15,23,42,0.05);
        }
        .ai-mode-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ai-mode-row i {
          font-size: 12px;
          color: #64748b;
        }
        .ai-mode-select {
          border: 0;
          background: transparent;
          font-size: 12.5px;
          font-weight: 700;
          color: #1f2937;
          width: 100%;
          outline: none;
          cursor: pointer;
        }
        .ai-mode-active-desc {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 1px;
          line-height: 1.2;
        }
        .ai-layout {
          position: relative;
          min-width: 0;
          overflow-x: hidden;
        }
        .ai-history-panel {
          width: 248px;
          min-width: 248px;
          display: flex;
          flex-direction: column;
          box-shadow: inset -1px 0 0 #e2e8f0;
          transition: all 0.22s ease;
          z-index: 4;
        }
        .ai-layout.history-closed .ai-history-panel {
          width: 0;
          min-width: 0;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .ai-history-backdrop { display: none; }
        .ai-history-item {
          border-bottom: 1px solid #f1f5f9;
          background: var(--sh-card-bg);
          padding: 10px 12px;
          overflow: hidden;
        }
        .ai-history-scroll {
          scrollbar-width: thin;
          scrollbar-color: #93c5fd transparent;
        }
        .ai-history-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .ai-history-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .ai-history-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: linear-gradient(180deg, #93c5fd, #818cf8);
          border: 1px solid rgba(255, 255, 255, 0.45);
        }
        .ai-history-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #60a5fa, #6366f1);
        }
        .ai-history-group {
          border-bottom: 1px solid #eef2f7;
        }
        .ai-history-group-label {
          position: sticky;
          top: 0;
          z-index: 2;
          background: color-mix(in srgb, var(--sh-card-bg) 90%, #64748b 10%);
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 6px 12px;
          border-top: 1px solid #eef2f7;
          border-bottom: 1px solid #eef2f7;
        }
        .ai-history-open {
          width: auto;
          flex: 1 1 auto;
          min-width: 0;
          text-align: left;
          border: 0;
          background: transparent;
          padding: 0;
          margin-bottom: 0;
        }
        .ai-history-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .ai-history-item:hover { background: #f8faff; }
        .ai-history-item.active { background: color-mix(in srgb, var(--sh-card-bg) 82%, #6366f1 18%); }
        .ai-rename-btn {
          opacity: 0;
          transition: opacity 0.18s ease;
          color: #64748b;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ai-delete-btn {
          opacity: 0;
          transition: opacity 0.18s ease;
          color: #94a3b8;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ai-settings-btn {
          opacity: 0;
          transition: opacity 0.18s ease;
          color: #8b5cf6;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ai-history-item:hover .ai-rename-btn,
        .ai-history-item.active .ai-rename-btn,
        .ai-history-item:hover .ai-settings-btn,
        .ai-history-item.active .ai-settings-btn,
        .ai-history-item:hover .ai-delete-btn,
        .ai-history-item.active .ai-delete-btn {
          opacity: 1;
        }
        .ai-delete-btn:hover {
          color: #dc2626;
        }
        .ai-history-title {
          font-size: 12.5px;
          color: #1f2937;
          font-weight: 600;
          white-space: normal;
          line-height: 1.2;
          max-height: 2.4em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          word-break: break-word;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ai-history-time {
          margin-top: 2px;
          font-size: 11px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ai-input-wrap {
          max-width: 860px;
          width: min(860px, 100%);
          margin-left: auto;
          margin-right: auto;
          transition: width 0.22s ease;
        }
        .ai-input-wrap.history-closed {
          width: min(860px, 100%);
        }
        .chat-input-footer.history-open {
          padding-left: calc(1.5rem + 248px) !important;
        }
        .chat-input-footer.history-closed {
          padding-left: 1.5rem !important;
        }
        .message-actions {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease;
          position: absolute;
          top: 6px;
          right: 6px;
        }
        .chat-bubble-user:hover .message-actions,
        .chat-bubble-user:focus-within .message-actions {
          opacity: 1;
          pointer-events: auto;
        }
        .message-content-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .message-content-text {
          min-width: 0;
          flex: 1;
        }
        .chat-message-shell {
          position: relative;
        }
        .chat-action-btn {
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,0.45);
          background: rgba(15, 23, 42, 0.22);
          color: #ffffff;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-size: 12px;
          line-height: 1;
          transition: all 0.18s ease;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
          cursor: pointer;
        }
        .chat-action-btn:hover {
          transform: scale(1.06);
          color: #ffffff;
          border-color: rgba(255,255,255,0.68);
          background: rgba(15, 23, 42, 0.36);
        }
        .chat-action-btn i {
          font-size: 14px;
          line-height: 1;
        }
        @media (hover: none) {
          .message-actions {
            opacity: 1;
            pointer-events: auto;
          }
        }
        .chat-image-thumb {
          width: 130px;
          height: 96px;
          object-fit: cover;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
          background: rgba(255,255,255,0.15);
          cursor: zoom-in;
          transition: transform 0.15s ease;
        }
        .chat-image-thumb:hover {
          transform: scale(1.02);
        }
        .chat-file-chip {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
        }
        .upload-preview-wrap {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 8px;
        }
        .chat-input-shell {
          position: relative;
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 16px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
        }
        .chat-tool-plus {
          width: 30px;
          height: 30px;
          border: 1px solid #818cf8;
          background: #4f46e5;
          color: #ffffff;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-size: 15px;
          transition: all 0.16s ease;
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          box-shadow: 0 6px 14px rgba(79, 70, 229, 0.32);
        }
        .chat-tool-plus:hover {
          border-color: #a5b4fc;
          background: #4338ca;
        }
        .chat-composer-input {
          width: 100%;
          border: 0;
          border-radius: 16px;
          min-height: 50px;
          max-height: 140px;
          padding: 12px 52px 12px 84px;
          font-size: 14px;
          line-height: 1.45;
          color: #0f172a;
          background: transparent;
          min-width: 0;
        }
        .chat-composer-input::placeholder {
          color: #94a3b8;
        }
        .chat-composer-input:focus {
          outline: none;
          box-shadow: inset 0 0 0 2px #c7d2fe;
        }
        .chat-send-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 0;
          background: #4f46e5;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          transition: all 0.15s ease;
        }
        .chat-send-btn:disabled {
          background: #cbd5e1;
          color: #f8fafc;
        }
        .chat-send-btn:not(:disabled):hover {
          background: #4338ca;
          transform: translateY(-50%) scale(1.04);
        }
        .chat-tools-menu {
          position: absolute;
          bottom: 44px;
          left: 6px;
          min-width: 210px;
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16);
          opacity: 0;
          transform: translateY(-6px);
          pointer-events: none;
          transition: all 0.16s ease;
          z-index: 16;
        }
        .chat-tools-menu.show {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .chat-tools-menu-item {
          width: 100%;
          border: 0;
          background: transparent;
          border-radius: 8px;
          height: 34px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          padding: 0 10px;
          text-align: left;
        }
        .chat-tools-menu-item:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .upload-toggle-wrap {
          position: absolute;
          left: 46px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
        }
        .upload-toggle-btn {
          height: 28px;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: var(--sh-card-bg);
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .upload-toggle-btn:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }
        .upload-floating-panel {
          position: absolute;
          left: -40px;
          bottom: 36px;
          width: min(440px, 72vw);
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 12px;
          padding: 8px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
          opacity: 0;
          pointer-events: none;
          transform: translateY(6px);
          transition: all 0.16s ease;
          z-index: 24;
        }
        .upload-floating-panel.show {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .upload-preview-card {
          border: 1px solid var(--sh-border);
          background: color-mix(in srgb, var(--sh-card-bg) 92%, #64748b 8%);
          border-radius: 12px;
          padding: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 64px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }
        .upload-preview-image {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid #e2e8f0;
          flex-shrink: 0;
        }
        .upload-preview-file-icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef2ff;
          border: 1px solid #dbeafe;
          flex-shrink: 0;
          font-size: 20px;
        }
        .upload-preview-meta {
          min-width: 0;
          flex: 1;
        }
        .upload-preview-name {
          font-size: 12px;
          color: #1f2937;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .upload-preview-type {
          font-size: 11px;
          color: #64748b;
        }
        .upload-preview-remove {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: all 0.15s ease;
        }
        .upload-preview-remove:hover {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fff1f2;
        }
        .vscode-code-card {
          border: 1px solid #2b3341;
          border-radius: 10px;
          overflow: hidden;
          background: #1e1e1e;
          margin-top: 2px;
        }
        .vscode-code-head {
          height: 30px;
          background: #252526;
          border-bottom: 1px solid #2d2d2d;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
        }
        .vscode-lang-tag {
          font-size: 11px;
          color: #c5c5c5;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .vscode-copy-btn {
          border: 1px solid #3b3b3b;
          background: #2d2d2d;
          color: #d4d4d4;
          border-radius: 6px;
          height: 22px;
          padding: 0 8px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .vscode-copy-btn:hover {
          background: #3a3a3a;
        }
        .vscode-pre {
          margin: 0;
          padding: 10px 12px;
          font-size: 12.5px;
          line-height: 1.5;
          color: #d4d4d4;
          overflow-x: auto;
        }
        .assistant-md-text {
          white-space: normal;
        }
        .md-h1 {
          font-size: 20px;
          line-height: 1.35;
          font-weight: 800;
          margin: 0 0 6px 0;
          color: inherit;
        }
        .md-h2 {
          font-size: 18px;
          line-height: 1.35;
          font-weight: 760;
          margin: 0 0 6px 0;
          color: inherit;
        }
        .md-h3 {
          font-size: 16px;
          line-height: 1.35;
          font-weight: 720;
          margin: 0 0 6px 0;
          color: inherit;
        }
        .md-p, .md-li {
          white-space: pre-wrap;
          margin: 0;
        }
        .md-li {
          padding-left: 2px;
        }
        .md-spacer {
          height: 8px;
        }
        .ai-inline-link {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          color: #4f46e5;
          background: rgba(79, 70, 229, 0.08);
          padding: 2px 10px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 12.5px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.18s ease;
          border: 1px solid rgba(79, 70, 229, 0.15);
        }
        .ai-inline-link:hover {
          background: rgba(79, 70, 229, 0.16);
          color: #3730a3;
          border-color: rgba(79, 70, 229, 0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
        }
        .ai-inline-link.external {
          color: #0284c7;
          background: rgba(2, 132, 199, 0.08);
          border-color: rgba(2, 132, 199, 0.15);
        }
        .ai-inline-link.external:hover {
          background: rgba(2, 132, 199, 0.16);
          color: #0369a1;
          border-color: rgba(2, 132, 199, 0.3);
        }
        :root[data-theme='dark'] .ai-inline-link {
          color: #a5b4fc;
          background: rgba(165, 180, 252, 0.12);
          border-color: rgba(165, 180, 252, 0.2);
        }
        :root[data-theme='dark'] .ai-inline-link:hover {
          background: rgba(165, 180, 252, 0.22);
          color: #c7d2fe;
        }
        :root[data-theme='dark'] .ai-inline-link.external {
          color: #7dd3fc;
          background: rgba(125, 211, 252, 0.12);
          border-color: rgba(125, 211, 252, 0.2);
        }
        .assistant-table-wrap {
          margin: 4px 0 2px;
          border: 1px solid var(--sh-border);
          border-radius: 10px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          background: var(--sh-card-bg);
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 transparent;
        }
        .assistant-table-wrap::-webkit-scrollbar {
          height: 8px;
        }
        .assistant-table-wrap::-webkit-scrollbar-track {
          background: transparent;
        }
        .assistant-table-wrap::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #93c5fd, #a5b4fc);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .assistant-table-wrap::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #60a5fa, #818cf8);
        }
        .assistant-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .assistant-table thead th {
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 10px;
          text-align: left;
          white-space: nowrap;
        }
        .assistant-table tbody td {
          border-top: 1px solid #eef2f7;
          padding: 7px 10px;
          color: #0f172a;
          vertical-align: top;
        }
        .assistant-table tbody tr:nth-child(even) td {
          background: #fcfdff;
        }
        .assistant-table-actions-top {
          padding: 8px 10px;
          border-bottom: 1px solid var(--sh-border);
          background: color-mix(in srgb, var(--sh-card-bg) 93%, #0ea5e9 7%);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          width: 100%;
          min-width: 760px;
        }
        .assistant-table-top-btn {
          border: 1px solid var(--sh-border);
          background: var(--sh-card-bg);
          color: var(--sh-text);
          min-height: 30px;
          border-radius: 9px;
          padding: 0 10px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .assistant-table-top-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .assistant-table-top-btn.danger {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fff1f2;
        }
        .assistant-task-row-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .assistant-task-action-btn {
          border: 1px solid var(--sh-border);
          background: var(--sh-card-bg);
          color: var(--sh-text);
          width: 28px;
          min-width: 28px;
          height: 28px;
          border-radius: 8px;
          padding: 0;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .assistant-task-action-btn.info {
          color: #0369a1;
          border-color: #bae6fd;
          background: #f0f9ff;
        }
        .assistant-task-action-btn.edit {
          color: #7c3aed;
          border-color: #ddd6fe;
          background: #f5f3ff;
        }
        .assistant-task-action-btn.delete {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fff1f2;
        }
        .assistant-task-action-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .inline-edit-form-wrap {
          border-top: 1px solid var(--sh-border);
          margin-top: 8px;
          padding: 10px;
          background: color-mix(in srgb, var(--sh-card-bg) 93%, #a78bfa 7%);
        }
        .inline-edit-form-title {
          font-size: 12px;
          font-weight: 800;
          color: var(--sh-text);
          margin-bottom: 8px;
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
        .inline-edit-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .inline-edit-form-input {
          width: 100%;
          min-height: 34px;
          border: 1px solid var(--sh-border);
          border-radius: 9px;
          background: var(--sh-card-bg);
          color: var(--sh-text);
          padding: 8px 10px;
          font-size: 12.5px;
        }
        .inline-edit-form-input:focus {
          outline: none;
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        }
        .inline-edit-form-error {
          font-size: 12px;
          color: #b91c1c;
          margin-top: 8px;
          font-weight: 700;
        }
        .inline-edit-form-actions {
          margin-top: 10px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .inline-edit-cancel-btn,
        .inline-edit-save-btn {
          min-height: 32px;
          border-radius: 9px;
          border: 1px solid var(--sh-border);
          padding: 0 12px;
          font-size: 12px;
          font-weight: 700;
          background: var(--sh-card-bg);
          color: var(--sh-text);
        }
        .inline-edit-save-btn {
          background: #4f46e5;
          border-color: #4f46e5;
          color: #fff;
        }
        .inline-edit-save-btn:disabled,
        .inline-edit-cancel-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .assistant-status-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .assistant-status-badge.done {
          background: #dcfce7;
          color: #166534;
        }
        .assistant-status-badge.progress {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .assistant-status-badge.todo {
          background: #fef3c7;
          color: #92400e;
        }
        .assistant-status-badge.failed {
          background: #fee2e2;
          color: #991b1b;
        }
        .assistant-deadline-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          border-radius: 8px;
          padding: 2px 8px;
          background: #eef2ff;
          color: #3730a3;
        }
        .assistant-deadline-badge.none {
          background: #f1f5f9;
          color: #64748b;
        }
        .assistant-deadline-badge.overdue {
          background: #fee2e2;
          color: #991b1b;
        }
        .assistant-deadline-badge.soon {
          background: #fef3c7;
          color: #92400e;
        }
        .assistant-deadline-badge.safe {
          background: #dcfce7;
          color: #166534;
        }
        .inline-task-form-wrap {
          margin-top: 10px;
          border: 1px solid var(--sh-border);
          border-radius: 12px;
          padding: 10px;
          background: color-mix(in srgb, var(--sh-card-bg) 94%, #6366f1 6%);
        }
        .inline-task-form-wrap.completed {
          filter: blur(1.3px) saturate(0.7);
          opacity: 0.75;
          pointer-events: none;
          user-select: none;
        }
        .inline-task-form-wrap.processing {
          filter: blur(1.1px);
          opacity: 0.82;
          pointer-events: none;
          user-select: none;
        }
        .inline-task-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .inline-task-form-input {
          width: 100%;
          border: 1px solid var(--sh-border);
          border-radius: 10px;
          min-height: 36px;
          padding: 8px 10px;
          font-size: 12.5px;
          line-height: 1.3;
          background: var(--sh-card-bg);
          color: var(--sh-text);
        }
        .inline-task-form-input:focus {
          outline: none;
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.14);
        }
        .inline-task-form-error {
          margin-top: 8px;
          font-size: 12px;
          color: #b91c1c;
          font-weight: 600;
        }
        .inline-task-form-success {
          margin-top: 8px;
          font-size: 12px;
          color: #166534;
          font-weight: 700;
        }
        .inline-task-form-add-btn {
          border: 0;
          min-height: 34px;
          border-radius: 10px;
          background: #4f46e5;
          color: #fff;
          font-size: 12.5px;
          font-weight: 700;
          padding: 0 14px;
        }
        .inline-task-form-add-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        .inline-task-form-add-btn:not(:disabled):hover {
          background: #4338ca;
        }
        .task-list-nav-wrap {
          margin-top: 10px;
          border: 1px solid var(--sh-border);
          background: color-mix(in srgb, var(--sh-card-bg) 94%, #0ea5e9 6%);
          border-radius: 12px;
          padding: 8px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 8px;
          align-items: center;
        }
        .task-list-nav-btn {
          border: 1px solid var(--sh-border);
          background: var(--sh-card-bg);
          color: var(--sh-text);
          min-height: 32px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .task-list-nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .task-list-nav-current {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
        }
        :root[data-theme='dark'] .task-list-nav-current {
          color: #e5e7eb;
        }
        @media (max-width: 1200px) {
          .ai-mode-wrap {
            display: none;
          }
          .ai-history-panel {
            width: 220px;
            min-width: 220px;
          }
          .ai-input-wrap {
            max-width: 820px;
          }
          .chat-input-footer.history-open {
            padding-left: calc(1.5rem + 220px) !important;
          }
        }
        @media (max-width: 992px) {
          .ai-history-panel {
            width: 190px;
            min-width: 190px;
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: var(--sh-card-bg);
            box-shadow: 8px 0 24px rgba(15, 23, 42, 0.12);
          }
          .ai-input-wrap {
            width: 100%;
            max-width: 760px;
          }
          .chat-input-footer.history-open,
          .chat-input-footer.history-closed {
            padding-left: 1.5rem !important;
          }
          .ai-layout.history-closed .ai-history-panel {
            transform: translateX(-100%);
          }
          .ai-layout.history-open .ai-history-panel {
            transform: translateX(0);
            opacity: 1;
            pointer-events: auto;
            width: 190px;
            min-width: 190px;
          }
          .ai-history-backdrop.show {
            display: block;
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.24);
            z-index: 3;
          }
        }
        :root[data-theme='dark'] .chat-bg {
          background:
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(79,70,229,0.14) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 70%, rgba(14,165,233,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 40% 35% at 60% 10%, rgba(124,58,237,0.10) 0%, transparent 50%),
            #080b14;
          background-attachment: fixed;
        }
        :root[data-theme='dark'] .chat-bubble-ai {
          background: rgba(17,24,39,0.85);
          color: var(--sh-text);
          border-color: rgba(255,255,255,0.07);
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2);
        }
        :root[data-theme='dark'] .chat-bubble-user {
          box-shadow: 0 8px 28px rgba(79,70,229,0.4), 0 2px 8px rgba(79,70,229,0.2);
        }
        :root[data-theme='dark'] .chat-composer-input,
        :root[data-theme='dark'] .chat-tools-menu-item,
        :root[data-theme='dark'] .upload-preview-name,
        :root[data-theme='dark'] .ai-history-title {
          color: var(--sh-text);
        }
        :root[data-theme='dark'] .ai-mode-wrap {
          background: var(--sh-card-bg);
          border-color: var(--sh-border);
        }
        :root[data-theme='dark'] .ai-mode-select,
        :root[data-theme='dark'] .ai-mode-active-desc {
          color: var(--sh-text);
        }
        :root[data-theme='dark'] .assistant-table thead th {
          background: color-mix(in srgb, var(--sh-card-bg) 84%, #334155 16%);
          color: #e2e8f0;
          border-bottom-color: var(--sh-border);
        }
        :root[data-theme='dark'] .assistant-table tbody td {
          color: #e5e7eb;
          border-top-color: var(--sh-border);
        }
        :root[data-theme='dark'] .assistant-table tbody tr:nth-child(even) td {
          background: color-mix(in srgb, var(--sh-card-bg) 90%, #0f172a 10%);
        }
        :root[data-theme='dark'] .assistant-table-wrap {
          border-color: var(--sh-border);
        }
        @media (max-width: 768px) {
          .ai-main-shell {
            height: calc(100dvh - 78px);
          }
          .ai-chat-toolbar {
            padding: 10px 12px !important;
            position: sticky;
            top: 0;
            z-index: 5;
          }
          .ai-toolbar-label {
            display: none;
          }
          .ai-chat-toolbar .btn {
            width: 36px;
            height: 36px;
            padding: 0 !important;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
          }
          .chat-bg {
            overflow-x: hidden;
            padding: 10px 10px 14px !important;
          }
          .ai-history-panel {
            width: min(82vw, 280px);
            min-width: min(82vw, 280px);
          }
          .ai-history-row {
            gap: 6px;
          }
          .ai-rename-btn,
          .ai-settings-btn,
          .ai-delete-btn {
            opacity: 1;
          }
          .ai-input-wrap {
            width: 100%;
            max-width: 760px;
          }
          .chat-input-footer {
            padding: 8px 10px calc(8px + env(safe-area-inset-bottom)) !important;
          }
          .chat-bubble-user {
            max-width: 90%;
            padding-right: 38px !important;
          }
          .chat-bubble-ai {
            max-width: 95%;
          }
          .upload-floating-panel {
            width: min(320px, 90vw);
            left: -60px;
          }
          .chat-composer-input {
            min-height: 46px;
            font-size: 16px;
            padding-left: 78px;
          }
          .chat-tool-plus {
            left: 8px;
          }
          .upload-toggle-wrap {
            left: 42px;
          }
          .chat-send-btn {
            right: 6px;
          }
        }
        @supports (-webkit-touch-callout: none) {
          .ai-main-shell {
            min-height: calc(100dvh - 65px);
          }
          .chat-input-footer {
            padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

      `}</style>
      {settingsSessionId && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(2,6,23,0.56)', zIndex: 1091 }}
          onClick={() => setSettingsSessionId(null)}
        >
          <div
            className="ai-modal-surface rounded-4 p-4 shadow"
            style={{ width: 'min(94vw, 500px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fw-semibold mb-3" style={{ color: '#0f172a' }}>Chat Settings</div>
            <div className="d-grid gap-2">
              <div>
                <label className="form-label mb-1" style={{ fontSize: 12 }}>Nama Bot</label>
                <input
                  className="form-control form-control-sm"
                  value={settingsDraft.botName}
                  onChange={(e) => setSettingsDraft((p) => ({ ...p, botName: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label mb-1" style={{ fontSize: 12 }}>Bot manggil kamu</label>
                <input
                  className="form-control form-control-sm"
                  value={settingsDraft.userName}
                  onChange={(e) => setSettingsDraft((p) => ({ ...p, userName: e.target.value }))}
                />
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label mb-1" style={{ fontSize: 12 }}>Gaya Bahasa</label>
                  <select
                    className="form-select form-select-sm"
                    value={settingsDraft.tone}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, tone: e.target.value as SessionChatSettings['tone'] }))}
                  >
                    <option value="genz">Gen Z</option>
                    <option value="santai">Santai</option>
                    <option value="mentor">Mentor</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label mb-1" style={{ fontSize: 12 }}>Detail Jawaban</label>
                  <select
                    className="form-select form-select-sm"
                    value={settingsDraft.detailLevel}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, detailLevel: e.target.value as SessionChatSettings['detailLevel'] }))}
                  >
                    <option value="ringkas">Ringkas</option>
                    <option value="normal">Normal</option>
                    <option value="detail">Detail</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label mb-1" style={{ fontSize: 12 }}>Emoji</label>
                <select
                  className="form-select form-select-sm"
                  value={settingsDraft.emojiLevel}
                  onChange={(e) => setSettingsDraft((p) => ({ ...p, emojiLevel: e.target.value as SessionChatSettings['emojiLevel'] }))}
                >
                  <option value="normal">Normal</option>
                  <option value="minim">Minim</option>
                </select>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label mb-1" style={{ fontSize: 12 }}>Bahasa Output</label>
                  <select
                    className="form-select form-select-sm"
                    value={settingsDraft.language}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, language: e.target.value as SessionChatSettings['language'] }))}
                  >
                    <option value="id">Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label mb-1" style={{ fontSize: 12 }}>Format Default</label>
                  <select
                    className="form-select form-select-sm"
                    value={settingsDraft.responseFormat}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, responseFormat: e.target.value as SessionChatSettings['responseFormat'] }))}
                  >
                    <option value="markdown">Markdown</option>
                    <option value="bullet">Bullet</option>
                    <option value="table">Tabel</option>
                    <option value="paragraph">Paragraf</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-sm btn-light" onClick={() => setSettingsSessionId(null)}>Batal</button>
              <button className="btn btn-sm btn-primary" onClick={saveSessionSettings}>Simpan</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmId && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(2,6,23,0.56)', zIndex: 1090 }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="ai-modal-surface rounded-4 p-4 shadow"
            style={{ width: 'min(92vw, 380px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, background: '#fee2e2', color: '#b91c1c' }}>
                <i className="bi bi-trash3"></i>
              </div>
              <div className="fw-semibold" style={{ color: '#0f172a' }}>Hapus riwayat chat?</div>
            </div>
            <div className="text-muted mb-3" style={{ fontSize: 13 }}>
              Riwayat yang dihapus tidak bisa dikembalikan lagi.
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-light" onClick={() => setDeleteConfirmId(null)}>
                Batal
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => void deleteSession(deleteConfirmId)}>
                Ya, hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {previewImage && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(2,6,23,0.72)', zIndex: 1080 }} onClick={() => setPreviewImage(null)}>
          <img
            src={previewImage}
            alt="Preview"
            style={{ maxWidth: '92vw', maxHeight: '86vh', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="btn btn-light position-absolute"
            style={{ top: 18, right: 18, borderRadius: 999 }}
            onClick={() => setPreviewImage(null)}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* ── Call Mode Overlay ─────────────────────────────────────────── */}
      {isCallMode && (
        <div
          onClick={callStatus === 'speaking' ? interruptAISpeech : undefined}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 50% 40%, #1a1a3e 0%, #0d0d1a 50%, #050510 100%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: callStatus === 'speaking' ? 'pointer' : 'default',
          }}
        >
          {/* Background Stars */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.8), transparent), radial-gradient(2px 2px at 40% 70%, rgba(255,255,255,0.6), transparent), radial-gradient(2px 2px at 60% 20%, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 80% 60%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 90% 40%, rgba(255,255,255,0.3), transparent)',
            backgroundSize: '100% 100%',
            opacity: 0.5,
          }} />

          {/* Main Particle Orb Container */}
          <div style={{
            position: 'relative',
            width: 300,
            height: 300,
            marginBottom: 40,
          }}>
            {/* Outer Glow Rings */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 300, height: 300,
              border: '2px solid',
              borderColor: callStatus === 'speaking'
                ? 'rgba(16, 185, 129, 0.3)'
                : callStatus === 'thinking'
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(139, 92, 246, 0.3)',
              borderRadius: '50%',
              animation: callStatus === 'listening'
                ? 'ringExpand 2s ease-out infinite'
                : 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 260, height: 260,
              border: '2px solid',
              borderColor: callStatus === 'speaking'
                ? 'rgba(16, 185, 129, 0.4)'
                : callStatus === 'thinking'
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(139, 92, 246, 0.4)',
              borderRadius: '50%',
              animation: callStatus === 'listening'
                ? 'ringExpand 2s ease-out infinite 0.3s'
                : 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 220, height: 220,
              border: '2px solid',
              borderColor: callStatus === 'speaking'
                ? 'rgba(16, 185, 129, 0.5)'
                : callStatus === 'thinking'
                  ? 'rgba(245, 158, 11, 0.5)'
                  : 'rgba(139, 92, 246, 0.5)',
              borderRadius: '50%',
              animation: callStatus === 'listening'
                ? 'ringExpand 2s ease-out infinite 0.6s'
                : 'none',
            }} />

            {/* Floating Particles */}
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: 8 + (i % 3) * 4,
                height: 8 + (i % 3) * 4,
                borderRadius: '50%',
                background: callStatus === 'speaking'
                  ? 'rgba(16, 185, 129, 0.8)'
                  : callStatus === 'thinking'
                    ? 'rgba(245, 158, 11, 0.8)'
                    : 'rgba(139, 92, 246, 0.8)',
                boxShadow: callStatus === 'speaking'
                  ? '0 0 20px rgba(16, 185, 129, 0.6)'
                  : callStatus === 'thinking'
                    ? '0 0 20px rgba(245, 158, 11, 0.6)'
                    : '0 0 20px rgba(139, 92, 246, 0.6)',
                animation: callStatus === 'listening' || callStatus === 'speaking'
                  ? `particleOrbit ${3 + (i % 3) * 0.5}s linear infinite`
                  : 'none',
                animationDelay: `${i * 0.25}s`,
                transformOrigin: '0 0',
              }} />
            ))}

            {/* Main Orb */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: callStatus === 'speaking'
                ? 'radial-gradient(circle at 30% 30%, #34d399, #10b981, #059669)'
                : callStatus === 'thinking'
                  ? 'radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b, #d97706)'
                  : 'radial-gradient(circle at 30% 30%, #a78bfa, #8b5cf6, #7c3aed)',
              boxShadow: callStatus === 'speaking'
                ? '0 0 60px rgba(16, 185, 129, 0.8), 0 0 120px rgba(16, 185, 129, 0.4), inset 0 0 40px rgba(255,255,255,0.2)'
                : callStatus === 'thinking'
                  ? '0 0 60px rgba(245, 158, 11, 0.8), 0 0 120px rgba(245, 158, 11, 0.4), inset 0 0 40px rgba(255,255,255,0.2)'
                  : '0 0 60px rgba(139, 92, 246, 0.8), 0 0 120px rgba(139, 92, 246, 0.4), inset 0 0 40px rgba(255,255,255,0.2)',
              animation: callStatus === 'listening'
                ? 'orbBreathing 2s ease-in-out infinite, orbPulse 1s ease-in-out infinite'
                : callStatus === 'speaking'
                  ? 'orbWave 0.8s ease-in-out infinite'
                  : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.5s ease',
            }}>
              {/* Inner Shine */}
              <div style={{
                position: 'absolute',
                top: '20%', left: '20%',
                width: '30%', height: '30%',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.3)',
                filter: 'blur(8px)',
              }} />

              {/* Status Icon */}
              <i className={`bi ${
                callStatus === 'speaking' ? 'bi-volume-up-fill' :
                callStatus === 'thinking' ? 'bi-lightning-fill' :
                'bi bi-mic-fill'
              }`} style={{
                fontSize: 64,
                color: '#fff',
                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))',
              }} />
            </div>

            {/* Wave Animation for Speaking */}
            {callStatus === 'speaking' && (
              <>
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 180, height: 180,
                  borderRadius: '50%',
                  border: '3px solid rgba(16, 185, 129, 0.6)',
                  animation: 'waveRipple 1s ease-out infinite',
                }} />
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 180, height: 180,
                  borderRadius: '50%',
                  border: '3px solid rgba(16, 185, 129, 0.6)',
                  animation: 'waveRipple 1s ease-out infinite 0.5s',
                }} />
              </>
            )}

            {/* Sound Waves for Speaking */}
            {callStatus === 'speaking' && (
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200, height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{
                    width: 4,
                    height: 20 + (i % 2) * 20,
                    borderRadius: 4,
                    background: 'linear-gradient(to top, rgba(16, 185, 129, 0.8), rgba(52, 211, 153, 0.4))',
                    animation: `soundWave 0.5s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.1}s`,
                  }} />
                ))}
              </div>
            )}

            {/* Loading Spinner for Thinking - Enhanced */}
            {callStatus === 'thinking' && (
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200, height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {/* Brain/Think Icon */}
                <div style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                }}>
                  {/* Pulsing rings */}
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 100, height: 100,
                    borderRadius: '50%',
                    border: '2px solid rgba(245, 158, 11, 0.3)',
                    animation: 'thinkPulse 1.5s ease-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 100, height: 100,
                    borderRadius: '50%',
                    border: '2px solid rgba(245, 158, 11, 0.3)',
                    animation: 'thinkPulse 1.5s ease-out infinite 0.5s',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 100, height: 100,
                    borderRadius: '50%',
                    border: '2px solid rgba(245, 158, 11, 0.3)',
                    animation: 'thinkPulse 1.5s ease-out infinite 1s',
                  }} />
                  {/* Center icon */}
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 60, height: 60,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 30px rgba(245, 158, 11, 0.6)',
                    animation: 'thinkBounce 0.8s ease-in-out infinite',
                  }}>
                    <i className="bi bi-lightning-fill" style={{
                      fontSize: 28,
                      color: '#fff',
                      animation: 'thinkFlash 0.6s ease-in-out infinite',
                    }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Text */}
          <div style={{
            fontSize: 30,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #fff, #e0e7ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 8,
            textShadow: 'none',
          }}>
            StudyBot
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: callStatus === 'speaking'
              ? '#10b981'
              : callStatus === 'thinking'
                ? '#f59e0b'
                : '#8b5cf6',
            marginBottom: 32,
          }}>
            {callStatus === 'speaking' ? 'AI sedang berbicara...' :
             callStatus === 'thinking' ? 'AI sedang berpikir...' :
             'Mendengarkan...'}
          </div>
          {callStatus === 'speaking' && (
            <div style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              marginTop: -20,
              marginBottom: 20,
              animation: 'blink 1s ease-in-out infinite',
            }}>
              Klik di mana saja untuk interromsi
            </div>
          )}

          {/* Mic Error Display */}
          {micError && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1))',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 20,
              maxWidth: 400,
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: 24, color: '#ef4444', marginBottom: 8, display: 'block' }} />
              <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>{micError}</div>
              <button
                onClick={() => { setMicError(null); startCallListening() }}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Transcript & Response Cards - Redesigned */}
          <div style={{
            width: '90%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 100,
          }}>
            {callTranscript && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(139, 92, 246, 0.5)',
                borderRadius: 24,
                padding: '20px 24px',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}>
                {/* Animated gradient border glow */}
                <div style={{
                  position: 'absolute',
                  top: -2, left: -2, right: -2, bottom: -2,
                  borderRadius: 26,
                  background: 'linear-gradient(45deg, rgba(139, 92, 246, 0.6), transparent, rgba(139, 92, 246, 0.6))',
                  backgroundSize: '200% 200%',
                  animation: 'gradientShift 2s ease infinite',
                  zIndex: -1,
                }} />
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, rgba(20, 20, 40, 0.9), rgba(30, 30, 60, 0.95))',
                  zIndex: -1,
                }} />
                {/* User avatar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
                  }}>
                    <i className="bi bi-person-fill" style={{ fontSize: 18, color: '#fff' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Kamu</div>
                  {/* Speaking indicator */}
                  <div style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    gap: 3,
                    alignItems: 'flex-end',
                    height: 16,
                  }}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} style={{
                        width: 3,
                        height: 8 + (i % 2) * 6,
                        borderRadius: 2,
                        background: '#a78bfa',
                        animation: `soundBar 0.4s ease-in-out infinite alternate`,
                        animationDelay: `${i * 0.1}s`,
                      }} />
                    ))}
                  </div>
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#fff',
                  lineHeight: 1.6,
                  textAlign: 'left',
                  paddingLeft: 48,
                }}>{callTranscript}</div>
              </div>
            )}
            {callResponse && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(16, 185, 129, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: 24,
                padding: '20px 24px',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}>
                <div style={{
                  position: 'absolute',
                  top: -2, left: -2, right: -2, bottom: -2,
                  borderRadius: 26,
                  background: 'linear-gradient(45deg, rgba(16, 185, 129, 0.6), transparent, rgba(16, 185, 129, 0.6))',
                  backgroundSize: '200% 200%',
                  animation: 'gradientShift 2s ease infinite',
                  zIndex: -1,
                }} />
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, rgba(16, 40, 30, 0.9), rgba(20, 50, 40, 0.95))',
                  zIndex: -1,
                }} />
                {/* Bot avatar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #34d399, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                  }}>
                    <i className="bi bi-robot" style={{ fontSize: 18, color: '#fff' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>StudyBot</div>
                  {callStatus === 'speaking' && (
                    <div style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      gap: 3,
                      alignItems: 'flex-end',
                      height: 16,
                    }}>
                      {[...Array(4)].map((_, i) => (
                        <div key={i} style={{
                          width: 3,
                          height: 8 + (i % 2) * 6,
                          borderRadius: 2,
                          background: '#34d399',
                          animation: `soundBar 0.4s ease-in-out infinite alternate`,
                          animationDelay: `${i * 0.1}s`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#fff',
                  lineHeight: 1.6,
                  textAlign: 'left',
                  paddingLeft: 48,
                }}>{callResponse}</div>
              </div>
            )}
          </div>

          {/* End Call Button - Top Right Corner */}
          <button
            onClick={endCallMode}
            style={{
              position: 'fixed',
              top: 40,
              right: 40,
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              zIndex: 10001,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)'
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3)'
            }}
          >
            <i className="bi bi-x-lg" style={{ fontSize: 24 }} />
          </button>

          <style>{`
            @keyframes orbPulse {
              0%, 100% { transform: translate(-50%, -50%) scale(1); }
              50% { transform: translate(-50%, -50%) scale(1.08); }
            }
            @keyframes orbBreathing {
              0%, 100% { transform: translate(-50%, -50%) scale(1); }
              50% { transform: translate(-50%, -50%) scale(1.05); }
            }
            @keyframes orbWave {
              0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
              25% { transform: translate(-50%, -50%) scale(1.03) rotate(2deg); }
              75% { transform: translate(-50%, -50%) scale(0.97) rotate(-2deg); }
            }
            @keyframes ringExpand {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
            @keyframes particleOrbit {
              0% { transform: rotate(0deg) translateX(120px) rotate(0deg); opacity: 0.8; }
              50% { opacity: 1; }
              100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); opacity: 0.8; }
            }
            @keyframes waveRipple {
              0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
            @keyframes soundWave {
              0% { transform: scaleY(0.5); }
              100% { transform: scaleY(1.2); }
            }
            @keyframes spin {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
            @keyframes blink {
              0%, 100% { opacity: 0.5; }
              50% { opacity: 0.8; }
            }
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes soundBar {
              0% { transform: scaleY(0.3); }
              100% { transform: scaleY(1.2); }
            }
            @keyframes thinkPulse {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
            @keyframes thinkBounce {
              0%, 100% { transform: translate(-50%, -50%) scale(1); }
              50% { transform: translate(-50%, -50%) scale(1.1); }
            }
            @keyframes thinkFlash {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}