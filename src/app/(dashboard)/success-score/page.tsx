import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLineChart } from '@/components/charts/line-chart'
import type { SuccessScore } from '@/lib/types/database'

const fmtDollar = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`

function getHealthLabel(score: number) {
  if (score >= 80) return { label: 'Strong', color: 'bg-green-100 text-green-800 border-green-300' }
  if (score >= 50) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
  return { label: 'Impaired', color: 'bg-red-100 text-red-800 border-red-300' }
}

export default async function SuccessScorePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const { data: scores } = await supabase
    .from('success_scores')
    .select('*')
    .eq('user_id', user.user.id)
    .order('year_for_payout')

  const rows = (scores ?? []) as SuccessScore[]

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">ESOP Success Score</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No data available. Please upload your Excel data.</p>
            <Link href="/import" className="text-blue-600 hover:underline font-medium">Go to Import</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const latest = rows[rows.length - 1]
  const health = getHealthLabel(latest.esop_success_score)

  const chartData = rows.map((r) => ({
    year: r.year_for_payout,
    score: r.esop_success_score,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ESOP Success Score</h1>

      <Card>
        <CardHeader><CardTitle>Health Indicator</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg border font-semibold text-lg ${health.color}`}>
              {health.label}
            </div>
            <div className="text-gray-600">
              Latest Score: <span className="font-bold text-gray-900">{latest.esop_success_score.toFixed(1)}</span>
              <span className="text-sm ml-2">({latest.year_for_payout})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Success Score Data</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4 text-right">RO</th>
                  <th className="py-2 pr-4 text-right">Cash Source</th>
                  <th className="py-2 pr-4 text-right">Surplus/Deficit</th>
                  <th className="py-2 pr-4 text-right">Cash Burn</th>
                  <th className="py-2 pr-4 text-right">Score</th>
                  <th className="py-2 text-right">Health Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year_for_payout}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.repurchase_obligation)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.cash_source)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.surplus_or_deficit)}</td>
                    <td className="py-2 pr-4 text-right">{(r.ro_cash_burn * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-right font-semibold">{r.esop_success_score.toFixed(1)}</td>
                    <td className="py-2 text-right">{r.health_check}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Score Over Time</CardTitle></CardHeader>
        <CardContent>
          <AppLineChart
            data={chartData}
            xKey="year"
            lines={[{ key: 'score', color: '#27AE60', name: 'ESOP Success Score' }]}
            height={350}
          />
        </CardContent>
      </Card>
    </div>
  )
}
