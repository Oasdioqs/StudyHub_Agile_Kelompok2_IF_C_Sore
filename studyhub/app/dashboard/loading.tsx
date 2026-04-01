export default function DashboardLoading() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '24px 16px 48px',
      }}
    >
      {/* Hero skeleton */}
      <div
        style={{
          background: '#1a1a2e',
          borderRadius: 20,
          padding: '28px 28px 24px',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 80, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ width: 160, height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div style={{ width: '60%', height: 22, borderRadius: 8, background: 'rgba(255,255,255,0.1)', marginBottom: 10 }} />
        <div style={{ width: '40%', height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
        <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', marginBottom: 22, overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
              animation: 'shimmer 1.6s ease-in-out infinite',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 120, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 160, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }} />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              borderRadius: 14,
              padding: '14px 16px',
              background: 'var(--sh-card-bg, #fff)',
              border: '1px solid var(--sh-border, #e2e8f0)',
              height: 100,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--sh-skeleton, #f1f5f9)', marginBottom: 10 }} />
            <div style={{ width: '50%', height: 20, borderRadius: 6, background: 'var(--sh-skeleton, #f1f5f9)', marginBottom: 4 }} />
            <div style={{ width: '70%', height: 12, borderRadius: 4, background: 'var(--sh-skeleton, #f1f5f9)' }} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                animation: 'shimmer 1.6s ease-in-out infinite',
              }}
            />
          </div>
        ))}
      </div>

      {/* Content sections skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              borderRadius: 16,
              background: 'var(--sh-card-bg, #fff)',
              border: '1px solid var(--sh-border, #e2e8f0)',
              height: 220,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sh-border, #e2e8f0)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '45%', height: 16, borderRadius: 6, background: 'var(--sh-skeleton, #f1f5f9)' }} />
              <div style={{ width: 60, height: 16, borderRadius: 6, background: 'var(--sh-skeleton, #f1f5f9)' }} />
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sh-skeleton, #f1f5f9)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '80%', height: 13, borderRadius: 4, background: 'var(--sh-skeleton, #f1f5f9)', marginBottom: 4 }} />
                    <div style={{ width: '50%', height: 10, borderRadius: 4, background: 'var(--sh-skeleton, #f1f5f9)' }} />
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 1.6s ease-in-out infinite',
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </main>
  )
}
