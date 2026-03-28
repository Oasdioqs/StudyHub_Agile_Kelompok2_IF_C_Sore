const JAKARTA_TZ = 'Asia/Jakarta'

type JakartaParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getJakartaParts(base = new Date()): JakartaParts {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(base)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0')
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  }
}

export function createJakartaDate(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
) {
  return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute, second, ms))
}

export function getJakartaNowDate(base = new Date()) {
  const p = getJakartaParts(base)
  return createJakartaDate(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, base.getMilliseconds())
}

export function getJakartaDayRange(base = new Date()) {
  const p = getJakartaParts(base)
  return {
    start: createJakartaDate(p.year, p.month - 1, p.day, 0, 0, 0, 0),
    end: createJakartaDate(p.year, p.month - 1, p.day, 23, 59, 59, 999),
    now: createJakartaDate(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, base.getMilliseconds()),
  }
}

export function formatJakartaDate(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return date.toLocaleDateString(locale, { ...options, timeZone: JAKARTA_TZ })
}

export function getJakartaMondayFirstIndex(base = new Date()): number {
  const p = getJakartaParts(base)
  const utcNoon = Date.UTC(p.year, p.month - 1, p.day, 12 - 7, 0, 0, 0)
  const g = new Date(utcNoon).getUTCDay()
  return g === 0 ? 6 : g - 1
}

export function formatJakartaYmd(base = new Date()): string {
  const p = getJakartaParts(base)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

