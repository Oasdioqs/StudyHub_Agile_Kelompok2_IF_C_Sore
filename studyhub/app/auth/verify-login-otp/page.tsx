'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function VerifyLoginOtpPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const sessionEmail = session?.user?.email

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const otpInputRef = useRef<HTMLInputElement>(null)
  const requestedOtpRef = useRef(false)

  const waitForSession = useCallback(async (tries = 8, delayMs = 250) => {
    for (let i = 0; i < tries; i += 1) {
      const s = await getSession().catch(() => null)
      if (s?.user?.id) return true
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    return false
  }, [])

  const waitForSessionEmail = useCallback(async (tries = 10, delayMs = 250) => {
    for (let i = 0; i < tries; i += 1) {
      const s = await getSession().catch(() => null)
      const email = s?.user?.email
      if (typeof email === 'string' && email) return email
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    return null
  }, [])

  const postJsonWithTimeout = useCallback(
    async (url: string, payload: unknown, timeoutMs = 12000) => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        })
        return res
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error('Request timeout. Cek koneksi internet lalu coba lagi.')
        }
        if (/failed to fetch|load failed/i.test(String(err?.message || ''))) {
          throw new Error('Load failed. Cek internet atau coba lagi beberapa detik.')
        }
        throw err
      } finally {
        clearTimeout(timer)
      }
    },
    [],
  )

  const requestOtpByEmail = useCallback(
    async (email: string) => {
      setError('')
      setOtpMessage('')
      setRequestLoading(true)
      try {
        const requestOnce = () => postJsonWithTimeout('/api/auth/request-login-otp', { email }, 12000)
        let res = await requestOnce()
        if (res.status === 503) {
          await new Promise((resolve) => setTimeout(resolve, 1200))
          res = await requestOnce()
        }

        const data = await res.json().catch(() => null)
        if (!res.ok) {
          if (res.status === 403) {
            router.push('/auth/verify-email')
            return
          }
          throw new Error(data?.message || 'Gagal mengirim OTP.')
        }

        setOtpMessage(data?.message || 'Kode OTP sudah dikirim ke email kamu.')
        setOtp('')
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan.')
      } finally {
        setRequestLoading(false)
      }
    },
    [router, postJsonWithTimeout],
  )

  const requestOtp = useCallback(async (force = false) => {
    if (requestedOtpRef.current && !force) return
    if (!sessionEmail) {
      const email = await waitForSessionEmail()
      if (!email) {
        setError('Email belum siap. Coba lagi.')
        return
      }
      requestedOtpRef.current = true
      return requestOtpByEmail(email)
    }

    requestedOtpRef.current = true
    setError('')
    setOtpMessage('')
    setRequestLoading(true)
    try {
      const requestOnce = () => postJsonWithTimeout('/api/auth/request-login-otp', { email: sessionEmail }, 12000)
      let res = await requestOnce()
      if (res.status === 503) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
        res = await requestOnce()
      }

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/auth/verify-email')
          return
        }
        throw new Error(data?.message || 'Gagal mengirim OTP.')
      }

      setOtpMessage(data?.message || 'Kode OTP sudah dikirim ke email kamu.')
      setOtp('')
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan.')
    } finally {
      setRequestLoading(false)
    }
  }, [sessionEmail, router, waitForSessionEmail, requestOtpByEmail, postJsonWithTimeout])

  useEffect(() => {
    if (status !== 'authenticated') return
    void requestOtp()
  }, [status, requestOtp])

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (verifyLoading) return
    setError('')

    if (!/^\d{6}$/.test(otp)) {
      setError('Masukkan kode OTP 6 digit.')
      return
    }

    setVerifyLoading(true)
    try {
      const emailForOtp =
        (typeof sessionEmail === 'string' && sessionEmail ? sessionEmail : await waitForSessionEmail()) || null
      if (!emailForOtp) {
        throw new Error('Email belum siap. Coba lagi.')
      }

      const res = await postJsonWithTimeout('/api/auth/verify-login-otp', { code: otp, email: emailForOtp }, 12000)

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/auth/verify-email')
          return
        }
        throw new Error(data?.message || 'Kode OTP salah.')
      }

      setVerified(true)
      await waitForSession()
      router.replace('/dashboard')
      router.refresh()
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.assign('/dashboard')
        }
      }, 350)
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan.')
    } finally {
      setVerifyLoading(false)
    }
  }

  return (
    <div className="verify-login-otp-wrapper">
      <div className="card verify-login-otp-card p-4 p-md-5">
        <div className="text-center mb-3">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="StudyHub" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <span className="fw-bold" style={{ fontSize: '1.3rem', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>StudyHub</span>
          </div>
          <h4 className="fw-bold mb-1">Masukkan Kode OTP</h4>
          <p className="text-muted small mb-0">
            Kami mengirim kode verifikasi ke{' '}
            <b>{session?.user?.email || 'email kamu'}</b>
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {otpMessage && <div className="alert alert-info py-2 small">{otpMessage}</div>}

        <form onSubmit={onVerify}>
          <label className="form-label small fw-semibold">Kode OTP</label>
          <div className="otp-input-shell" onClick={() => otpInputRef.current?.focus()}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className={`otp-box ${otp[idx] ? 'filled' : ''} ${verified ? 'ok' : ''}`}
              >
                {otp[idx] || ''}
              </div>
            ))}
          </div>
          <input
            ref={otpInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="otp-hidden-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            disabled={requestLoading || verifyLoading}
            maxLength={6}
          />

          <div className="mt-3 d-flex gap-2">
            <button
              type="submit"
              className="btn btn-modern w-100 fw-semibold"
              disabled={requestLoading || verifyLoading || !/^\d{6}$/.test(otp) || verified}
            >
              {verified ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-block', width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite', flexShrink: 0
                  }} />
                  Menuju Dashboard...
                </span>
              ) : verifyLoading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
          </div>

          <div className="text-center mt-3">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => requestOtp(true)}
              disabled={requestLoading || verifyLoading}
            >
              {requestLoading ? 'Mengirim...' : 'Kirim ulang kode'}
            </button>
          </div>
        </form>

        <div className="text-center mt-3">
          <button
            type="button"
            className="btn btn-link p-0 small link-primary"
            onClick={() => router.push('/auth/login')}
            disabled={requestLoading || verifyLoading}
          >
            Kembali ke Login
          </button>
        </div>
      </div>

      <style jsx>{`
        .verify-login-otp-wrapper {
          min-height: 100vh;
          min-height: 100dvh;
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

        .verify-login-otp-card {
          width: 100%;
          max-width: 520px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }

        .input-modern {
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          transition: all 0.25s ease;
        }

        .input-modern:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.15);
          transform: scale(1.02);
        }

        .otp-input-shell {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-top: 4px;
          cursor: text;
        }

        .otp-box {
          height: 52px;
          border-radius: 12px;
          border: 1.5px solid #d1d5db;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }

        .otp-box.filled {
          border-color: #6366f1;
          background: #eef2ff;
          color: #4338ca;
        }

        .otp-box.ok {
          border-color: #22c55e;
          background: #ecfdf3;
          color: #15803d;
        }

        .otp-hidden-input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
          width: 1px;
          height: 1px;
        }

        .btn-modern {
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          transition: all 0.25s ease;
          letter-spacing: 0.2px;
        }

        .btn-modern:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(99,102,241,0.35);
        }

        .btn-modern:disabled {
          opacity: 0.8;
          cursor: not-allowed;
          box-shadow: none;
        }

        .btn-modern.verified-state {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

