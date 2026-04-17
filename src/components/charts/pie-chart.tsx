'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CHART_PALETTE } from '@/lib/chart-colors'

type PieChartProps = {
  data: { name: string; value: number }[]
  height?: number
}

export function AppPieChart({ data, height = 300 }: PieChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value"
          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => Number(value).toLocaleString()} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
