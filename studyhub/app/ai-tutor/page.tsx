'use client'
// app/ai-tutor/page.tsx

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

type Message = { role: 'user' | 'assistant'; content: string }

export default function AITutorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const { data } = await axios.post('/api/ai', { message: userMsg, sessionId })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      setSessionId(data.sessionId)
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error ?? 'Terjadi kesalahan. Coba lagi.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const newChat = () => {
    setMessages([])
    setSessionId(null)
    setInput('')
  }

  const suggestions = [
    'Jelaskan konsep integral dalam kalkulus',
    'Apa perbedaan mitosis dan meiosis?',
    'Bagaimana cara menghitung determinan matriks?',
    'Rangkum konsep hukum Newton',
  ]

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
              <small className="text-muted">Powered by StudyHub | Create by Bryan · Limit 50 pertanyaan/hari</small>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={newChat}>
              <i className="bi bi-plus-circle me-1"></i>Chat Baru
            </button>
          </div>

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
                      className={`px-3 py-2 ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
                      style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
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

          {/* INPUT (UNCHANGED) */}
          <div className="border-top bg-white px-4 py-3 flex-shrink-0">
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <div className="input-group">
                <textarea
                  className="form-control"
                  placeholder="Tanyakan soal atau materi... (Enter untuk kirim)"
                  rows={2}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  style={{ resize: 'none', fontSize: 14, borderRadius: '12px 0 0 12px'}}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  style={{ borderRadius: '0 12px 12px 0', width: 52 }}>
                  {loading
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : <i className="bi bi-send-fill"></i>}
                </button>
              </div>

              <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                <i className="bi bi-shield-check me-1"></i>
                AI dapat membuat kesalahan. Selalu verifikasi jawaban penting.
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* STYLE */}
      <style>{`

        /* BACKGROUND */
        .chat-bg {
          background: linear-gradient(-45deg, #eef2ff, #f8fafc, #e0e7ff, #f1f5f9);
          background-size: 400% 400%;
          animation: gradientMove 15s ease infinite;
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* USER BUBBLE */
        .chat-bubble-user {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border-radius: 18px 18px 6px 18px;
          box-shadow: 0 6px 18px rgba(99,102,241,0.25);
          transition: all 0.2s ease;
        }

        .chat-bubble-user:hover {
          transform: translateY(-2px);
        }

        /* AI BUBBLE */
        .chat-bubble-ai {
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(12px);
          border-radius: 18px 18px 18px 6px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
          border: 1px solid rgba(255,255,255,0.4);
        }

        /* ANIMATION */
        .chat-bubble-user,
        .chat-bubble-ai {
          animation: fadeUp 0.25s ease;
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
    </div>
  )
}