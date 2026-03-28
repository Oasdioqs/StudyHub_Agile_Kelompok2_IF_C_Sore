/**
 * Selaras dengan studyhub/styles/globals.css (:root light) & halaman login web.
 */
export const colors = {
  bg: '#f8fafc',
  bgMuted: '#f1f5f9',
  card: '#ffffff',
  cardGlass: 'rgba(255, 255, 255, 0.92)',
  border: '#e2e8f0',
  text: '#1e293b',
  textMuted: '#64748b',
  /** --sh-primary */
  primary: '#4f46e5',
  /** tombol / aksen seperti login web btn-modern */
  primaryBright: '#6366f1',
  primaryDark: '#3730a3',
  primaryGradientEnd: '#8b5cf6',
  secondary: '#0ea5e9',
  accent: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  overlay: 'rgba(15, 23, 42, 0.45)',
  /** Alert error (light) */
  errorBg: '#fef2f2',
  errorText: '#b91c1c',
  errorBorder: '#fecaca',
  chipPrimaryBg: 'rgba(79, 70, 229, 0.1)',
  chipPrimaryText: '#4338ca',
} as const

export const radii = { sm: 10, md: 12, lg: 22, xl: 28 } as const

export const space = { xs: 6, sm: 10, md: 16, lg: 22, xl: 28 } as const

export const shadows = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  topbar: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
} as const

/** Gradien background login web: -45deg #eef2ff → #fdf2f8 → #e0e7ff → #fce7f3 */
export const loginGradientColors = ['#eef2ff', '#fdf2f8', '#e0e7ff', '#fce7f3'] as const
