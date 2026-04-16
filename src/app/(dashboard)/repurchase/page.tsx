import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLineChart } from '@/components/charts/line-chart'
import { AppPieChart } from '@/components/charts/pie-chart'
import type { RepurchaseObligation, ShareTurnoverSchedule } from '@/lib/types/database'

const fmtDollar = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`

export default async function RepurchasePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const [{ data: obligations }, { data: turnover }] = await Promise.all([
    supabase.from('repurchase_obligations').select('*').eq('user_id', user.user.id).order('year'),
    supabase.from('share_turnover_schedules').select('*').eq('user_id', user.user.id).order('year'),
  ])

  const roRows = (obligations ?? []) as RepurchaseObligation[]
  const stRows = (turnover ?? []) as ShareTurnoverSchedule[]

  if (roRows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Repurchase Obligation</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No data available. Please upload your Excel data.</p>
            <Link href="/import" className="text-blue-600 hover:underline font-medium">Go to Import</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const lineData = roRows.map((r) => ({
    year: r.year,
    total_ro: r.total_repurchase_obligation,
  }))

  // Average breakdown from turnover schedules for pie chart
  const avgBreakdown = stRows.length > 0
    ? [
        { name: 'Diversification', value: Math.round(stRows.reduce((s, r) => s + r.diversification, 0) / stRows.length) },
        { name: 'Retirement/Death/Disability', value: Math.round(stRows.reduce((s, r) => s + r.retirement_death_disability, 0) / stRows.length) },
        { name: 'Turnover', value: Math.round(stRows.reduce((s, r) => s + r.turnover, 0) / stRows.length) },
        { name: 'In-Service', value: Math.round(stRows.reduce((s, r) => s + r.in_service_distributions, 0) / stRows.length) },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Repurchase Obligation</h1>

      <Card>
        <CardHeader><CardTitle>Repurchase Obligation Data</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4 text-right">Total RO</th>
                  <th className="py-2 pr-4 text-right">NPV</th>
                  <th className="py-2 text-right">Share Price</th>
                </tr>
              </thead>
              <tbody>
                {roRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.total_repurchase_obligation)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(r.npv)}</td>
                    <td className="py-2 text-right">${r.share_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Total RO Over Time</CardTitle></CardHeader>
          <CardContent>
            <AppLineChart
              data={lineData}
              xKey="year"
              lines={[{ key: 'total_ro', color: '#C0392B', name: 'Total RO' }]}
              formatY={fmtDollar}
              height={300}
            />
          </CardContent>
        </Card>

        {avgBreakdown.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Average Share Turnover Breakdown</CardTitle></CardHeader>
            <CardContent>
              <AppPieChart data={avgBreakdown} height={300} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
