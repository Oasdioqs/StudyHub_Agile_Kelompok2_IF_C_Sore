import Constants from 'expo-constants'

/**
 * URL StudyHub production (Vercel). Ganti di sini jika domain deploy berbeda.
 * Override: EXPO_PUBLIC_API_URL atau app.json extra.apiUrl
 */
export const DEFAULT_STUDYHUB_API_URL = 'https://studyhub-olive.vercel.app'

/** Base URL API — selalu HTTPS production secara default (app online, tanpa PC). */
export function getApiBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  const extra = Constants.expoConfig?.extra?.apiUrl as string | undefined
  if (extra?.trim()) return extra.trim().replace(/\/$/, '')
  return DEFAULT_STUDYHUB_API_URL
}
