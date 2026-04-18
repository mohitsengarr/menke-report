import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtDollar } from '@/lib/utils'
import type { AverageAgeTenureTerminated } from '@/lib/types/database'

const fmtYears = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default async function AverageAgeTenureTerminatedPage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const { data } = await supabase
    .from('average_age_tenure_terminated')
    .select('*')
    .eq('user_id', user.user.id)

  const rows = (data ?? []) as AverageAgeTenureTerminated[]
  rows.sort((a, b) => {
    const na = parseInt((a.year ?? '').replace(/\D/g, '')) || 0
    const nb = parseInt((b.year ?? '').replace(/\D/g, '')) || 0
    return na - nb
  })

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Avg Age &amp; Tenure (Terminated)</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No data available. Please upload your Excel data.</p>
            <Link href="/import" className="text-blue-600 hover:underline font-medium">Go to Import</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalYears = rows.length
  const termAgeMean = rows.reduce((s, r) => s + Number(r.avg_age_terminated), 0) / totalYears
  const termTenureMean = rows.reduce((s, r) => s + Number(r.avg_tenure_terminated), 0) / totalYears
  const termBalMean = rows.reduce((s, r) => s + Number(r.avg_balance_terminated), 0) / totalYears

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Avg Age &amp; Tenure (Terminated)</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Years</p><p className="text-xl font-bold">{totalYears}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Age (Term)</p><p className="text-xl font-bold">{fmtYears(termAgeMean)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Tenure (Term)</p><p className="text-xl font-bold">{fmtYears(termTenureMean)} yrs</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Balance (Term)</p><p className="text-xl font-bold">{fmtDollar(termBalMean)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Terminated Population by Projection Year</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Plan Year</th>
                  <th className="py-2 pr-4 text-right">Avg Age Top 10%</th>
                  <th className="py-2 pr-4 text-right">Avg Balance Top 10%</th>
                  <th className="py-2 pr-4 text-right">Avg Age Bottom 10%</th>
                  <th className="py-2 pr-4 text-right">Avg Balance Bottom 10%</th>
                  <th className="py-2 pr-4 text-right">Avg Age Term</th>
                  <th className="py-2 pr-4 text-right">Avg Tenure Term</th>
                  <th className="py-2 text-right">Avg Balance Term</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.year}</td>
                    <td className="py-2 pr-4 text-right">{fmtYears(Number(r.avg_age_top_10pct))}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(Number(r.avg_balance_top_10pct))}</td>
                    <td className="py-2 pr-4 text-right">{fmtYears(Number(r.avg_age_bottom_10pct))}</td>
                    <td className="py-2 pr-4 text-right">{fmtDollar(Number(r.avg_balance_bottom_10pct))}</td>
                    <td className="py-2 pr-4 text-right">{fmtYears(Number(r.avg_age_terminated))}</td>
                    <td className="py-2 pr-4 text-right">{fmtYears(Number(r.avg_tenure_terminated))}</td>
                    <td className="py-2 text-right">{fmtDollar(Number(r.avg_balance_terminated))}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold bg-gray-50">
                  <td className="py-2 pr-4">Mean</td>
                  <td className="py-2 pr-4 text-right" colSpan={4}></td>
                  <td className="py-2 pr-4 text-right">{fmtYears(termAgeMean)}</td>
                  <td className="py-2 pr-4 text-right">{fmtYears(termTenureMean)}</td>
                  <td className="py-2 text-right">{fmtDollar(termBalMean)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
