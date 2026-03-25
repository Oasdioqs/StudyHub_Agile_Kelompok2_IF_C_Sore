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

export function TaskItem({
  title,
  subject,
  dot,
  badgeBg,
  badgeText,
  badgeLabel,
}: {
  title: string
  subject?: string | null
  dot: string
  badgeBg: string
  badgeText: string
  badgeLabel: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        borderBottom: '0.5px solid rgba(0,0,0,0.04)',
        transition: '0.15s',
        background: hovered ? '#f9f8ff' : undefined,
        cursor: 'default',
        listStyle: 'none',
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {subject && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>{subject}</div>}
      </div>
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