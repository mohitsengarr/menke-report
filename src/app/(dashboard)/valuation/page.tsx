import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLineChart } from '@/components/charts/line-chart'
import { CHART_COLORS } from '@/lib/chart-colors'
import { fmtPct, fmtDollarCompact } from '@/lib/utils'
import type { ValuationProjection } from '@/lib/types/database'

const fmt = (v: number) => fmtDollarCompact(v)
function fmtShare(v: number) { return `$${v.toFixed(2)}` }

export const metadata = { title: 'Capital Table & Valuation' }

export default async function ValuationPage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) redirect('/login')

  const { data: projections } = await supabase
    .from('valuation_projections')
    .select('*')
    .eq('user_id', user.user.id)
    .order('year')

  const rows = (projections ?? []) as ValuationProjection[]
  rows.sort((a, b) => {
    const yearA = parseInt(a.year.replace(/\D/g, '')) || 0
    const yearB = parseInt(b.year.replace(/\D/g, '')) || 0
    return yearA - yearB
  })

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Capital Table &amp; Valuation</h1>
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
    esop_valuation: r.esop_valuation,
    price_per_share: r.price_per_share,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Capital Table &amp; Valuation</h1>

      <Card>
        <CardHeader><CardTitle>Valuation Projections</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4 text-right">ESOP Valuation</th>
                  <th className="py-2 pr-4 text-right">ESOP Shares</th>
                  <th className="py-2 pr-4 text-right">% ESOP</th>
                  <th className="py-2 pr-4 text-right">Other Shares</th>
                  <th className="py-2 pr-4 text-right">% Other</th>
                  <th className="py-2 pr-4 text-right">Total Shares</th>
                  <th className="py-2 pr-4 text-right">Price/Share</th>
                  <th className="py-2 text-right">Price Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.esop_valuation ?? 0)}</td>
                    <td className="py-2 pr-4 text-right">{(r.esop_shares ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{fmtPct(r.pct_esop_shares, 1)}</td>
                    <td className="py-2 pr-4 text-right">{(r.other_shares ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{fmtPct(r.pct_other_shares, 1)}</td>
                    <td className="py-2 pr-4 text-right">{(r.total_shares ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{fmtShare(r.price_per_share ?? 0)}</td>
                    <td className="py-2 text-right">{fmtPct(r.share_price_change, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ESOP Valuation Trend</CardTitle></CardHeader>
        <CardContent>
          <AppLineChart
            data={chartData}
            xKey="year"
            lines={[{ key: 'esop_valuation', color: CHART_COLORS.navy, name: 'ESOP Valuation' }]}
            formatType="dollarM"
            height={280}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Share Price Trend</CardTitle></CardHeader>
        <CardContent>
          <AppLineChart
            data={chartData}
            xKey="year"
            lines={[{ key: 'price_per_share', color: CHART_COLORS.blue, name: 'Price Per Share' }]}
            formatType="dollar"
            height={280}
          />
        </CardContent>
      </Card>
    </div>
  )
}
