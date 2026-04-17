'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'sh_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY)
    if (!consent) setTimeout(() => setVisible(true), 1500)
  }, [])

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="animate-fade-up"
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1500, width: 'calc(100% - 32px)', maxWidth: 520,
        background: 'var(--sh-card-bg, #fff)',
        border: '1.5px solid var(--sh-border, #e2e8f0)',
        borderRadius: 16,
        boxShadow: '0 16px 48px rgba(15,23,42,0.16)',
        padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🍪</span>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--sh-text)', fontWeight: 600 }}>
            Kami menggunakan cookie
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--sh-muted)', lineHeight: 1.6 }}>
            Untuk pengalaman terbaik dan analytics penggunaan. Baca{' '}
            <Link href="/privacy" style={{ color: '#4f46e5', fontWeight: 600 }}>Privacy Policy</Link>{' '}
            kami.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={decline}
          style={{
            padding: '7px 16px', borderRadius: 10, border: '1.5px solid var(--sh-border)',
            background: 'transparent', color: 'var(--sh-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Tolak
        </button>
        <button
          onClick={accept}
          style={{
            padding: '7px 16px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
          }}
        >
          Terima Semua
        </button>
      </div>
    </div>
  )
}
