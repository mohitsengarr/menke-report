import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppBarChart } from '@/components/charts/bar-chart'
import { CHART_COLORS } from '@/lib/chart-colors'
import type { PopulationAnalysis } from '@/lib/types/database'

const fmtDollar = (v: number) => `$${v.toLocaleString()}`

export const metadata = { title: 'Population Analysis' }

export default async function PopulationPage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const { data: analyses } = await supabase
    .from('population_analyses')
    .select('*')
    .eq('user_id', user.user.id)
    .order('year')

  const rows = (analyses ?? []) as PopulationAnalysis[]
  rows.sort((a, b) => {
    const yearA = parseInt(a.year.replace(/\D/g, '')) || 0
    const yearB = parseInt(b.year.replace(/\D/g, '')) || 0
    return yearA - yearB
  })

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Population Analysis</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No data available. Please upload your Excel data.</p>
            <Link href="/import" className="text-blue-600 hover:underline font-medium">Go to Import</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = rows.map((r) => ({
    year: r.year,
    active_participants: r.active_participants,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Population Analysis</h1>

      <Card>
        <CardHeader><CardTitle>Population Data</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4 text-right">Active Participants</th>
                  <th className="py-2 pr-4 text-right">Covered Comp</th>
                  <th className="py-2 pr-4 text-right">Avg Cash Comp</th>
                  <th className="py-2 pr-4 text-right">Avg ESOP Comp</th>
                  <th className="py-2 pr-4 text-right">Avg Total Comp</th>
                  <th className="py-2 pr-4 text-right">Stock Alloc</th>
                  <th className="py-2 pr-4 text-right">Cash Contrib</th>
                  <th className="py-2 pr-4 text-right">Fringe</th>
                  <th className="py-2 pr-4 text-right">Effective Benefit Rate</th>
                  <th className="py-2 text-right">Share Turn</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year}</td>
                    <td className="py-2 pr-4 text-right">{r.active_participants.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.covered_compensation)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.avg_cash_compensation)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.avg_esop_compensation)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.avg_total_compensation)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.stock_allocations)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.cash_contributions)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.fringe)}</td>
                    <td className="py-2 pr-4 text-right">{(r.effective_benefit_rate * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right">{r.share_turn.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active Participants Over Time</CardTitle></CardHeader>
        <CardContent>
          <AppBarChart
            data={chartData}
            xKey="year"
            bars={[{ key: 'active_participants', color: CHART_COLORS.navy, name: 'Active Participants' }]}
            height={350}
          />
        </CardContent>
      </Card>
    </div>
  )
}
