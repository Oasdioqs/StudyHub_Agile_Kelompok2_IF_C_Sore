# Threat Model — StudyHub

> Methodology: STRIDE + DREAD  
> Skill: senior-security

## System Scope

StudyHub adalah platform edukasi dengan fitur: auth, manajemen tugas/kelas, forum, AI tutor, PDF processing, notifikasi push, dan mobile app.

**Assets yang dilindungi:**
- Data pribadi pengguna (email, nama, password hash)
- Konten akademik (tugas, catatan, flashcard)
- Token auth (JWT, OTP cookie)
- API key (OpenRouter, Firebase, Vercel Blob)
- Data kelas dan anggota

---

## Data Flow Diagram (DFD)

```
[Browser/Android] → [Middleware: JWT+OTP Check] → [Next.js API Routes] → [PostgreSQL]
                                                                        → [OpenRouter AI]
                                                                        → [Vercel Blob]
                                                                        → [Firebase FCM]
                                                                        → [SMTP Email]
```

**Trust Boundaries:**
1. Internet → Next.js Edge (Middleware)
2. Next.js → PostgreSQL (private network)
3. Next.js → External APIs (OpenRouter, Firebase)

---

## STRIDE Analysis

### S — Spoofing (Pemalsuan Identitas)

| Threat | Target | DREAD Score | Mitigation |
|--------|--------|-------------|-----------|
| Attacker mencuri JWT token dan menggunakannya | API Routes | 7/10 | Token short-lived, OTP cookie doubly validates identity |
| Attacker mengirim request mobile dengan JWT palsu | `/api/mobile/*` | 6/10 | Token harus signed dengan `NEXTAUTH_SECRET` |
| Google OAuth token replay | `/api/auth/mobile/google` | 5/10 | Google minta `idToken` yang fresh dan one-time |

**Status:** ✅ Mitigasi baik — JWT + OTP layer double verification

---

### T — Tampering (Manipulasi Data)

| Threat | Target | DREAD Score | Mitigation |
|--------|--------|-------------|-----------|
| User mengubah `userId` di request body untuk akses data orang lain | POST endpoints | 8/10 | `userId` SELALU diambil dari token, tidak dari body |
| Manipulasi `isClassTask: true` di response untuk bypass business logic | Frontend | 5/10 | Flag di-generate server-side |
| SQL injection melalui search parameter `q` | GET /api/tasks | 6/10 | Prisma parameterized queries — aman |

**Status:** ✅ Aman — userId dari token, Prisma mencegah SQL injection

---

### R — Repudiation (Penyangkalan)

| Threat | Target | DREAD Score | Mitigation |
|--------|--------|-------------|-----------|
| User menyangkal sudah buat tugas/posting | Task, Forum | 4/10 | `createdAt`, `userId` disimpan di DB |
| Admin menyangkal pengumuman kelas | ClassAnnouncement | 4/10 | `createdById` tersimpan |

**Status:** ⚠️ Partial — data tersimpan tapi belum ada structured audit log

---

### I — Information Disclosure (Kebocoran Informasi)

| Threat | Target | DREAD Score | Mitigation |
|--------|--------|-------------|-----------|
| ~~Reset token bocor ke log~~ | Auth log | ~~9/10~~ | ✅ Fixed — console.log dihapus |
| Error message expose stack trace ke client | API Routes | 6/10 | Prisma error di-catch, return generic message |
| Env vars ter-expose di client bundle | `NEXT_PUBLIC_*` | 7/10 | Hanya VAPID key yang NEXT_PUBLIC — wajar |
| Password hash tersimpan di response | User API | 3/10 | `select` di Prisma tidak include `password` field |

**Status:** ✅ Baik setelah fix console.log

---

### D — Denial of Service (Penolakan Layanan)

| Threat | Target | DREAD Score | Mitigation |
|--------|--------|-------------|-----------|
| Brute force login — ribuan request ke `/api/auth` | Auth endpoints | 8/10 | ❌ Belum ada rate limiting |
| PDF upload spam — file besar menghabiskan Blob storage | `/api/pdf` | 7/10 | File size limit ada di `document-kind.ts` |
| AI endpoint abuse — biaya API meledak | `/api/ai`, `/api/pdf/*/ask` | 8/10 | ❌ Belum ada per-user AI quota |

**Status:** 🔴 Risiko — perlu rate limiting dan AI quota

---

### E — Elevation of Privilege (Eskalasi Hak Akses)

| Threat | Target | DREAD Score | Mitigation |
|--------|--------|-------------|-----------|
| User biasa akses endpoint admin (`/api/admin/*`) | Admin routes | 9/10 | Perlu diverifikasi — cek admin check |
| User non-anggota kelas akses data kelas | `/api/kelas/[id]` | 7/10 | GroupMember check ada di setiap kelas endpoint |
| Premium feature diakses user gratis | AI Tutor, PDF | 6/10 | `isPremium` check di session |

**Status:** ⚠️ Perlu audit `/api/admin/` endpoint

---

## Top 5 Risiko (Prioritas Penanganan)

| Rank | Risiko | DREAD | Action |
|------|--------|-------|--------|
| 1 | Tidak ada rate limiting di auth endpoint | 8/10 | Implementasi ASAP |
| 2 | Tidak ada per-user AI quota | 8/10 | Tambah usage tracking |
| 3 | Admin endpoint perlu role check yang eksplisit | 9/10 | Audit dan tambah middleware |
| 4 | Tidak ada structured audit log | 6/10 | Implementasi bertahap |
| 5 | AI endpoint tidak ada quota | 7/10 | Tambah premium check |

---

## Quick Win Implementations

### Rate Limiting (implementasi di middleware atau per-route)

```typescript
// lib/rate-limit.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(ip: string, limit = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}
```

### Admin Role Check

```typescript
// Tambah ke /api/admin/set-premium/route.ts
const session = await getServerSession(authOptions)
if (!session?.user?.isDeveloper) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```
