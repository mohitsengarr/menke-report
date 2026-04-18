import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppBarChart } from '@/components/charts/bar-chart'
import type { ShareTurnoverSchedule } from '@/lib/types/database'

const fmtShares = (v: number) => v.toLocaleString()

export default async function ShareTurnoverPage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) redirect('/login')

  const { data } = await supabase
    .from('share_turnover_schedules')
    .select('*')
    .eq('user_id', user.user.id)
    .order('year')

  const rows = (data ?? []) as ShareTurnoverSchedule[]
  rows.sort((a, b) => {
    const yearA = parseInt(a.year.replace(/\D/g, '')) || 0
    const yearB = parseInt(b.year.replace(/\D/g, '')) || 0
    return yearA - yearB
  })

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Share Turnover Schedule</h1>
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
    diversification: r.diversification,
    retirement_death_disability: r.retirement_death_disability,
    turnover: r.turnover,
    in_service: r.in_service_distributions,
  }))

  const totalShares = rows.reduce((s, r) => s + r.total_shares, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Share Turnover Schedule</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Years</p><p className="text-xl font-bold">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Shares Turned</p><p className="text-xl font-bold">{totalShares.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">First Year</p><p className="text-xl font-bold">{rows[0]?.year}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Last Year</p><p className="text-xl font-bold">{rows[rows.length - 1]?.year}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Share Outflows by Driver</CardTitle></CardHeader>
        <CardContent>
          <AppBarChart
            data={chartData}
            xKey="year"
            bars={[
              { key: 'diversification', color: '#3B82F6', name: 'Diversification' },
              { key: 'retirement_death_disability', color: '#EF4444', name: 'Retirement/Death/Disability' },
              { key: 'turnover', color: '#F59E0B', name: 'Turnover' },
              { key: 'in_service', color: '#10B981', name: 'In-Service' },
            ]}
            height={400}
            stacked
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Full Turnover Data</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/*
                SEN-226: reorder columns to match legacy `ShareTurnoverSchedule.cshtml` —
                Diversification → In-Service Distributions → Retirement/Death/Disability → Turnover.
              */}
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Plan Year</th>
                  <th className="py-2 pr-4">Calendar Year for Payout</th>
                  <th className="py-2 pr-4 text-right">Diversification</th>
                  <th className="py-2 pr-4 text-right">In-Service Distributions</th>
                  <th className="py-2 pr-4 text-right">Retirement/Death/Disability</th>
                  <th className="py-2 pr-4 text-right">Turnover</th>
                  <th className="py-2 text-right">Total Shares</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year}</td>
                    <td className="py-2 pr-4">{r.calendar_year_for_payout}</td>
                    <td className="py-2 pr-4 text-right">{fmtShares(r.diversification)}</td>
                    <td className="py-2 pr-4 text-right">{fmtShares(r.in_service_distributions)}</td>
                    <td className="py-2 pr-4 text-right">{fmtShares(r.retirement_death_disability)}</td>
                    <td className="py-2 pr-4 text-right">{fmtShares(r.turnover)}</td>
                    <td className="py-2 text-right font-semibold">{fmtShares(r.total_shares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
