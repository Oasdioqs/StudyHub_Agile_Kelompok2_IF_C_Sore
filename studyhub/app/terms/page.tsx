'use client'

import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="terms-wrapper">

      
      
      <div className="hero">
        <h1>Syarat & Ketentuan</h1>
        <p>Baca dulu ya sebelum lanjut — biar sama-sama enak 😏</p>
      </div>

      
      <div className="card terms-card p-4 p-md-5">

        <p className="date">Terakhir diperbarui: 26 Maret 2026</p>

        <div className="terms-content">

          <section>
            <h5>📌 Penggunaan Layanan</h5>
            <p>
              StudyHub hanya boleh digunakan untuk tujuan belajar dan aktivitas positif.
            </p>
          </section>

          <section>
            <h5>🔐 Akun Pengguna</h5>
            <p>
              Kamu bertanggung jawab menjaga keamanan akunmu. Jangan bagikan password ke siapa pun.
            </p>
          </section>

          <section>
            <h5>📊 Data & Privasi</h5>
            <p>
              Data kamu akan kami jaga dengan baik, namun tetap gunakan platform secara bijak.
            </p>
          </section>

          <section>
            <h5>🚫 Larangan</h5>
            <ul>
              <li>Spam atau penyalahgunaan sistem</li>
              <li>Konten berbahaya atau ilegal</li>
              <li>Mengganggu pengguna lain</li>
            </ul>
          </section>

          <section>
            <h5>⚙️ Perubahan Layanan</h5>
            <p>
              Kami dapat memperbarui layanan kapan saja untuk meningkatkan pengalaman pengguna.
            </p>
          </section>

          <section>
            <h5>✅ Persetujuan</h5>
            <p>
              Dengan mendaftar, kamu menyetujui semua syarat yang berlaku.
            </p>
          </section>

        </div>

        
        <div className="mt-4">
          <Link href="/auth/register" className="btn-modern w-100 fw-semibold text-center d-block">
            Saya Mengerti
          </Link>
        </div>

      </div>

      
      <style jsx>{`
        .terms-wrapper {
          min-height: 100vh;
          padding: 60px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: linear-gradient(-45deg, #eef2ff, #fdf2f8, #e0e7ff, #fce7f3);
          background-size: 400% 400%;
          animation: gradientMove 12s ease infinite;
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        
        .hero {
          text-align: center;
          margin-bottom: 25px;
        }

        .hero h1 {
          font-weight: 800;
          font-size: 28px;
          margin-bottom: 6px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero p {
          font-size: 14px;
          color: #666;
        }

        
        .terms-card {
          max-width: 760px;
          width: 100%;
          border-radius: 24px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(18px);
          box-shadow: 0 25px 70px rgba(0,0,0,0.18);
          transition: 0.3s;
        }

        .terms-card:hover {
          transform: translateY(-6px);
        }

        .date {
          font-size: 12px;
          color: #888;
          margin-bottom: 20px;
        }

        
        .terms-content section {
          margin-bottom: 18px;
          padding: 16px;
          border-radius: 14px;
          transition: all 0.25s ease;
          border: 1px solid transparent;
        }

        .terms-content section:hover {
          background: rgba(99,102,241,0.06);
          border-color: rgba(99,102,241,0.15);
          transform: translateX(6px);
        }

        .terms-content h5 {
          font-weight: 700;
          margin-bottom: 6px;
        }

        .terms-content p,
        .terms-content li {
          font-size: 14px;
          color: #555;
          line-height: 1.7;
        }

        .btn-modern {
          display: block;
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
          color: white !important;
          border: none !important;
          position: relative;
          overflow: hidden;
          text-decoration: none;
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

      `}</style>
    </div>
  )
}