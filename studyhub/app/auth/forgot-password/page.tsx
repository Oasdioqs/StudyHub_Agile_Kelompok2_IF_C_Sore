'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValid = email.includes('@')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const text = await res.text()
      let data: any = null
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }

      if (!res.ok) {
        throw new Error(data?.message || 'Gagal mengirim link reset.')
      }

      setSuccess('Link reset password sudah dikirim ke email kamu 📩')
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-wrapper">

      <div className="card forgot-card p-4 p-md-5">

        
        <div className="text-center mb-4">
          <div className="icon-box mb-3">
            <i className="bi bi-envelope"></i>
          </div>
          <h4 className="fw-bold mb-1">Lupa Password?</h4>
          <p className="text-muted small">
            Masukkan email kamu, kami kirim link reset 🔐
          </p>
        </div>

        
        {error && (
          <div className="alert alert-danger py-2 small text-center">
            {error}
          </div>
        )}

        
        {success && (
          <div className="alert alert-success py-2 small text-center">
            {success}
          </div>
        )}

        
        {!success && (
          <form onSubmit={handleSubmit}>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Email</label>
              <input
                type="email"
                className="form-control input-modern"
                placeholder="contoh@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              className={`btn-modern w-100 fw-semibold ${!isValid ? 'btn-disabled' : ''}`}
              disabled={!isValid || loading}
            >
              {loading ? 'Mengirim...' : 'Kirim Link Reset'}
            </button>
          </form>
        )}

        
        <div className="text-center mt-3">
          <Link href="/auth/login" className="link-primary small">
            ← Kembali ke Login
          </Link>
        </div>

      </div>

      
      <style jsx>{`
        .forgot-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(-45deg, #eef2ff, #fdf2f8, #e0e7ff, #fce7f3);
          background-size: 400% 400%;
          animation: gradientMove 12s ease infinite;
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .forgot-card {
          max-width: 420px;
          width: 100%;
          border-radius: 22px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        .icon-box {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #ede9fe;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: auto;
          font-size: 24px;
          color: #6366f1;
        }

        .input-modern {
          border-radius: 12px;
          transition: 0.25s;
        }

        .input-modern:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.15);
          transform: scale(1.02);
        }

        
        .btn-modern {
          display: block;
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease;
        }

        .btn-modern::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.5), transparent);
          transform: translateX(-100%);
        }

        .btn-modern:hover::before {
          transform: translateX(100%);
          transition: 0.6s;
        }

        .btn-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(99,102,241,0.4);
        }

        .btn-disabled {
          background: #d1d5db !important;
          cursor: not-allowed;
          box-shadow: none !important;
        }

        .link-primary {
          color: #6366f1;
          text-decoration: none;
          font-weight: 600;
        }

        .link-primary:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}