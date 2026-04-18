import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLineChart } from '@/components/charts/line-chart'
import { CHART_COLORS } from '@/lib/chart-colors'
import { fmtPct, fmtDollar } from '@/lib/utils'
import type { SuccessScore } from '@/lib/types/database'

function getHealthLabel(score: number) {
  // Score is 0.0-1.0 scale
  if (score >= 0.8) return { label: 'Strong', color: 'bg-green-100 text-green-800 border-green-300' }
  if (score >= 0.5) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
  return { label: 'At Risk', color: 'bg-red-100 text-red-800 border-red-300' }
}

function getCashBurnColor(burn: number) {
  // burn is a ratio: <0.5 green, 0.5-1.0 yellow, >1.0 red
  if (burn < 0.5) return 'text-green-700'
  if (burn <= 1.0) return 'text-yellow-700'
  return 'text-red-700'
}

export const metadata = { title: 'ESOP Success Score' }

export default async function SuccessScorePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) redirect('/login')

  const { data: scores } = await supabase
    .from('success_scores')
    .select('*')
    .eq('user_id', user.user.id)
    .order('year_for_payout')

  const rows = (scores ?? []) as SuccessScore[]
  rows.sort((a, b) => {
    const yearA = parseInt(a.year_for_payout.replace(/\D/g, '')) || 0
    const yearB = parseInt(b.year_for_payout.replace(/\D/g, '')) || 0
    return yearA - yearB
  })

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

  const current = rows[0]
  const projected = rows[rows.length - 1]
  const currentHealth = getHealthLabel(current.esop_success_score)
  const projectedHealth = getHealthLabel(projected.esop_success_score)

  const chartData = rows.map((r) => ({
    year: r.year_for_payout,
    score: r.esop_success_score,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ESOP Success Score</h1>
        <p className="mt-1 text-sm text-gray-500">
          How sustainable is this ESOP plan? The Success Score measures cash sources against repurchase obligations over 10 years.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Health Indicator</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500 w-36">Current ({current.year_for_payout}):</span>
              <span className="font-bold text-gray-900">{current.esop_success_score.toFixed(2)} / 1.0</span>
              <span className="text-gray-400">--</span>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${currentHealth.color}`}>
                {currentHealth.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500 w-36">10-Year Projection ({projected.year_for_payout}):</span>
              <span className="font-bold text-gray-900">{projected.esop_success_score.toFixed(2)} / 1.0</span>
              <span className="text-gray-400">--</span>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${projectedHealth.color}`}>
                {projectedHealth.label}
              </span>
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
                    <td className={`py-2 pr-4 text-right font-medium ${getCashBurnColor(r.ro_cash_burn)}`}>{fmtPct(r.ro_cash_burn, 1)}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{fmtPct(r.esop_success_score, 1)}</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${getHealthLabel(r.health_check).color}`}>
                        {getHealthLabel(r.health_check).label}
                      </span>
                    </td>
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
            lines={[{ key: 'score', color: CHART_COLORS.green, name: 'ESOP Success Score' }]}
            height={350}
            formatType="percent"
          />
        </CardContent>
      </Card>
    </div>
  )
}
