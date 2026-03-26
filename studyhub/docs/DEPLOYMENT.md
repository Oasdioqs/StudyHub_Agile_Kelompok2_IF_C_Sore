# Deploy StudyHub (Vercel) — Google OAuth & OTP email

Semua variabel berikut harus **Production** di Vercel (**Settings → Environment Variables** atau `vercel env add`).

## Nilai wajib

| Variable | Contoh / catatan |
|----------|-------------------|
| `NEXTAUTH_SECRET` | String acak panjang (min. 32 karakter). Boleh sama dengan lokal. |
| `NEXTAUTH_URL` | **HTTPS** ke domain produk, tanpa slash akhir: `https://studyhub-olive.vercel.app` |
| `DATABASE_URL` | Connection string pooler Supabase (`...pooler...:6543?pgbouncer=true`). |
| `DIRECT_URL` | Direct Supabase (`...:5432/postgres`) untuk migrasi Prisma. |
| `GOOGLE_CLIENT_ID` | Dari Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Dari Google Cloud Console. |
| `RESEND_API_KEY` | Dari dashboard Resend. |
| `OPENROUTER_API_KEY` | Jika pakai AI Tutor via OpenRouter. |

**Penting:** `NEXTAUTH_URL` di production harus **tepat** sama dengan URL yang dibuka user. Kalau salah, cookie session / callback Google bisa gagal.

## Google OAuth — konfigurasi console

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID (Web).
2. **Authorized JavaScript origins**  
  Tambahkan: `https://studyhub-olive.vercel.app`
3. **Authorized redirect URIs**  
  Tambahkan: `https://studyhub-olive.vercel.app/api/auth/callback/google`
4. Simpan; tunggu beberapa menit bila perlu.

Tanpa redirect URI yang benar, login Google akan error setelah memilih akun.

## OTP & email (Resend)

- OTP login memakai **Resend** dan `from` email memakai `EMAIL_FROM` dari environment (`EMAIL_FROM` wajib di Vercel Production).
- Untuk kirim ke email siapa pun: verifikasi domain / `from` address di Resend (kalau tidak, Resend akan menolak dan bilang hanya bisa kirim ke alamat test milik kamu).

Setelah deploy, uji: register baru → email verifikasi → login → OTP ke inbox.

## Cek cepat kalau “Google / OTP tidak jalan”

1. **Vercel** → Environment Variables: apakah semua key di atas ada untuk **Production**?
2. **NEXTAUTH_URL** = URL Vercel yang persis (bukan `localhost`).
3. **Google** redirect URI mengandung `/api/auth/callback/google` dengan HTTPS yang sama.
4. **Supabase**: firewall allow; `DATABASE_URL` memakai pooler jika app serverless.
