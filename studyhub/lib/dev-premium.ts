/**
 * Developer/role-based premium override.
 * Set env var: DEV_PREMIUM_EMAILS=email1@domain.com,email2@domain.com
 * Emails in this list always get isPremium = true regardless of DB value.
 */
const DEV_EMAILS = (process.env.DEV_PREMIUM_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isDevPremium(email?: string | null): boolean {
  if (!email) return false
  return DEV_EMAILS.includes(email.toLowerCase())
}
