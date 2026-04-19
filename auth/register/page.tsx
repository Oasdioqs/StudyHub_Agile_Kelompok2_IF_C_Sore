'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { useRive } from '@rive-app/react-canvas'

export default function RegisterPage() {
  const router = useRouter()

  const { rive, RiveComponent } = useRive({
    src: '/bear.riv',
    stateMachines: 'Login Machine',
    autoplay: true,
  })

  const [inputs, setInputs] = useState<any>({})
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!rive) return

    const inputsMap = rive.stateMachineInputs('Login Machine') || []

    setInputs({
      isFocus: inputsMap.find((i) => i.name === 'isFocus'),
      numLook: inputsMap.find((i) => i.name === 'numLook'),
      isPrivateField: inputsMap.find((i) => i.name === 'isPrivateField'),
      isPrivateFieldShow: inputsMap.find((i) => i.name === 'isPrivateFieldShow'),
      successTrigger: inputsMap.find((i) => i.name === 'successTrigger'),
      failTrigger: inputsMap.find((i) => i.name === 'failTrigger'),
    })
  }, [rive])

  const setVal = (input: any, val: any) => {
    if (input) input.value = val
  }

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agree, setAgree] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fireRiveTrigger = (trigger: any) => {
    if (trigger && typeof trigger.fire === 'function') {
      trigger.fire()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const isValid =
    form.name.length > 2 &&
    form.email.includes('@') &&
    form.password.length >= 8 &&
    form.password === form.confirm &&
    agree

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await axios.post('/api/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })

      fireRiveTrigger(inputs?.successTrigger)
      setSuccess('Akun berhasil dibuat! Cek email kamu untuk verifikasi sebelum login.')

      setLoading(false)
    } catch (err: any) {
      fireRiveTrigger(inputs?.failTrigger)
      setError(err.response?.data?.message || 'Terjadi kesalahan.')
      setLoading(false)
    }
  }

  return (
    <div className="register-wrapper">
      <div className="bear-wrapper">
        <RiveComponent className="bear-canvas" />
      </div>

      <div className="card register-card p-4 p-md-5">
        <div className="text-center mb-4">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
            <img src="/logo.svg" alt="StudyHub" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <span className="fw-bold" style={{ fontSize: '1.5rem', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>StudyHub</span>
          </div>
          <h4 className="fw-bold mb-1">Buat Akun Baru</h4>
          <p className="text-muted small">
            Sudah punya akun?{' '}
            <Link href="/auth/login" className="link-primary">
              Masuk di sini
            </Link>
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success py-2 small">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Nama Lengkap</label>
            <input
              name="name"
              type="text"
              className="form-control input-modern"
              placeholder="Claire123"
              value={form.name}
              onFocus={() => setVal(inputs.isFocus, true)}
              onBlur={() => setVal(inputs.isFocus, false)}
              onChange={(e) => {
                handleChange(e)
                setVal(inputs.numLook, e.target.value.length)
              }}
            />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">Email</label>
            <input
              name="email"
              type="email"
              className="form-control input-modern"
              placeholder="nama@gmail.com"
              value={form.email}
              onFocus={() => setVal(inputs.isFocus, true)}
              onBlur={() => setVal(inputs.isFocus, false)}
              onChange={(e) => {
                handleChange(e)
                setVal(inputs.numLook, e.target.value.length)
              }}
            />
          </div>

          <div className="mb-3 position-relative">
            <label className="form-label small fw-semibold">Password</label>
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="form-control input-modern pe-5"
              placeholder="Minimal 8 karakter"
              value={form.password}
              onFocus={() => setVal(inputs.isPrivateField, true)}
              onBlur={() => setVal(inputs.isPrivateField, false)}
              onChange={handleChange}
            />

            <span
              className="eye-icon"
              onClick={() => {setShowPassword(!showPassword)
                setVal(inputs.isPrivateFieldShow, !showPassword)
              }}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </span>
          </div>

          <div className="mb-3 position-relative">
            <label className="form-label small fw-semibold">Konfirmasi Password</label>
            <input
              name="confirm"
              type={showConfirm ? 'text' : 'password'}
              className="form-control input-modern pe-5"
              placeholder="Minimal 8 karakter"
              value={form.confirm}
              onFocus={() => setVal(inputs.isPrivateField, true)}
              onBlur={() => setVal(inputs.isPrivateField, false)}
              onChange={handleChange}
            />

            <span
              className="eye-icon"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </span>
          </div>

          <div className="form-check mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              id="agree"
            />
            <label className="form-check-label small" htmlFor="agree">
              Saya menyetujui{' '}
              <a href="/terms" className="link-primary">Syarat & Ketentuan</a>
            </label>
          </div>

          <button
            type="submit"
            onClick={() => {
              if (success) router.push('/auth/login')
            }}
            className={`btn btn-modern w-100 fw-semibold ${!isValid && !success ? 'btn-disabled' : ''}`}
            disabled={(!isValid && !success) || loading}
          >
            {success
              ? 'Balik ke Login'
              : loading
              ? 'Mendaftar...'
              : 'Daftar Sekarang'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .register-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
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
        .bear-wrapper {
          width: 240px;
          height: 200px;
          margin-bottom: -35px;
          z-index: 0;
        }
        .bear-canvas {
          width: 100%;
          height: 100%;
        }
        .register-card {
          max-width: 460px;
          width: 100%;
          border-radius: 22px;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .input-modern {
          border-radius: 12px;
          transition: all 0.25s ease;
          border: 1px solid #e5e7eb;
        }
        .input-modern:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.15);
          transform: scale(1.02);
        }
        .btn-modern {
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
        }
        .eye-icon {
          position: absolute;
          right: 12px;
          top: 73%;
          transform: translateY(-50%);
          cursor: pointer;
          opacity: 0.6;
        }
        .eye-icon:hover {
          opacity: 1;
        }
        .link-primary {
          color: #6366f1;
          text-decoration: none;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
