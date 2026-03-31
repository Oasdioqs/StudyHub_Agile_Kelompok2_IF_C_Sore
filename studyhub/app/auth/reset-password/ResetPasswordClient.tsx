'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function ResetPasswordClient() {
  const params = useSearchParams()
  const router = useRouter()

  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isValid = password.length >= 8 && password === confirm

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      setSuccess('Password berhasil diubah 🎉')

      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="reset-wrapper">

      <div className="card reset-card p-4 p-md-5">

        <div className="text-center mb-4">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="StudyHub" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <span className="fw-bold" style={{ fontSize: '1.3rem', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>StudyHub</span>
          </div>
          <h4 className="text-center fw-bold mb-1">Reset Password</h4>
        </div>

        {error && (
          <div className="alert alert-danger small">{error}</div>
        )}

        {success && (
          <div className="alert alert-success small text-center">{success}</div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>

            <div className="mb-3 position-relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control input-modern pe-5"
                    placeholder="Password baru"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <span
                    className="eye-icon"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </span>
            </div>

            <div className="mb-3 position-relative">
                <input
                    type={showConfirm ? 'text' : 'password'}
                    className="form-control input-modern pe-5"
                    placeholder="Konfirmasi password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                />
                <span
                    className="eye-icon"
                    onClick={() => setShowConfirm(!showConfirm)}
                >
                    <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </span>
            </div>

            <button
              className={`btn-modern w-100 ${!isValid ? 'btn-disabled' : ''}`}
              disabled={!isValid || loading}
            >
              {loading ? 'Memproses...' : 'Reset Password'}
            </button>

          </form>
        )}

      </div>

      <style jsx>{`
        .reset-wrapper {
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

        .reset-card {
          max-width: 400px;
          width: 100%;
          border-radius: 20px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        .input-modern {
          border-radius: 12px;
        }

        .input-modern:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.15);
        }

        .btn-modern {
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
        }

        .btn-disabled {
          background: #ccc !important;
        }

        .eye-icon {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            opacity: 0.6;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            }

            .eye-icon i {
            font-size: 16px;
            }

            .eye-icon:hover {
            opacity: 1;
            }
      `}</style>
    </div>
  )
}
