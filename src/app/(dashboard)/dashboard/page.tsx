import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, DollarSign, Users, Award, Upload } from 'lucide-react'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const { data: valuations } = await supabase.from('valuation_projections').select('*').eq('user_id', user!.id).order('year')
  const { data: repurchase } = await supabase.from('repurchase_obligations').select('*').eq('user_id', user!.id).order('year')
  const { data: population } = await supabase.from('population_analyses').select('*').eq('user_id', user!.id).order('year')
  const { data: scores } = await supabase.from('success_scores').select('*').eq('user_id', user!.id).order('year_for_payout')

  const yearSort = (a: { year: string }, b: { year: string }) => {
    const yearA = parseInt(a.year.replace(/\D/g, '')) || 0
    const yearB = parseInt(b.year.replace(/\D/g, '')) || 0
    return yearA - yearB
  }
  if (valuations) valuations.sort(yearSort)
  if (repurchase) repurchase.sort(yearSort)
  if (population) population.sort(yearSort)
  if (scores) scores.sort((a, b) => {
    const yearA = parseInt(a.year_for_payout.replace(/\D/g, '')) || 0
    const yearB = parseInt(b.year_for_payout.replace(/\D/g, '')) || 0
    return yearA - yearB
  })

  const hasData = valuations && valuations.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {profile?.last_updated_at && (
          <p className="text-sm text-green-600 mt-1">
            Last Updated: {new Date(profile.last_updated_at).toLocaleDateString('en-US', {
              month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        )}
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data Uploaded Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Upload your ESOP Excel workbook to see projections, valuations, and analytics.
            </p>
            <a href="/import" className="inline-flex items-center px-4 py-2 bg-[#1B2A4A] text-white rounded-lg hover:bg-[#2C3E6B] transition-colors">
              Import Excel Data
            </a>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Key Metrics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/valuation" className="block hover:ring-2 hover:ring-blue-200 rounded-lg transition-shadow">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <h3 className="text-sm font-medium text-gray-500">ESOP Valuation</h3>
                    <DollarSign className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${valuations?.[0]?.esop_valuation?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '0'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Current year valuation</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/valuation" className="block hover:ring-2 hover:ring-blue-200 rounded-lg transition-shadow">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <h3 className="text-sm font-medium text-gray-500">Share Price</h3>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${valuations?.[0]?.price_per_share?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Per share value</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/population" className="block hover:ring-2 hover:ring-blue-200 rounded-lg transition-shadow">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <h3 className="text-sm font-medium text-gray-500">Active Participants</h3>
                    <Users className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {population?.[0]?.active_participants?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '0'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Current year participants</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/success-score" className="block hover:ring-2 hover:ring-blue-200 rounded-lg transition-shadow">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <h3 className="text-sm font-medium text-gray-500">Success Score</h3>
                    <Award className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {scores && scores.length > 0
                        ? (() => {
                            const latest = scores[scores.length - 1]
                            const val = latest.esop_success_score
                            const pct = val > 1 ? val : val * 100
                            return `${pct.toFixed(1)}%`
                          })()
                        : 'N/A'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {scores && scores.length > 0 ? `Year ${scores[scores.length - 1].year_for_payout}` : 'ESOP sustainability rating'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </section>

          <section aria-label="Data Tables">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Repurchase Obligation Projection</h3>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Repurchase obligation projection by year</caption>
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-gray-500">Year</th>
                          <th className="text-right py-2 font-medium text-gray-500">Total RO</th>
                          <th className="text-right py-2 font-medium text-gray-500">NPV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repurchase?.slice(0, 5).map((row) => (
                          <tr key={row.year} className="border-b last:border-0">
                            <td className="py-2">{row.year}</td>
                            <td className="text-right py-2">${row.total_repurchase_obligation?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">${row.npv?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Valuation &amp; Share Price</h3>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Valuation and share price by year</caption>
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-gray-500">Year</th>
                          <th className="text-right py-2 font-medium text-gray-500">ESOP Value</th>
                          <th className="text-right py-2 font-medium text-gray-500">Price/Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valuations?.slice(0, 5).map((row) => (
                          <tr key={row.year} className="border-b last:border-0">
                            <td className="py-2">{row.year}</td>
                            <td className="text-right py-2">${row.esop_valuation?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">${row.price_per_share?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
