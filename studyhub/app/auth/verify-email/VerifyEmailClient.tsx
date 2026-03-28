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
        setSuccess('Email kamu sudah terverifikasi. Siap login!')
        setLoading(false)

        setTimeout(() => {
          router.push('/auth/login')
        }, 1800)
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
      <div className="card verify-email-card p-4 p-md-5">
        <h4 className="text-center fw-bold mb-2">Verifikasi Email</h4>
        <p className="text-muted small text-center mb-4">
          {loading ? 'Memproses verifikasi...' : 'Mohon tunggu sebentar.'}
        </p>

        {error && <div className="alert alert-danger small">{error}</div>}
        {success && <div className="alert alert-success small">{success}</div>}

        {!loading && !error && !success && (
          <div className="alert alert-warning small">
            Verifikasi email belum selesai.
          </div>
        )}

        <div className="mt-3 text-center">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => router.push('/auth/login')}
            disabled={loading}
          >
            Kembali ke Login
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
          background: linear-gradient(-45deg, #eef2ff, #fdf2f8, #e0e7ff, #fce7f3);
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
          max-width: 520px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  )
}
