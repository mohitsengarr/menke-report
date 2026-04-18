import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a numeric percentage value for display.
 *
 * The database stores percentages as ratios (0.05 = 5%). Some legacy rows
 * may already be scaled (5 meaning 5%). This helper handles both by treating
 * any value with |v| <= 1 as a ratio and values > 1 as already-scaled.
 *
 * @example
 *   fmtPct(0.05)     // "5.00%"
 *   fmtPct(0.123)    // "12.30%"
 *   fmtPct(5)        // "5.00%"   (already scaled)
 *   fmtPct(null)     // "—"
 *   fmtPct(0.05, 1)  // "5.0%"
 */
export function fmtPct(v: number | null | undefined, decimals: number = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const scaled = Math.abs(v) <= 1 ? v * 100 : v
  return scaled.toFixed(decimals) + '%'
}

/**
 * Formats a currency (USD) value with locale separators.
 *
 * @example
 *   fmtDollar(1234567)    // "$1,234,567"
 *   fmtDollar(1234.5, 2)  // "$1,234.50"
 */
export function fmtDollar(v: number | null | undefined, decimals: number = 0): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return '$' + v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Compact dollar format with M/K suffixes.
 *
 * @example
 *   fmtDollarCompact(1500000)  // "$1.5M"
 *   fmtDollarCompact(4500)     // "$4.5K"
 *   fmtDollarCompact(800)      // "$800"
 */
export function fmtDollarCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K'
  return '$' + Math.round(v).toLocaleString('en-US')
}

/**
 * Formats a number with locale separators and optional decimals.
 *
 * @example
 *   fmtNumber(12345.6, 0)  // "12,346"
 *   fmtNumber(0.5, 1)      // "0.5"
 */
export function fmtNumber(v: number | null | undefined, decimals: number = 0): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
