'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function VerifyEmailClient() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const hasRequestedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (hasRequestedRef.current) return
      hasRequestedRef.current = true

      if (!token) {
        setError('')
        setSuccess('Silakan cek email verifikasi yang dikirim saat pendaftaran. Setelah terverifikasi, kamu bisa login.')
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || 'Gagal verifikasi email.')

        setError('')
        setSuccess('Email kamu sudah terverifikasi! 🎉')
        setLoading(false)
        setRedirecting(true)

        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      } catch (e: any) {
        setSuccess('')
        setError(e?.message || 'Gagal verifikasi email.')
        setLoading(false)
      }
    }

    run()
  }, [token, router])

  return (
    <div className="verify-email-wrapper">
      <div className="verify-email-card">
        {/* Logo / Icon */}
        <div className="verify-icon-wrap">
          {loading ? (
            <div className="verify-spinner-ring" />
          ) : success ? (
            <div className="verify-icon-success">
              <i className="bi bi-check-lg" />
            </div>
          ) : (
            <div className="verify-icon-error">
              <i className="bi bi-x-lg" />
            </div>
          )}
        </div>

        <h4 className="verify-title">
          {loading ? 'Memverifikasi...' : success ? 'Verifikasi Berhasil!' : 'Verifikasi Gagal'}
        </h4>
        <p className="verify-subtitle">
          {loading
            ? 'Sedang memproses token verifikasi kamu...'
            : success
              ? redirecting ? 'Mengarahkan ke halaman login...' : 'Email kamu sudah aktif.'
              : 'Terjadi masalah dengan token verifikasi.'}
        </p>

        {error && (
          <div className="verify-alert error">
            <i className="bi bi-exclamation-triangle-fill me-2" />
            {error}
          </div>
        )}
        {success && (
          <div className="verify-alert success">
            <i className="bi bi-patch-check-fill me-2" />
            {success}
          </div>
        )}

        {!loading && !error && !success && (
          <div className="verify-alert warning">
            <i className="bi bi-exclamation-circle me-2" />
            Verifikasi email belum selesai.
          </div>
        )}

        <div className="mt-4 text-center">
          <button
            className="verify-btn"
            onClick={() => router.push('/auth/login')}
            disabled={loading || redirecting}
          >
            {redirecting ? (
              <>
                <span className="verify-btn-spinner" />
                Menuju Dashboard...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-left-circle me-2" />
                Kembali ke Login
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .verify-email-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(-45deg, #eef2ff, #fdf2f8, #e0e7ff, #f0fdf4);
          background-size: 400% 400%;
          animation: gradientMove 12s ease infinite;
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .verify-email-card {
          width: 100%;
          max-width: 480px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(20px);
          box-shadow: 0 24px 64px rgba(79, 70, 229, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08);
          padding: 40px 36px;
          text-align: center;
          animation: cardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .verify-icon-wrap {
          width: 72px;
          height: 72px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .verify-spinner-ring {
          width: 64px;
          height: 64px;
          border: 4px solid rgba(79, 70, 229, 0.15);
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: spin 0.85s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .verify-icon-success {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
          animation: popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .verify-icon-error {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.35);
          animation: popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .verify-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 8px;
          letter-spacing: -0.4px;
        }

        .verify-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          font-weight: 500;
          margin-bottom: 20px;
        }

        .verify-alert {
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
        }
        .verify-alert.success {
          background: #f0fdf4;
          color: #059669;
          border: 1px solid #bbf7d0;
        }
        .verify-alert.error {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .verify-alert.warning {
          background: #fffbeb;
          color: #d97706;
          border: 1px solid #fde68a;
        }

        .verify-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 28px;
          border-radius: 999px;
          border: 2px solid #e2e8f0;
          background: white;
          color: #475569;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 200px;
        }
        .verify-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #4f46e5;
          color: #4f46e5;
          transform: translateY(-1px);
        }
        .verify-btn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-color: transparent;
          color: white;
        }

        .verify-btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
