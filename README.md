# 📚 StudyHub

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple?style=flat-square&logo=bootstrap)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)

> Platform belajar kolaboratif berbasis AI untuk pelajar dan mahasiswa Indonesia — manajemen tugas, catatan digital, forum diskusi, AI Tutor, dan Pomodoro Timer dalam satu aplikasi.

---

## 📌 Daftar Isi

- [Tentang Project](#-tentang-project)
- [Tech Stack](#-tech-stack)
- [Fitur Utama](#-fitur-utama-15-fitur)
- [Struktur Folder](#-struktur-folder)
- [Cara Instalasi](#-cara-instalasi)
- [Environment Variables](#-environment-variables)
- [Menjalankan Project](#-menjalankan-project)
- [API Endpoints](#-api-endpoints)
- [Agile Timeline](#-agile-timeline)
- [Cara Berkontribusi](#-cara-berkontribusi)
- [Troubleshooting](#-troubleshooting)
- [Lisensi](#-lisensi)

---

## 🌟 Tentang Project

StudyHub hadir untuk mengatasi **fragmentasi alat belajar** yang umum dialami pelajar — catatan di satu aplikasi, tugas di tempat lain, diskusi di platform berbeda.

Dengan StudyHub, semua kebutuhan belajar tersentralisasi:

- ✅ Kelola tugas dan deadline dalam satu tampilan
- 📝 Buat catatan digital dengan editor Markdown
- 🤖 Tanya soal langsung ke AI Tutor berbasis Claude
- ⏱️ Gunakan Pomodoro Timer untuk sesi belajar fokus
- 💬 Diskusi dan tanya-jawab di forum komunitas
- 🏆 Sistem poin dan leaderboard untuk motivasi belajar

**Dikembangkan dengan metodologi Agile** — 6 Sprint selama 12 minggu.

---

## 🚀 Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Framework | Next.js 14 (App Router) |
| UI Library | Bootstrap 5.3 + React-Bootstrap |
| Language | TypeScript |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Auth | NextAuth.js v4 (Credentials + Google OAuth) |
| AI | Anthropic Claude API (claude-haiku) |
| Data Fetching | SWR + Axios |
| Form | React Hook Form + Zod |
| Editor | @uiw/react-md-editor |
| Chart | Chart.js + react-chartjs-2 |
| Deployment | Vercel |

---

## 📋 Fitur Utama (15 Fitur)

### 🟣 Sprint 1 — Fondasi (Minggu 1–2)

#### F1 — Registrasi & Login
- Registrasi dengan nama, email, dan password
- Login via Google OAuth
- JWT-based session dengan NextAuth.js
- Proteksi route otomatis via middleware
- Halaman lupa password

#### F2 — Dashboard Utama
- Ringkasan tugas hari ini dan upcoming deadline
- Statistik: total tugas aktif, catatan, notifikasi
- Quick action: Tambah Tugas, Buat Catatan, Mulai Timer
- Welcome banner dengan nama pengguna

#### F3 — Profil Pelajar
- Foto profil, nama, bio, institusi, jurusan
- Statistik belajar: poin, streak, total sesi
- Edit profil dan ubah password

---

### 🟢 Sprint 2 — Produktivitas (Minggu 3–4)

#### F4 — Manajemen Tugas
- CRUD tugas lengkap dengan modal form
- Prioritas: Tinggi / Sedang / Rendah
- Status: Belum Mulai / Sedang Dikerjakan / Selesai
- Filter berdasarkan status dan prioritas
- Tag mata pelajaran
- Sistem poin: +2 buat tugas, +10 selesaikan tugas

#### F5 — Kalender Belajar
- Tampilan kalender bulanan & mingguan
- Jadwal belajar dengan warna per mata pelajaran
- Reminder via Web Notification API

---

### 🔵 Sprint 3 — Kolaborasi (Minggu 5–6)

#### F6 — Catatan Digital
- Editor Markdown dengan live preview (MDEditor)
- Auto-save setiap 30 detik
- Tag dan kategorisasi catatan
- Pencarian full-text
- API: GET/POST/PATCH/DELETE `/api/notes`

#### F7 — Upload Materi
- Upload PDF, gambar (JPG/PNG), dokumen
- Batas 10 MB per file
- Preview PDF di browser
- Simpan di Supabase Storage

#### F8 — Grup Belajar
- Buat grup dengan kode undangan unik
- Shared notes dalam grup
- Peran: Admin / Anggota
- Maks 30 anggota per grup

---

### 🟡 Sprint 4 — Komunitas & AI (Minggu 7–8)

#### F9 — Diskusi Forum
- Thread tanya-jawab per mata pelajaran
- Reply bertingkat, upvote, Best Answer
- Filter: terbaru, terpopuler, belum terjawab
- API: GET/POST `/api/forum`

#### F10 — AI Tutor
- Chat AI menggunakan Claude API
- Jawab soal teks & gambar
- Rangkum materi panjang
- Histori sesi tersimpan di database
- Limit 50 pertanyaan/hari (free tier)
- API: GET/POST `/api/ai`

---

### 🟠 Sprint 5 — Gamifikasi & Fokus (Minggu 9–10)

#### F11 — Flashcard AI
- Generate flashcard dari catatan via AI
- Mode kuis interaktif dengan spaced repetition
- Buat flashcard manual
- Bagikan deck ke grup

#### F12 — Pomodoro Timer
- Timer 25 menit fokus + 5 menit istirahat
- Circular progress SVG animasi
- Browser notification saat selesai
- Histori sesi tersimpan
- Sistem poin: +15 per sesi pomodoro
- API: GET/POST `/api/timer`

#### F13 — Leaderboard & Gamifikasi
- Poin dari semua aktivitas belajar
- Badge pencapaian
- Leaderboard global dan per grup

---

### 🔴 Sprint 6 — Notifikasi & Insight (Minggu 11–12)

#### F14 — Notifikasi & Email
- In-app notification center
- Push notification browser
- Email digest mingguan

#### F15 — Analitik Progress
- Grafik waktu belajar (bar chart)
- Heatmap aktivitas (GitHub-style)
- Streak harian
- Export laporan PDF

---

## 🏗️ Struktur Folder

```
studyhub/
├── app/
│   ├── page.tsx                        # Redirect ke dashboard / login
│   ├── layout.tsx                      # Root layout + Bootstrap import
│   ├── providers.tsx                   # SessionProvider wrapper
│   ├── auth/
│   │   ├── login/page.tsx              # Halaman login
│   │   └── register/page.tsx           # Halaman registrasi
│   ├── dashboard/
│   │   ├── layout.tsx                  # Layout dengan Sidebar + Topbar
│   │   └── page.tsx                    # Dashboard utama (Server Component)
│   ├── tasks/page.tsx                  # Manajemen tugas
│   ├── notes/                          # Catatan digital
│   ├── forum/                          # Diskusi forum
│   ├── ai-tutor/page.tsx               # AI Tutor chat UI
│   ├── timer/page.tsx                  # Pomodoro Timer
│   ├── profile/                        # Profil & analitik
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/route.ts  # NextAuth handler
│       │   └── register/route.ts       # POST register user baru
│       ├── tasks/
│       │   ├── route.ts                # GET list, POST create
│       │   └── [id]/route.ts           # PATCH update, DELETE
│       ├── notes/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── forum/route.ts
│       ├── ai/route.ts                 # Claude API proxy
│       └── timer/route.ts
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                 # Navigasi sidebar dengan user session
│   │   └── Topbar.tsx                  # Header atas dengan notifikasi
│   ├── ui/                             # Reusable components
│   └── features/                       # Feature-specific components
│
├── lib/
│   ├── auth.ts                         # NextAuth config (Google + Credentials)
│   └── db.ts                           # Prisma singleton instance
│
├── prisma/
│   └── schema.prisma                   # 12 model database
│
├── styles/
│   └── globals.css                     # Bootstrap overrides + custom CSS
│
├── types/
│   └── next-auth.d.ts                  # Tambah field `id` ke Session
│
├── hooks/                              # Custom React hooks
├── middleware.ts                       # Auth guard untuk semua route
├── next.config.js
├── tsconfig.json
├── package.json
└── .env.example
```

---

## ⚙️ Cara Instalasi

### Prasyarat

Pastikan sudah terinstall di komputer kamu:

- [Node.js v20+](https://nodejs.org) — cek dengan `node -v`
- [PostgreSQL v15+](https://postgresql.org/download) **atau** akun [Supabase](https://supabase.com) (gratis, tanpa install lokal)
- [Git](https://git-scm.com)

### Langkah 1 — Clone Repository

```bash
git clone https://github.com/USERNAME/studyhub.git
cd studyhub
```

### Langkah 2 — Install Dependencies

```bash
npm install
```

Semua library di `package.json` akan terinstall otomatis.

### Langkah 3 — Setup Environment Variables

```bash
cp .env.example .env.local
```

Buka `.env.local` dan isi konfigurasi (lihat bagian [Environment Variables](#-environment-variables)).

### Langkah 4 — Setup Database

```bash
# Generate Prisma client dari schema
npx prisma generate

# Buat semua tabel di database
npx prisma migrate dev --name init
```

### Langkah 5 — Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — akan diarahkan otomatis ke halaman login.

---

## 🔑 Environment Variables

Buat file `.env.local` di root project:

```env
# ─── Database ────────────────────────────────────────────────
# PostgreSQL lokal:
DATABASE_URL="postgresql://postgres:password@localhost:5432/studyhub"
# Atau pakai Supabase (gratis, tanpa install):
# DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# ─── NextAuth ────────────────────────────────────────────────
# Generate secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXTAUTH_SECRET="isi-random-string-minimal-32-karakter"
NEXTAUTH_URL="http://localhost:3000"

# ─── Google OAuth (opsional) ─────────────────────────────────
# Daftar di: https://console.cloud.google.com → Credentials → OAuth 2.0
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"

# ─── Anthropic AI ────────────────────────────────────────────
# Daftar di: https://console.anthropic.com
ANTHROPIC_API_KEY="sk-ant-api03-xxx"

# ─── Supabase Storage (opsional, untuk upload file) ──────────
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

# ─── Email / SMTP (opsional, untuk notifikasi) ───────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="StudyHub <your@gmail.com>"
```

> **Minimal untuk development:** Kamu hanya butuh `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, dan `ANTHROPIC_API_KEY`. Fitur Google login, upload file, dan email bersifat opsional.

---

## ▶️ Menjalankan Project

### Mode Development

```bash
npm run dev       # http://localhost:3000
```

### Build Production

```bash
npm run build
npm start
```

### Perintah Prisma Berguna

```bash
npx prisma studio          # Buka GUI database di browser
npx prisma migrate reset   # Reset semua data (hati-hati!)
npx prisma db push         # Push schema tanpa migration file
npx prisma generate        # Generate ulang Prisma client
```

---

## 📡 API Endpoints

Semua endpoint memerlukan session yang valid kecuali endpoint registrasi.

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/auth/register` | Daftar akun baru |
| `POST` | `/api/auth/[...nextauth]` | Login / logout (NextAuth) |
| `GET` | `/api/auth/[...nextauth]` | Get session |

### Tasks
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/tasks` | List tugas (query: `status`, `priority`) |
| `POST` | `/api/tasks` | Buat tugas baru |
| `PATCH` | `/api/tasks/[id]` | Update tugas |
| `DELETE` | `/api/tasks/[id]` | Hapus tugas |

### Notes
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/notes` | List catatan (query: `search`) |
| `POST` | `/api/notes` | Buat catatan baru |
| `GET` | `/api/notes/[id]` | Detail catatan |
| `PATCH` | `/api/notes/[id]` | Update catatan |
| `DELETE` | `/api/notes/[id]` | Hapus catatan |

### Forum
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/forum` | List thread (query: `subject`, `sort`, `search`) |
| `POST` | `/api/forum` | Buat thread baru |

### AI Tutor
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/ai` | Kirim pesan ke Claude AI |
| `GET` | `/api/ai` | Riwayat sesi AI (20 terbaru) |

### Timer
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/timer` | Simpan sesi timer yang selesai |
| `GET` | `/api/timer` | Riwayat sesi (query: `days`, default 7) |

---

## 🗓️ Agile Timeline

| Sprint | Periode | Fitur yang Dikerjakan | Status |
|--------|---------|----------------------|--------|
| Sprint 1 | Minggu 1–2 | F1 Auth, F2 Dashboard, F3 Profil | 🔄 In Progress |
| Sprint 2 | Minggu 3–4 | F4 Manajemen Tugas, F5 Kalender | ⏳ Planned |
| Sprint 3 | Minggu 5–6 | F6 Catatan, F7 Upload, F8 Grup Belajar | ⏳ Planned |
| Sprint 4 | Minggu 7–8 | F9 Forum Diskusi, F10 AI Tutor | ⏳ Planned |
| Sprint 5 | Minggu 9–10 | F11 Flashcard, F12 Timer, F13 Leaderboard | ⏳ Planned |
| Sprint 6 | Minggu 11–12 | F14 Notifikasi, F15 Analitik Progress | ⏳ Planned |

---

## 🤝 Cara Berkontribusi

1. **Fork** repository ini
2. **Buat branch** baru dari `main`:
   ```bash
   git checkout -b feature/nama-fitur
   ```
3. **Commit** perubahan dengan format konvensional:
   ```bash
   git commit -m "feat: tambah halaman catatan"
   git commit -m "fix: perbaiki bug filter tugas"
   git commit -m "docs: update README"
   ```
4. **Push** ke branch kamu:
   ```bash
   git push origin feature/nama-fitur
   ```
5. Buka **Pull Request** ke branch `main`

### Konvensi Commit

| Prefix | Kegunaan |
|--------|----------|
| `feat:` | Fitur baru |
| `fix:` | Bug fix |
| `docs:` | Perubahan dokumentasi |
| `style:` | Format kode (tidak mengubah logika) |
| `refactor:` | Refactor kode |
| `chore:` | Update dependencies, config |

---

## 🔧 Troubleshooting

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `Cannot find module 'next'` | Dependencies belum terinstall | Jalankan `npm install` |
| `PrismaClientInitializationError` | Database tidak bisa diakses | Cek `DATABASE_URL` dan pastikan PostgreSQL berjalan |
| `NEXTAUTH_SECRET` error | File `.env.local` kosong atau tidak ada | Buat dari `.env.example`, isi NEXTAUTH_SECRET |
| `Module not found: '@next-auth/prisma-adapter'` | Package hilang | `npm install @next-auth/prisma-adapter` |
| Port 3000 sudah dipakai | Aplikasi lain berjalan di port sama | `npm run dev -- -p 3001` |
| `Invalid API Key` di AI Tutor | `ANTHROPIC_API_KEY` salah atau kosong | Cek key di [console.anthropic.com](https://console.anthropic.com) |
| Prisma migration error | Schema berubah tanpa migrate | `npx prisma migrate dev` |
| `hydration error` di Next.js | Perbedaan render server vs client | Tambahkan `'use client'` di komponen yang butuh state |

---

## 📄 Lisensi

Didistribusikan di bawah **MIT License** — bebas digunakan, dimodifikasi, dan didistribusikan dengan menyertakan copyright notice.

---

## 👨‍💻 Tim

| Nama | Role | Kontak |
|------|------|--------|
| Kelvin Chen | Project Lead / Full-stack Dev | kelvin.chen996@gmail.com |

---

<div align="center">

**⭐ Kalau project ini bermanfaat, jangan lupa beri bintang di GitHub!**

*"Belajar lebih mudah ketika kita belajar bersama."* 🎓

</div>
