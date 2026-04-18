import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtDollar, fmtPct } from '@/lib/utils'
import type { AverageAgeTenureActive } from '@/lib/types/database'

const fmtYears = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default async function AverageAgeTenureActivePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) redirect('/login')

  const { data } = await supabase
    .from('average_age_tenure_active')
    .select('*')
    .eq('user_id', user.user.id)

  const rows = (data ?? []) as AverageAgeTenureActive[]
  // Natural year order (Year 0..Year 10)
  rows.sort((a, b) => {
    const na = parseInt((a.year ?? '').replace(/\D/g, '')) || 0
    const nb = parseInt((b.year ?? '').replace(/\D/g, '')) || 0
    return na - nb
  })

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Avg Age &amp; Tenure (Active)</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No data available. Please upload your Excel data.</p>
            <Link href="/import" className="text-blue-600 hover:underline font-medium">Go to Import</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Summary row = weighted average across years (simple mean for age/tenure, totals for comp)
  const totalYears = rows.length
  const avgAgeMean = rows.reduce((s, r) => s + Number(r.average_age), 0) / totalYears
  const avgTenureMean = rows.reduce((s, r) => s + Number(r.average_tenure), 0) / totalYears
  const compMean = rows.reduce((s, r) => s + Number(r.covered_compensation), 0) / totalYears
  const balanceMean = rows.reduce((s, r) => s + Number(r.average_vested_balance), 0) / totalYears

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Avg Age &amp; Tenure (Active)</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Years</p><p className="text-xl font-bold">{totalYears}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Mean Age</p><p className="text-xl font-bold">{fmtYears(avgAgeMean)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Mean Tenure</p><p className="text-xl font-bold">{fmtYears(avgTenureMean)} yrs</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Mean Vested Balance</p><p className="text-xl font-bold">{fmtDollar(balanceMean)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By Projection Year</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Plan Year</th>
                  <th className="py-2 pr-4 text-right">Avg Age</th>
                  <th className="py-2 pr-4 text-right">Avg Tenure</th>
                  <th className="py-2 pr-4 text-right">Covered Comp</th>
                  <th className="py-2 pr-4 text-right">Comp % Change</th>
                  <th className="py-2 pr-4 text-right">Avg Vested Balance</th>
                  <th className="py-2 text-right">Balance % Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year}</td>
                    <td className="py-2 pr-4 text-right">{fmtYears(Number(r.average_age))}</td>
                    <td className="py-2 pr-4 text-right">{fmtYears(Number(r.average_tenure))}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(Number(r.covered_compensation))}</td>
                    <td className="py-2 pr-4 text-right">{fmtPct(Number(r.compensation_pct_change), 1)}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(Number(r.average_vested_balance))}</td>
                    <td className="py-2 text-right">{fmtPct(Number(r.balance_pct_change), 1)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold bg-gray-50">
                  <td className="py-2 pr-4">Mean</td>
                  <td className="py-2 pr-4 text-right">{fmtYears(avgAgeMean)}</td>
                  <td className="py-2 pr-4 text-right">{fmtYears(avgTenureMean)}</td>
                  <td className="py-2 pr-4 text-right">{fmtDollar(compMean)}</td>
                  <td className="py-2 pr-4 text-right">—</td>
                  <td className="py-2 pr-4 text-right">{fmtDollar(balanceMean)}</td>
                  <td className="py-2 text-right">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
