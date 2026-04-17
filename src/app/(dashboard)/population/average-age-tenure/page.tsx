import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AverageAgeTenureActive } from '@/lib/types/database'

const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtDollar = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default async function AverageAgeTenureActivePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const { data } = await supabase
    .from('average_age_tenure_active')
    .select('*')
    .eq('user_id', user.user.id)

  const rows = (data ?? []) as AverageAgeTenureActive[]
  // Natural order: All first, then by service-year bucket
  const ORDER = ['All', '0-5 years', '5-10 years', '10-15 years', '15-20 years', '20+ years']
  rows.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))

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

  // Prefer the "All" aggregate if present (engine emits it); otherwise compute weighted totals
  // excluding the "All" bucket to avoid double-counting.
  const allRow = rows.find(r => r.category === 'All')
  const bucketed = rows.filter(r => r.category !== 'All')
  const totalCount = bucketed.reduce((s, r) => s + r.count, 0)
  const totals = allRow
    ? { count: allRow.count, avgAge: allRow.avg_age, avgTenure: allRow.avg_tenure, avgBalance: allRow.avg_balance }
    : {
        count: totalCount,
        avgAge: totalCount > 0 ? bucketed.reduce((s, r) => s + r.avg_age * r.count, 0) / totalCount : 0,
        avgTenure: totalCount > 0 ? bucketed.reduce((s, r) => s + r.avg_tenure * r.count, 0) / totalCount : 0,
        avgBalance: totalCount > 0 ? bucketed.reduce((s, r) => s + r.avg_balance * r.count, 0) / totalCount : 0,
      }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Avg Age &amp; Tenure (Active)</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Count</p><p className="text-xl font-bold">{totals.count.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Age</p><p className="text-xl font-bold">{fmt(totals.avgAge)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Tenure</p><p className="text-xl font-bold">{fmt(totals.avgTenure)} yrs</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Balance</p><p className="text-xl font-bold">{fmtDollar(totals.avgBalance)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Active Participants by Category</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4 text-right">Count</th>
                  <th className="py-2 pr-4 text-right">Avg Age</th>
                  <th className="py-2 pr-4 text-right">Avg Tenure</th>
                  <th className="py-2 text-right">Avg Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.category}</td>
                    <td className="py-2 pr-4 text-right">{r.count.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.avg_age)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.avg_tenure)}</td>
                    <td className="py-2 text-right">{fmtDollar(r.avg_balance)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold bg-gray-50">
                  <td className="py-2 pr-4">Total / Weighted Avg</td>
                  <td className="py-2 pr-4 text-right">{totals.count.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{fmt(totals.avgAge)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(totals.avgTenure)}</td>
                  <td className="py-2 text-right">{fmtDollar(totals.avgBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
