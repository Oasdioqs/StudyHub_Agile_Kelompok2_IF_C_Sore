'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'

type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  isShared: boolean
  groupId: string | null
  createdAt: string
  updatedAt: string
}

type Group = {
  id: string
  name: string
  role: string
}

type ViewMode = 'list' | 'editor'

const TAG_COLORS = [
  'rgba(99,102,241,0.15)', // indigo
  'rgba(16,185,129,0.15)', // emerald
  'rgba(245,158,11,0.15)', // amber
  'rgba(239,68,68,0.15)',  // red
  'rgba(139,92,246,0.15)', // violet
  'rgba(14,165,233,0.15)', // sky
]

const TAG_TEXT_COLORS = [
  '#6366f1', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9'
]

function getTagColor(tag: string): { bg: string; text: string } {
  const idx = tag.charCodeAt(0) % TAG_COLORS.length
  return { bg: TAG_COLORS[idx], text: TAG_TEXT_COLORS[idx] }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins}m lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function SimpleMarkdown({ content }: { content: string }) {
  const html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h6 style="font-size:13px;font-weight:600;margin:12px 0 4px;color:var(--sh-text)">$1</h6>')
    .replace(/^## (.+)$/gm, '<h5 style="font-size:15px;font-weight:600;margin:12px 0 6px;color:var(--sh-text)">$1</h5>')
    .replace(/^# (.+)$/gm, '<h4 style="font-size:17px;font-weight:700;margin:16px 0 8px;color:var(--sh-text)">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.1);padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace;color:#6366f1">$1</code>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.05);padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:monospace;margin:8px 0"><code>$2</code></pre>')
    .replace(/^\- (.+)$/gm, '<li style="margin:4px 0 4px 16px;font-size:13px">$1</li>')
    .replace(/^\* (.+)$/gm, '<li style="margin:4px 0 4px 16px;font-size:13px">$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#6366f1;text-decoration:underline">$1</a>')
    .replace(/\n\n/g, '<br style="margin:8px 0;display:block;content:\'\'">')

  return <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sh-text)' }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default function NotesPageClient() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [notes, setNotes] = useState<Note[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareGroupId, setShareGroupId] = useState<string | null>(null)
  const [isNewNote, setIsNewNote] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(activeNote)
  const searchQueryRef = useRef(searchQuery)

  // Keep ref in sync with state
  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])


  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQueryRef.current) params.append('search', searchQueryRef.current)
      const { data } = await axios.get(`/api/notes?${params.toString()}`)
      setNotes(data)
      // Extract all tags
      const tags = new Set<string>()
      data.forEach((n: Note) => n.tags?.forEach((t) => tags.add(t)))
      setAllTags(Array.from(tags).sort())
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch groups for sharing
  const fetchGroups = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/kelas')
      setGroups(data)
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
    fetchGroups()
  }, [fetchNotes, fetchGroups])

  // Auto-save effect
  useEffect(() => {
    if (!activeNote && !isNewNote) return
    if (saveStatus === 'saving') return

    const hasChanges = isNewNote
      ? editTitle.trim().length > 0 || editContent.trim().length > 0
      : activeNote && (editTitle !== activeNote.title || editContent !== activeNote.content || JSON.stringify(editTags) !== JSON.stringify(activeNote.tags))

    if (!hasChanges) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      await saveNote(true)
    }, 30000) // 30 seconds

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [editTitle, editContent, editTags, activeNote, isNewNote])

  // Save note function
  const saveNote = async (isAuto = false) => {
    if (!editTitle.trim()) {
      if (!isAuto) alert('Judul wajib diisi')
      return
    }

    setSaveStatus('saving')
    try {
      if (isNewNote) {
        const { data } = await axios.post('/api/notes', {
          title: editTitle.trim(),
          content: editContent,
          tags: editTags,
        })
        setNotes((prev) => [data, ...prev])
        setActiveNote(data)
        setIsNewNote(false)
        router.replace(`/notes`)
      } else if (activeNote) {
        const { data } = await axios.patch(`/api/notes/${activeNote.id}`, {
          title: editTitle.trim(),
          content: editContent,
          tags: editTags,
        })
        setNotes((prev) => prev.map((n) => (n.id === data.id ? data : n)))
        setActiveNote(data)
      }
      setSaveStatus('saved')
      setLastSaved(new Date())
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
    }
  }

  // Save with sharing
  const saveWithShare = async () => {
    if (!activeNote) return
    setSaveStatus('saving')
    try {
      const { data } = await axios.patch(`/api/notes/${activeNote.id}`, {
        title: editTitle.trim(),
        content: editContent,
        tags: editTags,
        isShared: shareGroupId !== null,
        groupId: shareGroupId,
      })
      setNotes((prev) => prev.map((n) => (n.id === data.id ? data : n)))
      setActiveNote(data)
      setSaveStatus('saved')
      setLastSaved(new Date())
      setShowShareModal(false)
    } catch (err) {
      console.error('Save with share failed:', err)
      setSaveStatus('error')
    }
  }

  // Delete note
  const deleteNote = async (noteId: string) => {
    if (!confirm('Hapus catatan ini?')) return
    try {
      await axios.delete(`/api/notes/${noteId}`)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      if (activeNote?.id === noteId) {
        setActiveNote(null)
        setViewMode('list')
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // Open note for editing
  const openNote = (note: Note) => {
    setActiveNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditTags([...(note.tags || [])])
    setShareGroupId(note.groupId)
    setIsNewNote(false)
    setViewMode('editor')
  }

  // Create new note
  const createNewNote = () => {
    setActiveNote(null)
    setEditTitle('')
    setEditContent('')
    setEditTags([])
    setShareGroupId(null)
    setIsNewNote(true)
    setViewMode('editor')
  }

  // Add tag
  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag])
    }
    setTagInput('')
  }

  // Remove tag
  const removeTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag))
  }

  // Go back to list
  const goBack = () => {
    setActiveNote(null)
    setIsNewNote(false)
    setViewMode('list')
    fetchNotes()
  }

  // Insert markdown syntax
  const insertMarkdown = (syntax: string, wrap = false) => {
    const textarea = document.getElementById('note-editor') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = editContent.substring(start, end)

    let newContent: string
    let newCursorPos: number

    if (wrap && selected) {
      newContent = editContent.substring(0, start) + syntax + selected + syntax + editContent.substring(end)
      newCursorPos = end + syntax.length * 2
    } else {
      newContent = editContent.substring(0, start) + syntax + editContent.substring(end)
      newCursorPos = start + syntax.length
    }

    setEditContent(newContent)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveNote()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        createNewNote()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Search on query change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotes()
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, fetchNotes])

  // Filter notes by tag
  const filteredNotes = selectedTag
    ? notes.filter((n) => n.tags?.includes(selectedTag))
    : notes

  // Get unique tags from all notes
  const uniqueTags = Array.from(new Set(notes.flatMap((n) => n.tags || []))).sort()

  return (
    <div className="animate-fade-up" style={{ maxWidth: 1100, margin: '0 auto' }}>

          {viewMode === 'list' ? (
            <>
              {/* Header with title + action button */}
              <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
                <div>
                  <h5 className="fw-bold mb-1">📝 Catatan Digital</h5>
                  <p className="text-muted small mb-0">Tulis catatan dengan Markdown, auto-save, dan bagikan ke kelas</p>
                </div>
                <button
                  className="btn d-flex align-items-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, padding: '10px 20px', border: 'none' }}
                  onClick={createNewNote}
                >
                  <i className="bi bi-plus-lg" />
                  <span className="fw-semibold">Catatan Baru</span>
                </button>
              </div>

              {/* Search & Tag Filter */}
              <div className="d-flex gap-3 mb-4 flex-wrap align-items-center">
                <div className="position-relative flex-grow-1" style={{ maxWidth: 400 }}>
                  <i className="bi bi-search position-absolute" style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--sh-muted)', zIndex: 1 }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Cari catatan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 40, borderRadius: 12 }}
                  />
                </div>
                {uniqueTags.length > 0 && (
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className={`badge ${!selectedTag ? 'bg-primary' : 'bg-secondary'}`}
                      style={{ borderRadius: 20, cursor: 'pointer', fontSize: 12, padding: '6px 14px', border: 'none' }}
                      onClick={() => setSelectedTag(null)}
                    >
                      Semua
                    </button>
                    {uniqueTags.map((tag) => {
                      const color = getTagColor(tag)
                      return (
                        <button
                          key={tag}
                          className={`badge ${selectedTag === tag ? 'bg-primary' : ''}`}
                          style={{
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 12,
                            padding: '6px 14px',
                            border: 'none',
                            background: selectedTag === tag ? undefined : color.bg,
                            color: selectedTag === tag ? undefined : color.text,
                          }}
                          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Notes Grid */}
              {loading ? (
                <div className="d-flex flex-column gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card" style={{ height: 100, background: 'var(--sh-card-bg)' }}>
                      <div className="card-body d-flex align-items-center gap-3">
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(148,163,184,0.15)', flexShrink: 0 }} />
                        <div className="flex-grow-1">
                          <div style={{ height: 14, borderRadius: 7, background: 'rgba(148,163,184,0.2)', width: '50%', marginBottom: 10 }} />
                          <div style={{ height: 10, borderRadius: 5, background: 'rgba(148,163,184,0.15)', width: '70%' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div style={{ fontSize: 56, marginBottom: 16 }}>📝</div>
                  <p className="fw-semibold mb-1">
                    {searchQuery || selectedTag ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan'}
                  </p>
                  <p className="small mb-4">
                    {searchQuery || selectedTag ? 'Coba kata kunci lain atau filter berbeda' : 'Mulai tulis catatan pertamamu'}
                  </p>
                  {!searchQuery && !selectedTag && (
                    <button className="btn btn-primary" style={{ borderRadius: 12 }} onClick={createNewNote}>
                      <i className="bi bi-plus me-2" />Buat Catatan Baru
                    </button>
                  )}
                </div>
              ) : (
                <div className="row g-3">
                  {filteredNotes.map((note) => (
                    <div key={note.id} className="col-md-6 col-lg-4">
                      <div
                        className="card h-100"
                        style={{ borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
                        onClick={() => openNote(note)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
                          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                      >
                        <div className="card-body p-3">
                          <div className="d-flex align-items-start justify-content-between mb-2">
                            <h6 className="fw-bold mb-0" style={{ fontSize: 15, lineHeight: 1.4 }}>{note.title}</h6>
                            {note.isShared && (
                              <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: 10 }}>
                                <i className="bi bi-share-fill me-1" />Shared
                              </span>
                            )}
                          </div>
                          <p className="text-muted small mb-3" style={{
                            fontSize: 13,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.5,
                          }}>
                            {note.content?.substring(0, 120) || 'Belum ada konten...'}
                          </p>
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex gap-1 flex-wrap" style={{ maxWidth: '70%' }}>
                              {note.tags?.slice(0, 3).map((tag) => {
                                const color = getTagColor(tag)
                                return (
                                  <span
                                    key={tag}
                                    className="badge"
                                    style={{ background: color.bg, color: color.text, fontSize: 10, padding: '3px 8px', borderRadius: 12 }}
                                  >
                                    {tag}
                                  </span>
                                )
                              })}
                              {note.tags?.length > 3 && (
                                <span className="badge bg-secondary" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12 }}>
                                  +{note.tags.length - 3}
                                </span>
                              )}
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="text-muted small">{formatDate(note.updatedAt)}</span>
                              <button
                                className="btn btn-sm btn-outline-danger p-1"
                                style={{ borderRadius: 8 }}
                                onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
                              >
                                <i className="bi bi-trash" style={{ fontSize: 14 }} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Editor View */
            <div>
              {/* Editor Header */}
              <div className="d-flex align-items-center gap-3 mb-4">
                <button className="btn btn-outline-secondary d-flex align-items-center gap-2" style={{ borderRadius: 12 }} onClick={goBack}>
                  <i className="bi bi-arrow-left" />
                  Kembali
                </button>
                <input
                  type="text"
                  className="form-control fw-bold"
                  placeholder="Judul catatan..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ fontSize: 18, border: 'none', borderBottom: '2px solid var(--sh-border)', borderRadius: 0, background: 'transparent', padding: '8px 0' }}
                />
                <div className="d-flex gap-2 ms-auto">
                  <button className="btn btn-outline-danger d-flex align-items-center gap-2" style={{ borderRadius: 12 }} onClick={() => deleteNote(activeNote?.id!)} disabled={!activeNote}>
                    <i className="bi bi-trash" />
                    Hapus
                  </button>
                  <button
                    className="btn d-flex align-items-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, border: 'none' }}
                    onClick={() => { if (isNewNote) saveNote(); else setShowShareModal(true) }}
                  >
                    <i className="bi bi-share" />
                    {!isNewNote ? 'Simpan & Bagikan' : 'Simpan'}
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
                <span className="text-muted small fw-semibold">Tags:</span>
                {editTags.map((tag) => {
                  const color = getTagColor(tag)
                  return (
                    <span
                      key={tag}
                      className="badge d-flex align-items-center gap-1"
                      style={{ background: color.bg, color: color.text, fontSize: 12, padding: '6px 12px', borderRadius: 20 }}
                    >
                      {tag}
                      <button className="btn p-0 border-0" style={{ lineHeight: 1 }} onClick={() => removeTag(tag)}>
                        <i className="bi bi-x" style={{ fontSize: 14 }} />
                      </button>
                    </span>
                  )
                })}
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Tambah tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    list="tag-suggestions"
                    style={{ width: 140, borderRadius: 20 }}
                  />
                  <datalist id="tag-suggestions">
                    {allTags.filter((t) => !editTags.includes(t)).map((t) => <option key={t} value={t} />)}
                  </datalist>
                  <button className="btn btn-sm btn-primary" style={{ borderRadius: 20 }} onClick={addTag}>
                    <i className="bi bi-plus" />
                  </button>
                </div>
              </div>

              {/* Markdown Toolbar */}
              <div className="d-flex gap-1 mb-3 p-2 rounded-3" style={{ background: 'var(--sh-card-bg)', border: '1px solid var(--sh-border)' }}>
                {[
                  { icon: 'bi-type-bold', title: 'Bold', syntax: '**', wrap: true },
                  { icon: 'bi-type-italic', title: 'Italic', syntax: '*', wrap: true },
                  { icon: 'bi-type-strikethrough', title: 'Strikethrough', syntax: '~~', wrap: true },
                  { icon: 'bi bi-hash', title: 'Heading', syntax: '## ', wrap: false },
                  { icon: 'bi-list-ul', title: 'List', syntax: '- ', wrap: false },
                  { icon: 'bi bi-list-check', title: 'Checklist', syntax: '- [ ] ', wrap: false },
                  { icon: 'bi bi-code', title: 'Code', syntax: '`', wrap: true },
                  { icon: 'bi bi-file-code', title: 'Code Block', syntax: '```\n\n```', wrap: false },
                  { icon: 'bi bi-link-45deg', title: 'Link', syntax: '[text](url)', wrap: false },
                  { icon: 'bi bi-quote', title: 'Quote', syntax: '> ', wrap: false },
                ].map((btn, i) => (
                  <button
                    key={i}
                    className="btn btn-sm btn-outline-secondary"
                    title={btn.title}
                    onClick={() => insertMarkdown(btn.syntax, btn.wrap !== false)}
                    style={{ borderRadius: 8, padding: '6px 10px' }}
                  >
                    <i className={btn.icon} />
                  </button>
                ))}
              </div>

              {/* Editor & Preview */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="card h-100" style={{ borderRadius: 16 }}>
                    <div className="card-header d-flex align-items-center justify-content-between py-2" style={{ background: 'var(--sh-card-bg)', borderBottom: '1px solid var(--sh-border)' }}>
                      <span className="small fw-semibold">Editor</span>
                      <span className="text-muted small">{editContent.length} karakter</span>
                    </div>
                    <div className="card-body p-0">
                      <textarea
                        id="note-editor"
                        className="form-control border-0"
                        placeholder="Tulis catatan di sini... (Markdown supported)"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{
                          minHeight: 400,
                          resize: 'vertical',
                          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                          fontSize: 14,
                          lineHeight: 1.8,
                          padding: 20,
                          background: 'transparent',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card h-100" style={{ borderRadius: 16 }}>
                    <div className="card-header d-flex align-items-center py-2" style={{ background: 'var(--sh-card-bg)', borderBottom: '1px solid var(--sh-border)' }}>
                      <span className="small fw-semibold">Preview</span>
                    </div>
                    <div className="card-body" style={{ overflowY: 'auto', maxHeight: 450 }}>
                      {editContent ? (
                        <SimpleMarkdown content={editContent} />
                      ) : (
                        <span className="text-muted small">Preview akan muncul di sini...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Status */}
              <div className="d-flex align-items-center gap-3 p-3 rounded-3" style={{ background: 'var(--sh-card-bg)', border: '1px solid var(--sh-border)' }}>
                <button
                  className="btn d-flex align-items-center gap-2 fw-semibold"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, border: 'none', padding: '10px 24px' }}
                  onClick={() => saveNote()}
                  disabled={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Menyimpan...</>
                  ) : (
                    <><i className="bi bi-check2" />Simpan Sekarang</>
                  )}
                </button>
                <div className="d-flex align-items-center gap-2 text-muted small">
                  {saveStatus === 'saved' && (
                    <>
                      <i className="bi bi-check-circle-fill text-success" />
                      Tersimpan
                      {lastSaved && ` · ${lastSaved.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <i className="bi bi-exclamation-circle-fill text-danger" />
                      Gagal menyimpan
                    </>
                  )}
                  {saveStatus === 'idle' && !lastSaved && (
                    <>
                      <i className="bi bi-clock" />
                      Auto-save dalam 30 detik tidak ada perubahan
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Share Modal */}
          {showShareModal && (
            <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={() => setShowShareModal(false)}>
              <div className="card" style={{ width: 400, borderRadius: 20 }} onClick={(e) => e.stopPropagation()}>
                <div className="card-header d-flex align-items-center justify-content-between py-3" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: '20px 20px 0 0' }}>
                  <h6 className="mb-0 fw-bold text-white">Bagikan ke Kelas</h6>
                  <button className="btn btn-link text-white p-0" onClick={() => setShowShareModal(false)}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">Pilih kelas untuk membagikan catatan ini:</p>
                  {groups.length === 0 ? (
                    <p className="text-muted small">Belum ada kelas. Buat atau join kelas terlebih dahulu.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      <label className="d-flex align-items-center gap-3 p-3 rounded-3" style={{ background: shareGroupId === null ? 'rgba(99,102,241,0.1)' : 'var(--sh-card-bg)', border: shareGroupId === null ? '2px solid #6366f1' : '1px solid var(--sh-border)', cursor: 'pointer' }}>
                        <input type="radio" checked={shareGroupId === null} onChange={() => setShareGroupId(null)} />
                        <div>
                          <div className="fw-semibold">Private</div>
                          <div className="text-muted small">Hanya saya yang bisa melihat</div>
                        </div>
                      </label>
                      {groups.map((group) => (
                        <label key={group.id} className="d-flex align-items-center gap-3 p-3 rounded-3" style={{ background: shareGroupId === group.id ? 'rgba(99,102,241,0.1)' : 'var(--sh-card-bg)', border: shareGroupId === group.id ? '2px solid #6366f1' : '1px solid var(--sh-border)', cursor: 'pointer' }}>
                          <input type="radio" checked={shareGroupId === group.id} onChange={() => setShareGroupId(group.id)} />
                          <div className="flex-grow-1">
                            <div className="fw-semibold">{group.name}</div>
                            <div className="text-muted small">{group.role === 'ADMIN' ? 'Komisaris' : 'Anggota'}</div>
                          </div>
                          {group.role === 'ADMIN' && (
                            <span className="badge bg-warning bg-opacity-10 text-warning" style={{ fontSize: 10 }}>Admin</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card-footer d-flex gap-2 justify-content-end">
                  <button className="btn btn-outline-secondary" style={{ borderRadius: 12 }} onClick={() => setShowShareModal(false)}>Batal</button>
                  <button className="btn" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, border: 'none' }} onClick={saveWithShare}>
                    Simpan & Bagikan
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  )
}