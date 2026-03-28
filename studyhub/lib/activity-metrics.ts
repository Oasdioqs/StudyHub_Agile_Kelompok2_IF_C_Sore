function parseHHMM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || typeof s !== 'string') return null
  const t = s.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m: min }
}

/** Durasi satu slot dalam menit; butuh start & end. */
export function slotDurationMinutes(startTime: string | null | undefined, endTime: string | null | undefined): number {
  const a = parseHHMM(startTime)
  const b = parseHHMM(endTime)
  if (!a || !b) return 0
  const t0 = a.h * 60 + a.m
  const t1 = b.h * 60 + b.m
  const d = t1 - t0
  return d > 0 ? d : 0
}

export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 m'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} m`
  if (m === 0) return `${h} j`
  return `${h} j ${m} m`
}

/** Label singkat di samping jam jadwal, mis. "Durasi 1 j 30 m" */
export function formatSlotDurationLabel(startTime: string | null | undefined, endTime: string | null | undefined): string | null {
  const mins = slotDurationMinutes(startTime, endTime)
  if (mins <= 0) return null
  return `Durasi ${formatDurationMinutes(mins)}`
}

/** Sisa waktu sebelum deadline (tugas belum selesai). */
export function formatRemainingBeforeDeadline(
  deadline: string | Date | null | undefined,
  status: string,
  now: Date = new Date(),
): string | null {
  if (!deadline || status === 'DONE') return null
  const d = deadline instanceof Date ? deadline : new Date(deadline as string)
  if (Number.isNaN(d.getTime())) return null
  const rem = Math.floor((d.getTime() - now.getTime()) / 60000)
  if (rem < 0) return `Lewat ${formatDurationMinutes(Math.abs(rem))}`
  return `Sisa ${formatDurationMinutes(rem)}`
}
