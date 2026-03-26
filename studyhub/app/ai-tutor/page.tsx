'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

type UploadItem = { type: 'image' | 'text' | 'file'; name: string; content: string; mimeType?: string; preview?: string }
type Message = { role: 'user' | 'assistant'; content: string; id?: string; attachments?: UploadItem[] }
type ChatSession = { id: string; title: string; updatedAt: string }
type AiMode = 'fast' | 'detail' | 'exam'
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

export default function AITutorPage() {
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolsMenuRef = useRef<HTMLDivElement>(null)
  const hasAutoAskedRef = useRef(false)
  const requestAbortRef = useRef<AbortController | null>(null)
  const stopTypingRef = useRef(false)

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
    if (hasAutoAskedRef.current) return
    const ask = searchParams.get('ask')?.trim()
    if (!ask) return
    hasAutoAskedRef.current = true
    void sendMessageText(ask)
    router.replace('/ai-tutor')
  }, [router, searchParams])

  const sendMessageText = async (
    text: string,
    opts?: { historyOverride?: Message[]; skipAppendUser?: boolean; forcedMode?: AiMode; forcedUploads?: UploadItem[] },
  ) => {
    const userMsg = text.trim()
    const selectedUploads = (opts?.forcedUploads ?? uploads).slice(0, 4)
    if ((!userMsg && selectedUploads.length === 0) || loading) return
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
      }, { signal: abortController.signal })
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      const fullReply: string = data.reply || ''
      let current = ''
      for (let i = 0; i < fullReply.length; i += 1) {
        if (stopTypingRef.current) break
        current += fullReply[i]
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') next[next.length - 1] = { role: 'assistant', content: current }
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
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error ?? 'Terjadi kesalahan. Coba lagi.',
      }])
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
    if (e.key === 'Escape' && editIndex !== null) {
      e.preventDefault()
      setEditIndex(null)
      setInput('')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
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

  const renderAssistantContent = (text: string) => {
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
      const lines = raw.split('\n')
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
          const rows: string[][] = []
          i += 2
          while (i < lines.length && isTableRow(lines[i])) {
            rows.push(parseRow(lines[i]))
            i += 1
          }
          blocks.push(
            <div key={`${keyPrefix}-tbl-${i}`} className="assistant-table-wrap">
              <table className="assistant-table">
                <thead>
                  <tr>{header.map((h, hi) => <th key={`${keyPrefix}-th-${i}-${hi}`}>{h}</th>)}</tr>
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
                    </tr>
                  ))}
                </tbody>
              </table>
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
          blocks.push(<h5 key={`${keyPrefix}-h3-${i}`} className="md-h3">{trimmed.slice(4)}</h5>)
          i += 1
          continue
        }
        if (trimmed.startsWith('## ')) {
          blocks.push(<h4 key={`${keyPrefix}-h2-${i}`} className="md-h2">{trimmed.slice(3)}</h4>)
          i += 1
          continue
        }
        if (trimmed.startsWith('# ')) {
          blocks.push(<h3 key={`${keyPrefix}-h1-${i}`} className="md-h1">{trimmed.slice(2)}</h3>)
          i += 1
          continue
        }
        if (/^[-*]\s+/.test(trimmed)) {
          blocks.push(<div key={`${keyPrefix}-li-${i}`} className="md-li">{trimmed.replace(/^[-*]\s+/, '• ')}</div>)
          i += 1
          continue
        }
        blocks.push(<div key={`${keyPrefix}-p-${i}`} className="md-p">{line}</div>)
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
        <Topbar />

        <main className="p-0 d-flex flex-column" style={{ height: 'calc(100vh - 65px)' }}>

          {/* TOP BAR (UNCHANGED) */}
          <div className="border-bottom bg-white px-4 py-3 d-flex justify-content-between align-items-center flex-shrink-0">
            <div>
              <h6 className="mb-0 fw-bold">
                <i className="bi bi-robot me-2 text-primary"></i>StudyHub Bot
              </h6>
              <small className="text-muted">Powered by StudyHub | Create by Bryan</small>
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
                <i className="bi bi-clock-history me-1"></i>{showHistory ? 'Sembunyikan Riwayat' : 'Lihat Riwayat'}
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={newChat}>
                <i className="bi bi-plus-circle me-1"></i>Chat Baru
              </button>
            </div>
          </div>

          <div className={`d-flex flex-grow-1 ai-layout ${showHistory ? 'history-open' : 'history-closed'}`} style={{ minHeight: 0 }}>
            <aside className="ai-history-panel border-end bg-white">
              <div className="px-3 py-2 border-bottom" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Riwayat Chat
              </div>
              <div style={{ overflowY: 'auto', maxHeight: '100%' }}>
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
                              <div className="ai-history-title">{s.title || 'Chat tanpa judul'}</div>
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

            {/* CHAT AREA (BACKGROUND UPGRADE) */}
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
                          {msg.role === 'assistant' ? renderAssistantContent(msg.content) : msg.content}
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

          {/* INPUT (UNCHANGED) */}
          <div className={`border-top bg-white px-4 py-3 flex-shrink-0 chat-input-footer ${showHistory ? 'history-open' : 'history-closed'}`}>
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
              <div className="chat-input-shell" ref={toolsMenuRef}>
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
                  placeholder="Tanyakan soal atau materi... (Enter untuk kirim)"
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  style={{ resize: 'none' }}
                />
                <button
                  className="chat-send-btn"
                  onClick={loading ? stopAssistant : sendMessage}
                  disabled={!loading && !input.trim() && uploads.length === 0}
                  title={loading ? 'Stop respons AI' : 'Kirim pesan'}
                >
                  {loading
                    ? <i className="bi bi-stop-fill"></i>
                    : <i className="bi bi-send-fill"></i>}
                </button>
              </div>

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
                onChange={onPickFile}
              />
            </div>
          </div>

        </main>
      </div>

      {/* STYLE */}
      <style>{`

        /* BACKGROUND */
        .chat-bg {
          background:
            radial-gradient(circle at 12% 8%, rgba(99,102,241,0.08) 0, transparent 28%),
            radial-gradient(circle at 88% 92%, rgba(14,165,233,0.08) 0, transparent 30%),
            #f8fafc;
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* USER BUBBLE */
        .chat-bubble-user {
          background: #4f46e5;
          color: white;
          border-radius: 18px 18px 6px 18px;
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: 0 8px 20px rgba(79,70,229,0.22);
          max-width: min(76%, 720px);
          transition: box-shadow 0.18s ease;
          padding-right: 42px !important;
        }

        .chat-bubble-user:hover {
          box-shadow: 0 10px 22px rgba(79,70,229,0.28);
        }

        /* AI BUBBLE */
        .chat-bubble-ai {
          background: #ffffff;
          color: #0f172a;
          border-radius: 18px 18px 18px 6px;
          box-shadow: 0 6px 18px rgba(15,23,42,0.06);
          border: 1px solid #e2e8f0;
          max-width: min(82%, 760px);
        }

        /* ANIMATION */
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
          background: #fff;
          padding: 10px 12px;
        }
        .ai-history-group {
          border-bottom: 1px solid #eef2f7;
        }
        .ai-history-group-label {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #f8fafc;
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
          width: calc(100% - 52px);
          text-align: left;
          border: 0;
          background: transparent;
          padding: 0;
          margin-bottom: 0;
        }
        .ai-history-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .ai-history-item:hover { background: #f8faff; }
        .ai-history-item.active { background: #eef2ff; }
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
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ai-history-time {
          margin-top: 2px;
          font-size: 11px;
          color: #94a3b8;
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
          background: #ffffff;
          border: 1px solid #dbe2ea;
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
          background: #ffffff;
          border: 1px solid #e2e8f0;
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
          background: #ffffff;
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
          background: #fff;
          border: 1px solid #e2e8f0;
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
          border: 1px solid #e2e8f0;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
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
        .assistant-table-wrap {
          margin: 4px 0 2px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          background: #ffffff;
        }
        .assistant-table {
          width: 100%;
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
            background: #fff;
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
        @media (max-width: 768px) {
          .chat-bg {
            overflow-x: hidden;
          }
          .ai-history-panel {
            width: min(82vw, 280px);
            min-width: min(82vw, 280px);
          }
          .ai-input-wrap {
            width: 100%;
            max-width: 760px;
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
            className="bg-white rounded-4 p-4 shadow"
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
            className="bg-white rounded-4 p-4 shadow"
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
    </div>
  )
}