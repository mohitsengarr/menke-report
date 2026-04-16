'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type LineChartProps = {
  data: Record<string, unknown>[]
  xKey: string
  lines: { key: string; color: string; name: string }[]
  height?: number
  formatY?: (value: number) => string
}

export function AppLineChart({ data, xKey, lines, height = 300, formatY }: LineChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={formatY} />
        <Tooltip formatter={(value) => formatY ? formatY(Number(value)) : Number(value).toLocaleString()} />
        <Legend />
        {lines.map((line) => (
          <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} name={line.name} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
