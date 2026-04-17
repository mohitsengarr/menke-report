'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type LineChartProps = {
  data: Record<string, unknown>[]
  xKey: string
  lines: { key: string; color: string; name: string }[]
  height?: number
  /** Format type for Y axis: "dollar", "dollarM", "percent", "number" (default) */
  formatType?: 'dollar' | 'dollarM' | 'percent' | 'number'
}

function formatValue(value: number, type: string): string {
  switch (type) {
    case 'dollar': return `$${value.toLocaleString()}`
    case 'dollarM': return `$${(value / 1_000_000).toFixed(1)}M`
    case 'percent': return `${(value * 100).toFixed(1)}%`
    default: return value.toLocaleString()
  }
}

export function AppLineChart({ data, xKey, lines, height = 300, formatType = 'number' }: LineChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data available</div>
  }

  const tickFmt = (v: number) => formatValue(v, formatType)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={tickFmt} />
        <Tooltip formatter={(value) => formatValue(Number(value), formatType)} />
        <Legend />
        {lines.map((line) => (
          <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} name={line.name} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
