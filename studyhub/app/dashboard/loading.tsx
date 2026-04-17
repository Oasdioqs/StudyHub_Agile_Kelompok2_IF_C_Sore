export default function DashboardLoading() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
      {/* Hero card skeleton */}
      <div
        className="animate-fade-up mb-3"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          borderRadius: 20,
          padding: '28px 28px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="d-flex align-items-center gap-2 mb-3">
          <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.1)' }} />
          <div className="skeleton" style={{ width: 160, height: 14, background: 'rgba(255,255,255,0.07)' }} />
        </div>
        <div className="skeleton mb-2" style={{ width: '60%', height: 22, background: 'rgba(255,255,255,0.12)' }} />
        <div className="skeleton mb-4" style={{ width: '40%', height: 14, background: 'rgba(255,255,255,0.07)' }} />
        <div className="skeleton mb-4" style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.1)' }} />
        <div className="d-flex gap-2">
          <div className="skeleton" style={{ width: 120, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.12)' }} />
          <div className="skeleton" style={{ width: 160, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.07)' }} />
        </div>
      </div>

      {/* Stat cards */}
      <div
        className="animate-fade-up mb-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
          gap: 10,
          animationDelay: '60ms',
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="card p-3 animate-fade-up"
            style={{ height: 100, animationDelay: `${i * 50}ms` }}
          >
            <div className="skeleton mb-2" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div className="skeleton mb-1" style={{ width: '50%', height: 18 }} />
            <div className="skeleton" style={{ width: '70%', height: 11 }} />
          </div>
        ))}
      </div>

      {/* Content sections */}
      <div
        className="animate-fade-up"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          animationDelay: '120ms',
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="card animate-fade-up"
            style={{ height: 220, animationDelay: `${(i + 6) * 50}ms` }}
          >
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="skeleton" style={{ width: '45%', height: 15 }} />
              <div className="skeleton" style={{ width: 60, height: 15 }} />
            </div>
            <div className="card-body d-flex flex-column gap-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="d-flex align-items-center gap-2">
                  <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton mb-1" style={{ width: '80%', height: 12 }} />
                    <div className="skeleton" style={{ width: '50%', height: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
