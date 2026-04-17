import { describe, expect, it } from 'vitest'
import {
  slotDurationMinutes,
  formatDurationMinutes,
  formatSlotDurationLabel,
  formatRemainingBeforeDeadline,
} from './activity-metrics'

describe('slotDurationMinutes', () => {
  it('returns correct duration for same-hour slots', () => {
    expect(slotDurationMinutes('09:00', '09:30')).toBe(30)
  })

  it('returns correct duration crossing hours', () => {
    expect(slotDurationMinutes('08:00', '10:30')).toBe(150)
  })

  it('returns 0 when end is before start', () => {
    expect(slotDurationMinutes('10:00', '09:00')).toBe(0)
  })

  it('returns 0 when end equals start', () => {
    expect(slotDurationMinutes('10:00', '10:00')).toBe(0)
  })

  it('returns 0 for null input', () => {
    expect(slotDurationMinutes(null, '10:00')).toBe(0)
    expect(slotDurationMinutes('10:00', null)).toBe(0)
    expect(slotDurationMinutes(null, null)).toBe(0)
  })

  it('returns 0 for invalid format', () => {
    expect(slotDurationMinutes('invalid', '10:00')).toBe(0)
    expect(slotDurationMinutes('25:00', '10:00')).toBe(0)
    expect(slotDurationMinutes('10:60', '11:00')).toBe(0)
  })
})

describe('formatDurationMinutes', () => {
  it('formats minutes only', () => {
    expect(formatDurationMinutes(30)).toBe('30 m')
  })

  it('formats hours only', () => {
    expect(formatDurationMinutes(120)).toBe('2 j')
  })

  it('formats hours and minutes', () => {
    expect(formatDurationMinutes(90)).toBe('1 j 30 m')
  })

  it('returns 0 m for zero', () => {
    expect(formatDurationMinutes(0)).toBe('0 m')
  })

  it('returns 0 m for negative', () => {
    expect(formatDurationMinutes(-10)).toBe('0 m')
  })
})

describe('formatSlotDurationLabel', () => {
  it('returns duration label string', () => {
    expect(formatSlotDurationLabel('09:00', '10:00')).toBe('Durasi 1 j')
  })

  it('returns null when duration is zero', () => {
    expect(formatSlotDurationLabel('10:00', '10:00')).toBeNull()
  })

  it('returns null for null inputs', () => {
    expect(formatSlotDurationLabel(null, null)).toBeNull()
  })
})

describe('formatRemainingBeforeDeadline', () => {
  const now = new Date('2025-06-15T08:00:00.000Z')

  it('returns null when deadline is null', () => {
    expect(formatRemainingBeforeDeadline(null, 'TODO', now)).toBeNull()
  })

  it('returns null when status is DONE', () => {
    expect(formatRemainingBeforeDeadline('2025-06-16T08:00:00.000Z', 'DONE', now)).toBeNull()
  })

  it('returns sisa time when deadline is in the future', () => {
    const deadline = new Date(now.getTime() + 90 * 60000)
    const result = formatRemainingBeforeDeadline(deadline, 'TODO', now)
    expect(result).toBe('Sisa 1 j 30 m')
  })

  it('returns lewat time when deadline has passed', () => {
    const deadline = new Date(now.getTime() - 60 * 60000)
    const result = formatRemainingBeforeDeadline(deadline, 'TODO', now)
    expect(result).toBe('Lewat 1 j')
  })

  it('accepts string deadline', () => {
    const deadline = new Date(now.getTime() + 30 * 60000).toISOString()
    expect(formatRemainingBeforeDeadline(deadline, 'TODO', now)).toBe('Sisa 30 m')
  })

  it('returns null for invalid date string', () => {
    expect(formatRemainingBeforeDeadline('bukan-tanggal', 'TODO', now)).toBeNull()
  })
})
