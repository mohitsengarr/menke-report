/**
 * Shared chart color palette for Recharts.
 * These match the CSS custom properties in globals.css.
 * Recharts requires hex strings, not CSS variables.
 */
export const CHART_COLORS = {
  navy: '#1B2A4A',
  blue: '#3B7DD8',
  green: '#059669',
  orange: '#D97706',
  red: '#DC2626',
  purple: '#7C3AED',
  teal: '#0D9488',
  gold: '#D4A843',
} as const

export const CHART_PALETTE = [
  CHART_COLORS.navy,
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.red,
  CHART_COLORS.purple,
  CHART_COLORS.teal,
  CHART_COLORS.gold,
]
