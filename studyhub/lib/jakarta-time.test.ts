import { describe, expect, it } from 'vitest'
import { createJakartaDate, getJakartaDayRange } from './jakarta-time'

describe('jakarta-time', () => {
  it('createJakartaDate maps WIB midnight to correct UTC instant', () => {
    const d = createJakartaDate(2025, 5, 15, 0, 0, 0, 0)
    expect(d.toISOString()).toBe('2025-06-14T17:00:00.000Z')
  })

  it('getJakartaDayRange keeps start before end and now within the same wall day', () => {
    const anchor = new Date('2025-06-15T12:00:00.000Z')
    const { start, end, now } = getJakartaDayRange(anchor)
    expect(start.getTime()).toBeLessThan(end.getTime())
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(now.getTime()).toBeLessThanOrEqual(end.getTime())
  })
})
