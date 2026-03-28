export const WEEKDAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const

export function mondayFirstIndex(d: Date): number {
  const g = d.getDay()
  return g === 0 ? 6 : g - 1
}
