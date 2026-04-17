import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Users, Award, Upload, FileText, BarChart3, UsersRound, AlertTriangle } from 'lucide-react'

export const metadata = { title: 'ESOP Dashboard' }

function fmt(v: number | null | undefined): string {
  if (v == null) return '$0'
  if (Math.abs(v) >= 1e6) return '$' + (Math.round(v / 1e6 * 10) / 10) + 'M'
  if (Math.abs(v) >= 1e3) return '$' + (Math.round(v / 1e3 * 10) / 10) + 'K'
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function pctChange(a: number | null | undefined, b: number | null | undefined): { text: string; up: boolean } | null {
  if (a == null || b == null || a === 0) return null
  const pct = ((b - a) / Math.abs(a)) * 100
  return { text: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', up: pct >= 0 }
}

function healthLabel(score: number): { label: string; color: string } {
  if (score >= 0.7) return { label: 'Healthy', color: 'bg-green-100 text-green-800' }
  if (score >= 0.4) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' }
  return { label: 'At Risk', color: 'bg-red-100 text-red-800' }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const { data: valuations } = await supabase.from('valuation_projections').select('*').eq('user_id', user!.id).order('year')
  const { data: repurchase } = await supabase.from('repurchase_obligations').select('*').eq('user_id', user!.id).order('year')
  const { data: population } = await supabase.from('population_analyses').select('*').eq('user_id', user!.id).order('year')
  const { data: scores } = await supabase.from('success_scores').select('*').eq('user_id', user!.id).order('year_for_payout')
  const { data: turnover } = await supabase.from('share_turnover_schedules').select('*').eq('user_id', user!.id)

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
  const currentYear = new Date().getFullYear()
  const companyName = profile?.company_name || 'Your Company'

  // KPI trend data: compare Year 0 vs Year 1
  const valTrend = valuations && valuations.length >= 2
    ? pctChange(valuations[0]?.esop_valuation, valuations[1]?.esop_valuation) : null
  const priceTrend = valuations && valuations.length >= 2
    ? pctChange(valuations[0]?.price_per_share, valuations[1]?.price_per_share) : null
  const popTrend = population && population.length >= 2
    ? pctChange(population[0]?.active_participants, population[1]?.active_participants) : null

  // Success score helpers
  const latestScore = scores && scores.length > 0 ? scores[scores.length - 1] : null
  const scoreVal = latestScore ? (latestScore.esop_success_score > 1 ? latestScore.esop_success_score / 100 : latestScore.esop_success_score) : null
  const projectedScore = scores && scores.length >= 3 ? scores[scores.length - 1] : null
  const health = scoreVal != null ? healthLabel(scoreVal) : null

  // Settings completeness check
  const settingsIncomplete = hasData && (!profile?.company_name || !profile?.discount_rate)

  // Valuation snapshot rows: Year 1, Year 5, Year 10
  const valSnapRows = [0, 4, 9].map(i => valuations?.[i]).filter(Boolean)

  // RO Drivers: aggregate turnover schedule data across all years
  const totalDivers = turnover?.reduce((s: number, r: any) => s + (Number(r.diversification) || 0), 0) ?? 0
  const totalRetire = turnover?.reduce((s: number, r: any) => s + (Number(r.retirement_death_disability) || 0), 0) ?? 0
  const totalTurnoverShares = turnover?.reduce((s: number, r: any) => s + (Number(r.turnover) || 0), 0) ?? 0
  const driverTotal = totalDivers + totalRetire + totalTurnoverShares
  const diversPct = driverTotal > 0 ? ((totalDivers / driverTotal) * 100).toFixed(1) : '0.0'
  const retirePct = driverTotal > 0 ? ((totalRetire / driverTotal) * 100).toFixed(1) : '0.0'
  const turnoverPct = driverTotal > 0 ? ((totalTurnoverShares / driverTotal) * 100).toFixed(1) : '0.0'

  // SEN-191, SEN-193: Population & Compensation reads Year 0 for consistency with the top KPI card.
  // Using the latest (Year 10) row caused active count drift and zero benefit rate when
  // most participants were retired/terminated by the last projection year.
  const year0Pop = population && population.length > 0 ? population[0] : null
  const activeParticipants = year0Pop?.active_participants?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '0'
  const avgTotalComp = year0Pop?.avg_total_compensation
    ? Math.round(Number(year0Pop.avg_total_compensation)).toLocaleString('en-US')
    : '0'
  const benefitRate = year0Pop?.effective_benefit_rate != null
    ? (() => {
        const val = Number(year0Pop.effective_benefit_rate)
        // Guard: legacy data might store already-scaled (>1). Ratio < 1 → multiply by 100.
        return val > 1 ? val.toFixed(2) : (val * 100).toFixed(2)
      })()
    : 'N/A'
  // SEN-192: shareTurn is now a ratio from the engine. Still guard for legacy rows
  // that stored a raw share count by treating > 1 as "already a percent value".
  const shareTurn = year0Pop?.share_turn != null
    ? (() => {
        const val = Number(year0Pop.share_turn)
        return val > 1 ? val.toFixed(2) : (val * 100).toFixed(2)
      })()
    : 'N/A'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ESOP Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {companyName} — Plan Year {currentYear}
          </p>
          {profile?.last_updated_at && (
            <p className="text-xs text-green-600 mt-1">
              Last Updated: {new Date(profile.last_updated_at).toLocaleDateString('en-US', {
                month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}
        </div>
        {hasData && (
          <Link href="/report" className="inline-flex items-center gap-2 px-4 py-2 bg-menke-navy text-white text-sm font-medium rounded-lg hover:bg-menke-navy-light transition-colors">
            <FileText className="h-4 w-4" />
            Generate Report
          </Link>
        )}
      </div>

      {/* Alert banners */}
      {settingsIncomplete && (
        <Link href="/settings" className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 hover:bg-yellow-100 transition-colors">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Complete your plan settings for more accurate projections &rarr;
        </Link>
      )}

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data Uploaded Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Upload your ESOP Excel workbook to see projections, valuations, and analytics across your dashboard.
            </p>
            <div className="flex gap-3">
              <Link href="/import" className="inline-flex items-center px-4 py-2 bg-menke-navy text-white rounded-lg hover:bg-menke-navy-light transition-colors">
                Import Excel Data
              </Link>
              <Link href="/about" className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                Learn More
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <section aria-label="Key Metrics" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/valuation" className="block hover:ring-2 hover:ring-blue-200 rounded-xl transition-shadow">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <h3 className="text-sm font-medium text-gray-500">ESOP Valuation</h3>
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmt(valuations?.[0]?.esop_valuation)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {valTrend ? (
                      <>
                        {valTrend.up ? <TrendingUp className="h-3 w-3 text-green-600" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                        <span className={`text-xs font-medium ${valTrend.up ? 'text-green-600' : 'text-red-500'}`}>{valTrend.text}</span>
                        <span className="text-xs text-gray-400 ml-1">vs Year 0</span>
                      </>
                    ) : <span className="text-xs text-gray-400">&mdash;</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/valuation" className="block hover:ring-2 hover:ring-blue-200 rounded-xl transition-shadow">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <h3 className="text-sm font-medium text-gray-500">Share Price</h3>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${valuations?.[0]?.price_per_share?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {priceTrend ? (
                      <>
                        {priceTrend.up ? <TrendingUp className="h-3 w-3 text-green-600" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                        <span className={`text-xs font-medium ${priceTrend.up ? 'text-green-600' : 'text-red-500'}`}>{priceTrend.text}</span>
                        <span className="text-xs text-gray-400 ml-1">vs Year 0</span>
                      </>
                    ) : <span className="text-xs text-gray-400">&mdash;</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/population" className="block hover:ring-2 hover:ring-blue-200 rounded-xl transition-shadow">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <h3 className="text-sm font-medium text-gray-500">Active Participants</h3>
                  <Users className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {population?.[0]?.active_participants?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '0'}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {popTrend ? (
                      <>
                        {popTrend.up ? <TrendingUp className="h-3 w-3 text-green-600" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                        <span className={`text-xs font-medium ${popTrend.up ? 'text-green-600' : 'text-red-500'}`}>{popTrend.text}</span>
                        <span className="text-xs text-gray-400 ml-1">vs Year 0</span>
                      </>
                    ) : <span className="text-xs text-gray-400">&mdash;</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/success-score" className="block hover:ring-2 hover:ring-blue-200 rounded-xl transition-shadow">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <h3 className="text-sm font-medium text-gray-500">Success Score</h3>
                  <Award className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {scoreVal != null && health ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{scoreVal.toFixed(2)} / 1.0</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${health.color}`}>{health.label}</span>
                      </div>
                      {projectedScore && (
                        <p className="text-xs text-gray-500 mt-1">
                          Projected to {(projectedScore.esop_success_score > 1 ? projectedScore.esop_success_score / 100 : projectedScore.esop_success_score).toFixed(2)} by Year {projectedScore.year_for_payout}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">N/A</div>
                      <p className="text-xs text-gray-400 mt-1">ESOP sustainability rating</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          </section>

          {/* Tables */}
          <section aria-label="Data Tables" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RO Projection Table */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Repurchase Obligation Projection</h3>
              </CardHeader>
              <CardContent className="space-y-3">
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
                          <td className="text-right py-2">{fmt(row.total_repurchase_obligation)}</td>
                          <td className="text-right py-2">{fmt(row.npv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link href="/repurchase" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
                  View Full Projection &rarr;
                </Link>
              </CardContent>
            </Card>

            {/* Valuation Summary Card */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Valuation Snapshot</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Valuation snapshot</caption>
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-gray-500">Year</th>
                        <th className="text-right py-2 font-medium text-gray-500">ESOP Value</th>
                        <th className="text-right py-2 font-medium text-gray-500">Price/Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valSnapRows.map((row) => (
                        <tr key={row.year} className="border-b last:border-0">
                          <td className="py-2">{row.year}</td>
                          <td className="text-right py-2">{fmt(row.esop_valuation)}</td>
                          <td className="text-right py-2">${row.price_per_share?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link href="/valuation" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
                  View Full Analysis &rarr;
                </Link>
              </CardContent>
            </Card>
          </section>

          {/* Legacy Analytics Sections */}
          <section aria-label="Analytics Details" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* RO Drivers Summary */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Repurchase Obligation Drivers</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-menke-navy">{diversPct}%</p>
                    <p className="text-xs text-gray-500">Diversification</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-menke-navy">{retirePct}%</p>
                    <p className="text-xs text-gray-500">Retirement &amp; Disability</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-menke-navy">{turnoverPct}%</p>
                    <p className="text-xs text-gray-500">Turnover</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Population & Compensation Summary */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Population &amp; Compensation</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Active Participants</p>
                    <p className="text-lg font-bold">{activeParticipants}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Total Compensation</p>
                    <p className="text-lg font-bold">${avgTotalComp}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Effective Benefit Rate</p>
                    <p className="text-lg font-bold">{benefitRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Share Turn</p>
                    <p className="text-lg font-bold">{shareTurn}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ESOP Success Score Trend */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h3 className="font-semibold text-gray-900">ESOP Success Score Trend</h3>
                <Link href="/success-score" className="text-sm text-blue-600 hover:text-blue-800">View details &rarr;</Link>
              </CardHeader>
              <CardContent>
                {scores && scores.length > 0 ? (
                  <>
                    <div className="flex items-end gap-1 h-16">
                      {scores.map((s, i) => {
                        const pct = s.esop_success_score > 1 ? s.esop_success_score : s.esop_success_score * 100
                        const height = Math.max(pct, 5)
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-menke-navy rounded-t"
                            style={{ height: `${height}%` }}
                            title={`${s.year_for_payout}: ${pct.toFixed(1)}%`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{scores[0]?.year_for_payout?.substring(0, 4)}</span>
                      <span>{scores[scores.length - 1]?.year_for_payout?.substring(0, 4)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No score data available</p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Quick Actions */}
          <section aria-label="Quick Actions">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/report" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <FileText className="h-4 w-4" /> Generate Report
              </Link>
              <Link href="/projections" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <BarChart3 className="h-4 w-4" /> Run Population Projection
              </Link>
              <Link href="/population" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <UsersRound className="h-4 w-4" /> View All Participants
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
