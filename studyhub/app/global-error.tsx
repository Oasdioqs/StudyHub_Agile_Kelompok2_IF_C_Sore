'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
          }}
        >
          <section
            style={{
              width: '100%',
              maxWidth: 560,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 10px 28px rgba(15,23,42,0.08)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Aplikasi sempat error</h2>
            <p style={{ marginTop: 10, marginBottom: 16, color: '#475569', fontSize: 14 }}>
              Halaman gagal dimuat. Coba muat ulang aplikasi.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={reset}
                style={{
                  border: 0,
                  background: '#4f46e5',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Coba lagi
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Muat ulang penuh
              </button>
            </div>
            {process.env.NODE_ENV !== 'production' && (
              <pre
                style={{
                  marginTop: 16,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: 10,
                  borderRadius: 8,
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {error?.message}
              </pre>
            )}
          </section>
        </main>
      </body>
    </html>
  )
}
