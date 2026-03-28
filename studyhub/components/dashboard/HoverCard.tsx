'use client'

import Link from 'next/link'
import { useState } from 'react'

export function LiftCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        transform: hovered ? 'translateY(-2px)' : undefined,
        boxShadow: hovered ? '0 8px 20px rgba(0,0,0,0.08)' : undefined,
        transition: '0.2s',
      }}
    >
      {children}
    </div>
  )
}

export function QuickLinkCard({
  href,
  emoji,
  label,
  desc,
  iconBg,
}: {
  href: string
  emoji: string
  label: string
  desc: string
  iconBg: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        borderRadius: 14,
        border: '0.5px solid rgba(0,0,0,0.06)',
        padding: '14px 16px',
        textDecoration: 'none',
        transition: '0.2s',
        transform: hovered ? 'translateY(-2px)' : undefined,
        boxShadow: hovered ? '0 8px 20px rgba(0,0,0,0.08)' : undefined,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {emoji}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{desc}</div>
      </div>
      <span style={{ color: '#cbd5e1', fontSize: 14, flexShrink: 0 }}>›</span>
    </Link>
  )
}

export function ScheduleQuickLinkCard({
  href,
  emoji,
  label,
  desc,
  iconBg,
  infoTitle,
  infoBody,
}: {
  href: string
  emoji: string
  label: string
  desc: string
  iconBg: string
  infoTitle: string
  infoBody: string
}) {
  const [hovered, setHovered] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 0,
          background: '#fff',
          borderRadius: 14,
          border: '0.5px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
          transition: '0.2s',
          transform: hovered ? 'translateY(-2px)' : undefined,
          boxShadow: hovered ? '0 8px 20px rgba(0,0,0,0.08)' : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link
          href={href}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 12px 14px 16px',
            textDecoration: 'none',
            minWidth: 0,
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {emoji}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{desc}</div>
          </div>
          <span style={{ color: '#cbd5e1', fontSize: 14, flexShrink: 0 }}>›</span>
        </Link>
        <button
          type="button"
          className="schedule-info-btn"
          aria-label={infoTitle}
          title={infoTitle}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setInfoOpen(true)
          }}
          style={{
            border: 0,
            borderLeft: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(99,102,241,0.06)',
            padding: '0 12px',
            cursor: 'pointer',
            color: '#6366f1',
            fontSize: 18,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          <i className="bi bi-info-circle" aria-hidden />
        </button>
      </div>
      {infoOpen && (
        <div
          role="dialog"
          aria-modal
          aria-labelledby="schedule-info-title"
          onClick={() => setInfoOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 1080,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: '18px 18px 16px',
              boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
            }}
          >
            <h6 id="schedule-info-title" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>
              {infoTitle}
            </h6>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 16 }}>{infoBody}</p>
            <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => setInfoOpen(false)}>
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TaskItem({
  title,
  subject,
  dot,
  badgeBg,
  badgeText,
  badgeLabel,
  done,
  onClick,
  centerInfo,
}: {
  title: string
  subject?: string | null
  dot: string
  badgeBg: string
  badgeText: string
  badgeLabel: string
  done?: boolean
  onClick?: () => void
  centerInfo?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <li
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        borderBottom: '0.5px solid rgba(0,0,0,0.04)',
        transition: '0.15s',
        background: hovered ? '#f9f8ff' : done ? '#fafafa' : undefined,
        cursor: onClick ? 'pointer' : 'default',
        listStyle: 'none',
        opacity: done ? 0.76 : 1,
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done ? 'line-through' : 'none' }}>{title}</div>
        {subject && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1, textDecoration: done ? 'line-through' : 'none' }}>{subject}</div>}
      </div>
      {centerInfo && (
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#3730a3', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '2px 7px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {centerInfo}
        </span>
      )}
      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: badgeBg, color: badgeText, flexShrink: 0 }}>
        {badgeLabel}
      </span>
    </li>
  )
}

export function NoteCard({ id, title, preview }: { id: string; title: string; preview: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={`/notes/${id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textDecoration: 'none',
        display: 'block',
        background: hovered ? '#f0eeff' : '#faf9f6',
        borderRadius: 12,
        padding: 12,
        border: `0.5px solid ${hovered ? '#c4bfff' : 'rgba(0,0,0,0.05)'}`,
        transition: '0.15s',
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#94a3b8',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {preview}
      </div>
    </Link>
  )
}