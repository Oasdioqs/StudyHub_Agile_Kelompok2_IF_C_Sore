'use client'
// app/auth/register/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Password dan konfirmasi password tidak cocok.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await axios.post('/api/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      router.push('/auth/login?registered=1')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: '#f8fafc' }}>
      <div className="card p-4 p-md-5" style={{ width: '100%', maxWidth: 460 }}>
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
            style={{ width: 56, height: 56, background: '#ede9fe' }}>
            <i className="bi bi-person-plus" style={{ fontSize: 24, color: '#4f46e5' }}></i>
          </div>
          <h4 className="fw-bold mb-1">Buat Akun Baru</h4>
          <p className="text-muted small">
            Sudah punya akun?{' '}
            <Link href="/auth/login" className="text-primary fw-semibold text-decoration-none">
              Masuk di sini
            </Link>
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small">
            <i className="bi bi-exclamation-circle me-1"></i>{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Nama Lengkap</label>
            <input name="name" type="text" className="form-control"
              placeholder="Nama kamu" value={form.name} onChange={handleChange} required />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Email</label>
            <input name="email" type="email" className="form-control"
              placeholder="nama@email.com" value={form.email} onChange={handleChange} required />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Password</label>
            <input name="password" type="password" className="form-control"
              placeholder="Minimal 8 karakter" value={form.password} onChange={handleChange}
              minLength={8} required />
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold small">Konfirmasi Password</label>
            <input name="confirm" type="password" className="form-control"
              placeholder="Ulangi password" value={form.confirm} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn btn-primary w-100 fw-semibold" disabled={loading}>
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>Mendaftar...</>
            ) : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="text-muted text-center mt-3 mb-0" style={{ fontSize: 12 }}>
          Dengan mendaftar, kamu menyetujui{' '}
          <a href="#" className="text-decoration-none">Syarat & Ketentuan</a> kami.
        </p>
      </div>
    </div>
  )
}
