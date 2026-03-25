'use client'
// app/auth/login/page.tsx
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email atau password salah.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: '#f8fafc' }}>
      <div className="card p-4 p-md-5" style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
            style={{ width: 56, height: 56, background: '#ede9fe' }}>
            <i className="bi bi-book-half" style={{ fontSize: 26, color: '#4f46e5' }}></i>
          </div>
          <h4 className="fw-bold mb-1">Masuk ke StudyHub</h4>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Belum punya akun?{' '}
            <Link href="/auth/register" className="text-primary fw-semibold text-decoration-none">
              Daftar gratis
            </Link>
          </p>
        </div>

        {/* Google login */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="btn btn-outline-secondary w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Masuk dengan Google
        </button>

        <div className="d-flex align-items-center gap-2 mb-3">
          <hr className="flex-grow-1 m-0" />
          <span className="text-muted small">atau</span>
          <hr className="flex-grow-1 m-0" />
        </div>

        {/* Form */}
        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            <i className="bi bi-exclamation-circle me-1"></i>{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <div className="d-flex justify-content-between">
              <label className="form-label fw-semibold small">Password</label>
              <Link href="/auth/forgot-password" className="small text-primary text-decoration-none">
                Lupa password?
              </Link>
            </div>
            <input
              type="password"
              className="form-control"
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100 fw-semibold"
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>Memproses...</>
            ) : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
