import { getApiBaseUrl } from './config'

export type AuthUser = {
  id: string
  email: string | null
  name: string | null
  image: string | null
}

export type Task = {
  id: string
  title: string
  description: string | null
  subject: string | null
  deadline: string | null
  priority: string
  status: string
  createdAt: string
}

export type DashboardStats = {
  todayTasks: { id: string; title: string; deadline: string | null; status: string; priority: string; subject: string | null }[]
  upcomingTasks: { id: string; title: string; deadline: string | null; status: string; priority: string; subject: string | null }[]
  doneToday: number
  totalToday: number
  progress: number
  overdueCount: number
  upcomingDue: number
  unreadNotifs: number
}

function friendlyHttpError(text: string, status: number): string | null {
  const t = text.trim()
  if (
    t.includes('This action with HTTP POST is not supported by NextAuth') ||
    t.includes('next-auth') ||
    t.includes('NextAuth')
  ) {
    return 'Server membalas salah. Pastikan aplikasi pakai URL API terbaru, lalu coba lagi.'
  }
  if (status >= 500) return 'Server sibuk atau error. Coba lagi nanti.'
  return null
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text()
  const friendly = friendlyHttpError(text, res.status)
  if (friendly) return friendly
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    return j.error || j.message || text || res.statusText
  } catch {
    return text || res.statusText || `HTTP ${res.status}`
  }
}

export async function registerAccount(name: string, email: string, password: string): Promise<{ id: string; name: string; email: string }> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

export async function loginWithPassword(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const base = getApiBaseUrl().replace(/\/$/, '')
  const res = await fetch(`${base}/api/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ token: string; user: AuthUser }>
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiPostJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiPatchJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export function fetchDashboardStats(token: string) {
  return apiGet<DashboardStats>('/api/dashboard/stats', token)
}

export function fetchTasks(token: string) {
  return apiGet<Task[]>('/api/tasks', token)
}

export function toggleTaskDone(token: string, task: Task, done: boolean) {
  return apiPatchJson<Task>(`/api/tasks/${task.id}`, token, {
    status: done ? 'DONE' : 'TODO',
  })
}

export function createTask(token: string, title: string, subject?: string) {
  return apiPostJson<Task>('/api/tasks', token, {
    title: title.trim(),
    subject: subject?.trim() || undefined,
    priority: 'MEDIUM',
  })
}
