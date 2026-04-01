'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error Boundary]', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          background: '#fff',
          padding: 18,
        }}
      >
        <h3 style={{ margin: 0, color: '#0f172a' }}>Oops, halaman gagal dimuat</h3>
        <p style={{ marginTop: 8, color: '#64748b', fontSize: 14 }}>
          Silakan coba lagi. Kalau masih sama, lakukan refresh penuh.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reset} className="btn btn-primary btn-sm">Coba lagi</button>
          <button onClick={() => window.location.reload()} className="btn btn-outline-secondary btn-sm">Refresh penuh</button>
        </div>
      </div>
    </div>
  )
}
