# StudyHub

Platform belajar kolaboratif berbasis AI untuk pelajar dan mahasiswa Indonesia.

## Tech Stack

- Next.js 14 (App Router)
- Bootstrap 5.3 + React-Bootstrap
- TypeScript
- PostgreSQL 15
- Prisma ORM
- Vercel

## Fitur

- Registrasi & Login
- Dashboard Utama
- Manajemen Tugas
- Kalender Belajar
- Catatan Digital
- Upload Materi
- Grup Belajar
- Diskusi Forum
- AI Tutor
- Flashcard
- Pomodoro Timer
- Leaderboard
- Notifikasi
- Analitik Progress

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Buat file `.env` di root project:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/studyhub"
```

### 3. Setup Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Jalankan Development Server

```bash
npm run dev
```

## Team

| Nama | Role | NIM |
|------|------|--------|
| Reihan Ali | Front-End Developer | 221111701 |
| Bryan Chandra | Full-Stack Developer | 241110637 |
| Steven Aurelio | Analyst | 201111110 |
| Stevania | Back-End Developer | 241111218 |
