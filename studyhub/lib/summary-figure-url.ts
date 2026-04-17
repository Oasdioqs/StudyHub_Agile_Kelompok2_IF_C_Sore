/** URL gambar ringkasan yang boleh di-render (hindari XSS dari markdown arbitrer). */
export function isTrustedSummaryImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return /\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)
  } catch {
    return false
  }
}
