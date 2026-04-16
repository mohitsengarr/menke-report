'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type BarChartProps = {
  data: Record<string, unknown>[]
  xKey: string
  bars: { key: string; color: string; name: string }[]
  height?: number
  stacked?: boolean
}

export function AppBarChart({ data, xKey, bars, height = 300, stacked = false }: BarChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {bars.map((bar) => (
          <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.name} stackId={stacked ? 'stack' : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
