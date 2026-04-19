import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AppLineChart } from '@/components/charts/line-chart'
import { CHART_COLORS } from '@/lib/chart-colors'
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
  // SEN-228: the previous version used `user!.id` — a TypeScript non-null
  // assertion that does nothing at runtime. If the session cookie is
  // stale or the token refresh inside this page silently fails (the
  // layout can't set cookies, see /lib/supabase/server.ts comment),
  // `user` ends up null and every subsequent `user!.id` throws a
  // TypeError. Next.js's RSC streaming catches those and falls through
  // to not-found.tsx, producing the "stuck on skeleton" symptom.
  // SEN-228 diagnostic: write every step to a DB table so we get the full trace
  // (Vercel was only capturing the first console.log per request).
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const t0 = Date.now()
  const supabase = await createClient()
  // Use a separate service-role or anon client bypass via our disabled-RLS diag table
  const trace = async (step: string, info = '') => {
    try {
      await supabase.from('sen228_diag').insert({ req_id: reqId, t_ms: Date.now() - t0, step, info })
    } catch {}
    console.log(`[SEN-228 ${reqId}] t+${Date.now() - t0}ms ${step} ${info}`)
  }
  await trace('start')
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  await trace('getUser_done', `user=${user?.id ?? 'null'} err=${authErr?.message ?? 'none'}`)
  if (!user) redirect('/login')
  const userId = user.id

  await trace('q1_profiles_start')
  const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  await trace('q1_profiles_done', `err=${profErr?.message ?? 'none'} hasRow=${!!profile}`)

  await trace('q2_valuations_start')
  const { data: valuations, error: valErr } = await supabase.from('valuation_projections').select('*').eq('user_id', userId).order('year')
  await trace('q2_valuations_done', `err=${valErr?.message ?? 'none'} rows=${valuations?.length ?? 'null'}`)

  await trace('q3_repurchase_start')
  const { data: repurchase, error: repErr } = await supabase.from('repurchase_obligations').select('*').eq('user_id', userId).order('year')
  await trace('q3_repurchase_done', `err=${repErr?.message ?? 'none'} rows=${repurchase?.length ?? 'null'}`)

  await trace('q4_population_start')
  const { data: population, error: popErr } = await supabase.from('population_analyses').select('*').eq('user_id', userId).order('year')
  await trace('q4_population_done', `err=${popErr?.message ?? 'none'} rows=${population?.length ?? 'null'}`)

  await trace('q5_scores_start')
  const { data: scores, error: scoreErr } = await supabase.from('success_scores').select('*').eq('user_id', userId).order('year_for_payout')
  await trace('q5_scores_done', `err=${scoreErr?.message ?? 'none'} rows=${scores?.length ?? 'null'}`)

  await trace('q6_turnover_start')
  const { data: turnover, error: turnErr } = await supabase.from('share_turnover_schedules').select('*').eq('user_id', userId)
  await trace('q6_turnover_done', `err=${turnErr?.message ?? 'none'} rows=${turnover?.length ?? 'null'}`)

  await trace('all_queries_complete')

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
  const scoreVal = latestScore && latestScore.esop_success_score != null
    ? (latestScore.esop_success_score > 1 ? latestScore.esop_success_score / 100 : latestScore.esop_success_score)
    : null
  const projectedScore = scores && scores.length >= 3 ? scores[scores.length - 1] : null
  const health = scoreVal != null ? healthLabel(scoreVal) : null

  // Settings completeness check — profile may have no discount_rate column,
  // so just flag incomplete when the display-critical company_name is missing.
  const settingsIncomplete = hasData && !profile?.company_name

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

  // SEN-206: Purchase Average = average total RO across the projection horizon.
  // Purchase Average % = Purchase Average / average ESOP Valuation.
  const roValues = repurchase?.map((r: any) => Number(r.total_repurchase_obligation) || 0) ?? []
  const purchaseAverage = roValues.length > 0
    ? roValues.reduce((a: number, b: number) => a + b, 0) / roValues.length
    : 0
  const valuationValues = valuations?.map((v: any) => Number(v.esop_valuation) || 0) ?? []
  const avgValuation = valuationValues.length > 0
    ? valuationValues.reduce((a: number, b: number) => a + b, 0) / valuationValues.length
    : 0
  const purchaseAveragePct = avgValuation > 0 ? purchaseAverage / avgValuation : 0

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

  await trace('pre_return', `hasData=${hasData} scoreVal=${scoreVal} activeParticipants=${activeParticipants}`)

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

          {/* Executive Summary Highlights — Low/High/Average for key metrics */}
          {(() => {
            const roVals = (repurchase ?? []).map((r: any) => Number(r.total_repurchase_obligation) || 0)
            const nonZero = roVals.filter(v => v > 0)
            const roLow = nonZero.length ? Math.min(...nonZero) : 0
            const roHigh = roVals.length ? Math.max(...roVals) : 0
            const roAvg = roVals.length ? roVals.reduce((a, b) => a + b, 0) / roVals.length : 0
            const roLowYr = repurchase?.[roVals.indexOf(roLow)]?.calendar_year_for_payout ?? ''
            const roHighYr = repurchase?.[roVals.indexOf(roHigh)]?.calendar_year_for_payout ?? ''

            const benefitVals = (population ?? []).map((p: any) => Number(p.effective_benefit_rate) || 0)
            const benefitLow = benefitVals.length ? Math.min(...benefitVals) : 0
            const benefitHigh = benefitVals.length ? Math.max(...benefitVals) : 0
            const benefitAvg = benefitVals.length ? benefitVals.reduce((a, b) => a + b, 0) / benefitVals.length : 0

            const compVals = (population ?? []).map((p: any) => Number(p.avg_total_compensation) || 0)
            const compLow = compVals.length ? Math.min(...compVals) : 0
            const compHigh = compVals.length ? Math.max(...compVals) : 0
            const compAvg = compVals.length ? compVals.reduce((a, b) => a + b, 0) / compVals.length : 0

            const priceChanges = (valuations ?? []).map((v: any) => Number(v.share_price_change) || 0)
            const pcLow = priceChanges.length ? Math.min(...priceChanges) : 0
            const pcHigh = priceChanges.length ? Math.max(...priceChanges) : 0
            const pcAvg = priceChanges.length ? priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length : 0

            const scoreVals = (scores ?? []).map((s: any) => {
              const v = Number(s.esop_success_score) || 0
              return Math.abs(v) > 1 ? v : v * 100
            })
            const scLow = scoreVals.length ? Math.min(...scoreVals) : 0
            const scHigh = scoreVals.length ? Math.max(...scoreVals) : 0
            const scAvg = scoreVals.length ? scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length : 0

            const dollar = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`
            const pctFmt = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`

            const tiles: Array<{ title: string; low: string; high: string; avg: string }> = [
              { title: 'Repurchase Obligation Projection',
                low: `${dollar(roLow)}${roLowYr ? ` (${roLowYr})` : ''}`,
                high: `${dollar(roHigh)}${roHighYr ? ` (${roHighYr})` : ''}`,
                avg: dollar(roAvg) },
              { title: 'Valuation Projection — Share Price Change',
                low: pctFmt(pcLow, 0), high: pctFmt(pcHigh, 0), avg: pctFmt(pcAvg, 0) },
              { title: 'Effective ESOP Benefit Rate',
                low: pctFmt(benefitLow, 2), high: pctFmt(benefitHigh, 2), avg: pctFmt(benefitAvg, 2) },
              { title: 'Average Total Compensation',
                low: dollar(compLow), high: dollar(compHigh), avg: dollar(compAvg) },
              { title: 'ESOP Success Score',
                low: `${scLow.toFixed(0)}%`, high: `${scHigh.toFixed(0)}%`, avg: `${scAvg.toFixed(1)}%` },
            ]

            return (
              <section aria-label="Executive Summary Highlights" className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Executive Summary Highlights</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tiles.map((t) => (
                    <Card key={t.title}>
                      <CardHeader className="pb-2">
                        <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Low</p>
                            <p className="text-lg font-bold text-menke-navy mt-1">{t.low}</p>
                          </div>
                          <div className="border-x border-gray-200">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">High</p>
                            <p className="text-lg font-bold text-menke-navy mt-1">{t.high}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Average</p>
                            <p className="text-lg font-bold text-menke-navy mt-1">{t.avg}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )
          })()}

          {/*
            SEN-227: Projection charts — one inline line chart per primary
            metric, matching legacy `Views/index/Index.cshtml` which pairs a
            Low/High/Average tile with an inline trend chart. Three charts:
            Repurchase Obligation, Valuation Share Price Change, Success Score.
          */}
          {(repurchase?.length || valuations?.length || scores?.length) ? (
            <section aria-label="Projection Charts" className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Projection Charts</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {repurchase && repurchase.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <h3 className="text-sm font-semibold text-gray-800">Repurchase Obligation Projection</h3>
                      <p className="text-xs text-gray-500">Total RO over the projection horizon</p>
                    </CardHeader>
                    <CardContent>
                      <AppLineChart
                        data={repurchase.map((r: { year: string; total_repurchase_obligation: number }) => ({
                          year: r.year,
                          ro: Number(r.total_repurchase_obligation) || 0,
                        }))}
                        xKey="year"
                        lines={[{ key: 'ro', color: CHART_COLORS.red, name: 'Total RO' }]}
                        height={220}
                        formatType="dollarM"
                      />
                    </CardContent>
                  </Card>
                )}
                {valuations && valuations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <h3 className="text-sm font-semibold text-gray-800">Valuation — Share Price Change</h3>
                      <p className="text-xs text-gray-500">Year-over-year share price growth</p>
                    </CardHeader>
                    <CardContent>
                      <AppLineChart
                        data={valuations.map((v: { year: string; share_price_change: number | null }) => ({
                          year: v.year,
                          change: Number(v.share_price_change) || 0,
                        }))}
                        xKey="year"
                        lines={[{ key: 'change', color: CHART_COLORS.blue, name: 'Share Price Change' }]}
                        height={220}
                        formatType="percent"
                      />
                    </CardContent>
                  </Card>
                )}
                {scores && scores.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <h3 className="text-sm font-semibold text-gray-800">ESOP Success Score Projection</h3>
                      <p className="text-xs text-gray-500">Plan sustainability rating by payout year</p>
                    </CardHeader>
                    <CardContent>
                      <AppLineChart
                        data={scores.map((s: { year_for_payout: string; esop_success_score: number }) => {
                          const raw = Number(s.esop_success_score) || 0
                          // Normalise to 0–1 range for percent formatter.
                          return { year: s.year_for_payout, score: Math.abs(raw) > 1 ? raw / 100 : raw }
                        })}
                        xKey="year"
                        lines={[{ key: 'score', color: CHART_COLORS.green, name: 'Success Score' }]}
                        height={220}
                        formatType="percent"
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          ) : null}

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
                {/* SEN-206: Purchase Average KPIs */}
                <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-menke-navy">{fmt(purchaseAverage)}</p>
                    <p className="text-xs text-gray-500">Purchase Average</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-menke-navy">{(purchaseAveragePct * 100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">Purchase Avg / Valuation</p>
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
              <Link href="/population/projection" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
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
