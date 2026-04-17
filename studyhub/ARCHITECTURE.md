# StudyHub — Architecture Documentation

## System Overview

StudyHub is a full-stack educational platform built with Next.js 14 (App Router), PostgreSQL via Prisma, and Capacitor for mobile.

## Architecture Diagram

```mermaid
graph TD
    subgraph Client["Client Layer"]
        WEB[Web Browser]
        APK[Android App\nCapacitor]
    end

    subgraph NextJS["Next.js 14 — App Router"]
        MW[Middleware\nAuth + OTP Guard]
        PAGES[Pages\ndashboard, tasks,\nkelas, forum, dll]
        API[API Routes\n60+ endpoints]
        SC[Server Components]
    end

    subgraph Auth["Authentication"]
        NA[NextAuth.js]
        CRED[Credentials\nEmail + Password]
        GOOGLE[Google OAuth]
        OTP[OTP Verification\nCookie-based]
    end

    subgraph AI["AI Layer"]
        OR[OpenRouter API\nLLM Gateway]
        PDF_AI[PDF AI\nSummarize + Q&A]
        TUTOR[AI Tutor\nChat Sessions]
        VID[Video Summary\nYouTube Transcript]
    end

    subgraph Storage["Storage & DB"]
        PG[(PostgreSQL\nPrisma ORM)]
        BLOB[Vercel Blob\nPDF + Files]
        FIREBASE[Firebase\nPush Notifications]
    end

    subgraph External["External Services"]
        SMTP[SMTP\nNodemailer\nEmail Verification]
        FCMTOKEN[FCM\nPush Notifications]
        YT[YouTube API\nTranscript]
    end

    WEB -->|HTTPS| MW
    APK -->|HTTPS + Bearer JWT| MW
    MW -->|Authorized| PAGES
    MW -->|Authorized| API
    PAGES --> SC
    API --> NA
    NA --> CRED
    NA --> GOOGLE
    NA --> OTP
    NA --> PG
    API --> PG
    API --> OR
    OR --> PDF_AI
    OR --> TUTOR
    OR --> VID
    API --> BLOB
    API --> FIREBASE
    FIREBASE --> FCMTOKEN
    API --> SMTP
    VID --> YT
```

## Layer Architecture

```
┌─────────────────────────────────────────┐
│           PRESENTATION LAYER            │
│  Pages (App Router) + Client Components │
├─────────────────────────────────────────┤
│              API LAYER                  │
│  Route Handlers (/api/**)               │
│  Auth middleware + Session validation   │
├─────────────────────────────────────────┤
│            BUSINESS LOGIC               │
│  lib/: auth, mail, notifications,       │
│         ai prompts, schedule logic      │
├─────────────────────────────────────────┤
│             DATA LAYER                  │
│  Prisma ORM → PostgreSQL                │
│  Vercel Blob (files)                    │
│  Firebase (push)                        │
└─────────────────────────────────────────┘
```

## Key Design Decisions

### Authentication Flow
1. User logs in via Credentials or Google OAuth
2. NextAuth issues JWT token
3. Middleware validates JWT on every protected route
4. OTP cookie (`otp_verified_for`) required for full access
5. Mobile uses `Authorization: Bearer <jwt>` header

### Database Pattern
- Single Prisma client singleton (`lib/db.ts`) to avoid connection pool exhaustion
- Transactions used for operations requiring consistency (e.g., create task + award points)
- All queries scoped to `userId` for data isolation

### AI Integration
- OpenRouter as LLM gateway (model-agnostic)
- Streaming responses for AI Tutor
- PDF: extract text → chunk → summarize via prompt templates

### Mobile Support
- Capacitor wraps Next.js web app as Android APK
- Separate mobile auth endpoints (`/api/mobile/login`, `/api/mobile/auth/google`)
- Bearer JWT for stateless mobile authentication

## Feature Map

| Feature | Pages | API Routes | DB Models |
|---------|-------|------------|-----------|
| Auth | /auth/* | /api/auth/* | User, Account, Session, LoginOtp |
| Dashboard | /dashboard | /api/dashboard/* | DashboardDay |
| Tasks | /tasks | /api/tasks/* | Task, ClassTask |
| Notes | /notes | /api/notes/* | Note |
| Kelas | /kelas/* | /api/kelas/* | Group, GroupMember, ClassTask |
| Forum | /forum/* | /api/forum/* | Thread, Reply |
| Flashcards | /flashcards/* | /api/flashcards/* | FlashcardSet, Flashcard |
| AI Tutor | /ai-tutor | /api/ai/* | AISession |
| PDF | /pdf/* | /api/pdf/* | PdfDocument, PdfChallenge |
| Timer | /timer | /api/timer/* | TimerSession |
| Leaderboard | /leaderboard | /api/leaderboard | User.points |
| Analytics | /analytics | /api/analytics | DashboardDay, TimerSession |
| Notifications | — | /api/notifications/* | Notification, FcmToken |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v4 |
| UI | Bootstrap 5 + React Bootstrap |
| AI | OpenRouter (LLM gateway) |
| File Storage | Vercel Blob |
| Push Notifications | Firebase Cloud Messaging |
| Email | Nodemailer |
| Mobile | Capacitor (Android) |
| Testing | Vitest |
| Deployment | Vercel |
