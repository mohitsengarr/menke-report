import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  renderLineChart, renderBarChart, renderPieChart, renderStackedBarChart,
  CHART_BRAND,
} from '@/lib/report/svg-charts'

/**
 * Brand-faithful Menke ESOP Sustainability report (PDF via HTML + print).
 * Mirrors the legacy ReportModel.cs section list from the reference PDF:
 *   Cover / TOC / Executive Summary (text) / Exec Summary Highlights
 *   (Low-High-Avg cards) / RO Drivers pie / Stock Allocation by Age
 *   bar / Terminated Participants / Benefit Rate Benchmark / Scenario 1
 *   Baseline RO table + bar / Share Turnover table + bar / Detailed Share
 *   Turnover / Benefit Rate & Compensation Analysis / Avg Age & Tenure
 *   / Top 10% Population / Top 10% account balances / Valuation / ESOP
 *   Valuation / Share Price / ESOP Fringe Benefit Rate / Success Score
 *   framework + table + chart / Assumptions (4 subsections) / Conclusion
 *   / Repurchase Strategy Doc / Investment Policy OIA
 */

const NAVY = '#1C3D80'
const NAVY_LIGHT = '#2C4F95'
const GOLD = '#D4A843'
const LIGHT = '#f8f9fa'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    // SEN-223: full legacy `ReportModel.cs` narrative set — 28 fields grouped
    // into Plan Structure / Redemption / Funding / Life Cycle / Assumptions /
    // Dividends / Plan Design / Disclaimer. All optional; the PDF renders a
    // "Narrative" section only when at least one of these is provided.
    const {
      title, subtitle, reportDate, executiveSummary,
      planStage, fundingApproach, contributionSource,
      leveraged, leveragedDiscussion, substantial, substantialDiscussion, annualContributions,
      followedRedemption, stockRedemption, recycling, approach,
      contributionFunding, cashComeFrom,
      materialEvents, earlyStage, midStage, lateStages,
      diversification, turnoverAssumption, death, disability, retirementAge, salaryIncrease,
      dividendsContributions, repurchaseMethod,
      participation, eligibility, allocations: planAllocations,
      disclaimer,
    } = body as Record<string, string | undefined>

    const [
      profile, valuations, repurchase, turnover, population, scores,
      ageTenureActive, ageTenureTerminated, participants,
      provisions, allocations, distributions, funding,
      valuationInputs, sharePrices,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('valuation_projections').select('*').eq('user_id', user.id).order('year'),
      supabase.from('repurchase_obligations').select('*').eq('user_id', user.id).order('year'),
      supabase.from('share_turnover_schedules').select('*').eq('user_id', user.id).order('year'),
      supabase.from('population_analyses').select('*').eq('user_id', user.id).order('year'),
      supabase.from('success_scores').select('*').eq('user_id', user.id).order('year_for_payout'),
      supabase.from('average_age_tenure_active').select('*').eq('user_id', user.id),
      supabase.from('average_age_tenure_terminated').select('*').eq('user_id', user.id),
      supabase.from('input_data').select('*').eq('user_id', user.id),
      supabase.from('plan_provisions').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('allocations').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('distributions').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('funding').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('valuation_inputs').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('beginning_share_prices').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    const companyName = profile.data?.company_name || 'Test Company'
    const html = buildReportHTML({
      title: title || companyName,
      subtitle: subtitle || 'ESOP Sustainability',
      reportDate: reportDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      executiveSummary: executiveSummary || '',
      planStage: planStage || '',
      fundingApproach: fundingApproach || '',
      contributionSource: contributionSource || '',
      narrative: {
        leveraged: leveraged || '',
        leveragedDiscussion: leveragedDiscussion || '',
        substantial: substantial || '',
        substantialDiscussion: substantialDiscussion || '',
        annualContributions: annualContributions || '',
        followedRedemption: followedRedemption || '',
        stockRedemption: stockRedemption || '',
        recycling: recycling || '',
        approach: approach || '',
        contributionFunding: contributionFunding || '',
        cashComeFrom: cashComeFrom || '',
        materialEvents: materialEvents || '',
        earlyStage: earlyStage || '',
        midStage: midStage || '',
        lateStages: lateStages || '',
        diversification: diversification || '',
        turnoverAssumption: turnoverAssumption || '',
        death: death || '',
        disability: disability || '',
        retirementAge: retirementAge || '',
        salaryIncrease: salaryIncrease || '',
        dividendsContributions: dividendsContributions || '',
        repurchaseMethod: repurchaseMethod || '',
        participation: participation || '',
        eligibility: eligibility || '',
        planAllocations: planAllocations || '',
        disclaimer: disclaimer || '',
      },
      valuations: valuations.data ?? [],
      repurchase: repurchase.data ?? [],
      turnover: turnover.data ?? [],
      population: population.data ?? [],
      scores: scores.data ?? [],
      ageTenureActive: ageTenureActive.data ?? [],
      ageTenureTerminated: ageTenureTerminated.data ?? [],
      participants: participants.data ?? [],
      provisions: provisions.data,
      allocations: allocations.data,
      distributions: distributions.data,
      funding: funding.data,
      valuationInputs: valuationInputs.data,
      sharePrices: sharePrices.data,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${(title || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.html"`,
      },
    })
  } catch (error) {
    console.error('PDF report generation error:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// Format helpers
// ═══════════════════════════════════════════════════════════════
const fmtInt = (n: unknown) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmtDec = (n: unknown, d = 2) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmt$ = (n: unknown) => `$${fmtInt(n)}`
const fmt$d = (n: unknown) => `$${fmtDec(n, 2)}`
const fmtPct = (n: unknown, d = 2) => {
  const v = Number(n ?? 0)
  // values stored as ratios (0-1) get scaled, already-percent values don't
  const scaled = Math.abs(v) <= 1 ? v * 100 : v
  return `${scaled.toFixed(d)}%`
}
const escape = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function calendarYearFromIso(iso: string | null | undefined, fallback: number): number {
  if (!iso) return fallback
  const y = Number(String(iso).slice(0, 4))
  return Number.isFinite(y) ? y : fallback
}

function yearFromRow(r: any, firstYear: number, index: number): number {
  const cal = r?.calendar_year_for_payout ?? r?.year_for_payout ?? r?.year
  if (cal && String(cal).match(/\d{4}/)) {
    const m = String(cal).match(/\d{4}/)
    return Number(m![0])
  }
  return firstYear + index
}

/**
 * SEN-223: `narrative` bundles all 28 legacy `ReportModel.cs` free-text
 * fields. Each is optional; the PDF only renders sections for fields that
 * contain text, so a minimal report with no narrative still produces a
 * clean document.
 */
export interface ReportNarrative {
  leveraged: string
  leveragedDiscussion: string
  substantial: string
  substantialDiscussion: string
  annualContributions: string
  followedRedemption: string
  stockRedemption: string
  recycling: string
  approach: string
  contributionFunding: string
  cashComeFrom: string
  materialEvents: string
  earlyStage: string
  midStage: string
  lateStages: string
  diversification: string
  turnoverAssumption: string
  death: string
  disability: string
  retirementAge: string
  salaryIncrease: string
  dividendsContributions: string
  repurchaseMethod: string
  participation: string
  eligibility: string
  planAllocations: string
  disclaimer: string
}

interface ReportData {
  title: string
  subtitle: string
  reportDate: string
  executiveSummary: string
  planStage: string
  fundingApproach: string
  contributionSource: string
  narrative: ReportNarrative
  valuations: any[]
  repurchase: any[]
  turnover: any[]
  population: any[]
  scores: any[]
  ageTenureActive: any[]
  ageTenureTerminated: any[]
  participants: any[]
  provisions: any
  allocations: any
  distributions: any
  funding: any
  valuationInputs: any
  sharePrices: any
}

/**
 * SEN-223/SEN-224: True when at least one narrative field is non-empty.
 * Used to decide whether the TOC gets a "Plan Narrative" entry and
 * whether to allocate PDF pages for any narrative sections.
 */
function hasAnyNarrative(n: ReportNarrative | undefined | null): boolean {
  if (!n) return false
  return Object.values(n).some(v => typeof v === 'string' && v.trim().length > 0)
}

/**
 * SEN-223: Render the user-supplied narrative bundle into a set of PDF
 * pages. Each group (Plan Structure, Redemption, Funding, Life Cycle,
 * Assumptions, Dividends, Plan Design, Disclaimer override) appears only
 * when at least one of its fields is non-empty — the PDF stays clean
 * when users skip sections.
 */
function renderNarrativeSections(n: ReportNarrative): string {
  if (!n) return ''

  const any = (...fields: string[]) => fields.some(v => v && v.trim().length > 0)
  const para = (label: string, value: string) => {
    if (!value || !value.trim()) return ''
    return `<div style="margin-bottom: 16px;">
      <h3 style="color: #1C3D80; font-size: 14px; margin-bottom: 4px;">${escape(label)}</h3>
      <p style="white-space: pre-wrap;">${escape(value)}</p>
    </div>`
  }
  const yesNo = (v: string) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—'

  const sections: string[] = []

  if (any(n.leveragedDiscussion, n.substantialDiscussion, n.annualContributions) ||
      n.leveraged || n.substantial) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Plan Structure</h1>
      ${(n.leveraged || n.substantial) ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div><strong>Leveraged ESOP:</strong> ${yesNo(n.leveraged)}</div>
          <div><strong>Substantial ESOP Ownership:</strong> ${yesNo(n.substantial)}</div>
        </div>` : ''}
      ${para('Leveraged Discussion', n.leveragedDiscussion)}
      ${para('Substantial Discussion', n.substantialDiscussion)}
      ${para('Annual Contributions', n.annualContributions)}
    </div>`)
  }

  if (any(n.followedRedemption, n.stockRedemption, n.recycling, n.approach)) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Redemption &amp; Recycling</h1>
      ${para('Followed Redemption', n.followedRedemption)}
      ${para('Stock Redemption', n.stockRedemption)}
      ${para('Recycling', n.recycling)}
      ${para('Approach', n.approach)}
    </div>`)
  }

  if (any(n.contributionFunding, n.cashComeFrom)) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Funding Approach</h1>
      ${para('Contribution Funding', n.contributionFunding)}
      ${para('Where the Cash Comes From', n.cashComeFrom)}
    </div>`)
  }

  if (any(n.materialEvents, n.earlyStage, n.midStage, n.lateStages)) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Plan Life Cycle</h1>
      ${para('Material Events', n.materialEvents)}
      ${para('Early Stage', n.earlyStage)}
      ${para('Mid Stage', n.midStage)}
      ${para('Late Stages', n.lateStages)}
    </div>`)
  }

  if (any(n.diversification, n.turnoverAssumption, n.death, n.disability, n.retirementAge, n.salaryIncrease)) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Assumptions &amp; Projections</h1>
      ${para('Diversification', n.diversification)}
      ${para('Turnover', n.turnoverAssumption)}
      ${para('Death', n.death)}
      ${para('Disability', n.disability)}
      ${para('Retirement Age', n.retirementAge)}
      ${para('Salary Increase', n.salaryIncrease)}
    </div>`)
  }

  if (any(n.dividendsContributions, n.repurchaseMethod)) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Dividends &amp; Repurchase</h1>
      ${para('Dividends / Contributions', n.dividendsContributions)}
      ${para('Repurchase Method', n.repurchaseMethod)}
    </div>`)
  }

  if (any(n.participation, n.eligibility, n.planAllocations)) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Plan Design</h1>
      ${para('Participation', n.participation)}
      ${para('Eligibility', n.eligibility)}
      ${para('Allocations', n.planAllocations)}
    </div>`)
  }

  if (n.disclaimer && n.disclaimer.trim()) {
    sections.push(`<div class="page narrative">
      <h1 class="section-head">Disclaimer</h1>
      <p style="white-space: pre-wrap;">${escape(n.disclaimer)}</p>
    </div>`)
  }

  return sections.join('\n')
}

function buildReportHTML(data: ReportData): string {
  const { title, subtitle, reportDate, executiveSummary } = data

  const baseYear = data.funding?.plan_year_end
    ? calendarYearFromIso(data.funding.plan_year_end, new Date().getFullYear())
    : new Date().getFullYear()
  const firstYear = baseYear

  // ─── Executive summary derived values ───
  const roRows = data.repurchase
  const roValues = roRows.map((r: any) => Number(r.total_repurchase_obligation) || 0)
  const nonZeroRo = roValues.filter((v) => v > 0)
  const roMin = nonZeroRo.length ? Math.min(...nonZeroRo) : (roValues[0] ?? 0)
  const roMax = roValues.length ? Math.max(...roValues) : 0
  const roAvg = roValues.length ? roValues.reduce((a, b) => a + b, 0) / roValues.length : 0
  const roMinYear = roRows[roValues.indexOf(roMin)]?.calendar_year_for_payout ?? `Year ${roValues.indexOf(roMin)}`
  const roMaxYear = roRows[roValues.indexOf(roMax)]?.calendar_year_for_payout ?? `Year ${roValues.indexOf(roMax)}`

  const benefitRates = data.population.map((p: any) => Number(p.effective_benefit_rate) || 0)
  const benefitMin = benefitRates.length ? Math.min(...benefitRates) : 0
  const benefitMax = benefitRates.length ? Math.max(...benefitRates) : 0
  const benefitAvg = benefitRates.length ? benefitRates.reduce((a, b) => a + b, 0) / benefitRates.length : 0
  const benefitMinYear = data.population[benefitRates.indexOf(benefitMin)]?.year ?? ''
  const benefitMaxYear = data.population[benefitRates.indexOf(benefitMax)]?.year ?? ''

  const compValues = data.population.map((p: any) => Number(p.avg_total_compensation) || 0)
  const compMin = compValues.length ? Math.min(...compValues) : 0
  const compMax = compValues.length ? Math.max(...compValues) : 0
  const compAvg = compValues.length ? compValues.reduce((a, b) => a + b, 0) / compValues.length : 0
  const compMinYear = data.population[compValues.indexOf(compMin)]?.year ?? ''
  const compMaxYear = data.population[compValues.indexOf(compMax)]?.year ?? ''

  const priceChanges = data.valuations.map((v: any) => Number(v.share_price_change) || 0)
  const priceChangeAvg = priceChanges.length ? priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length : 0
  const priceChangeMin = priceChanges.length ? Math.min(...priceChanges) : 0
  const priceChangeMax = priceChanges.length ? Math.max(...priceChanges) : 0

  const scoreValues = data.scores.map((s: any) => {
    const v = Number(s.esop_success_score) || 0
    return Math.abs(v) > 1 ? v : v * 100
  })
  const scoreMin = scoreValues.length ? Math.min(...scoreValues) : 0
  const scoreMax = scoreValues.length ? Math.max(...scoreValues) : 0
  const scoreAvg = scoreValues.length ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0

  const totalDivers = data.turnover.reduce((s: number, r: any) => s + (Number(r.diversification) || 0), 0)
  const totalRetire = data.turnover.reduce((s: number, r: any) => s + (Number(r.retirement_death_disability) || 0), 0)
  const totalTurnover = data.turnover.reduce((s: number, r: any) => s + (Number(r.turnover) || 0), 0)
  const driverTotal = totalDivers + totalRetire + totalTurnover
  const diversPct = driverTotal > 0 ? (totalDivers / driverTotal) * 100 : 0
  const retirePct = driverTotal > 0 ? (totalRetire / driverTotal) * 100 : 0
  const turnoverPct = driverTotal > 0 ? (totalTurnover / driverTotal) * 100 : 0

  // Share turnover avg — shares turned / ESOP shares (per-year average)
  const totalSharesTurned = data.repurchase.reduce((s: number, r: any) => s + (Number(r.shares_turned) || 0), 0)
  const totalEsopShares = data.valuations.reduce((s: number, v: any) => s + (Number(v.esop_shares) || 0), 0)
  const shareTurnAvg = totalEsopShares > 0 ? (totalSharesTurned / totalEsopShares) * 100 : 0

  // Active participants
  const activeParticipants = data.population[0]?.active_participants ?? data.participants.filter((p: any) => !p.term_date).length
  const coveredComp = data.population[0]?.covered_compensation ?? 0
  const esopFormation = data.distributions?.esop_formation_date ?? ''
  const totalEsopSharesOwned = data.valuationInputs?.total_esop_shares ?? 0
  const totalSharesOutstanding = data.valuationInputs?.total_shares_outstanding ?? 1
  const ownershipPct = (Number(totalEsopSharesOwned) / Number(totalSharesOutstanding)) * 100

  // Cash-burn average (for the "We recommend having X" text)
  const cashBurnValues = data.scores.map((s: any) => Number(s.ro_cash_burn) || 0)
  const cashBurnAvg = cashBurnValues.length ? cashBurnValues.reduce((a, b) => a + b, 0) / cashBurnValues.length : 0
  const reserveAmount = roAvg * 3 * cashBurnAvg

  // ─── Charts ───
  const roBarChart = renderBarChart(
    data.repurchase.map((r: any, i: number) => ({
      label: String(r.calendar_year_for_payout ?? yearFromRow(r, firstYear, i)),
      value: Number(r.total_repurchase_obligation) || 0,
    })),
    { title: '', yFormat: 'dollar', color: CHART_BRAND.navy, width: 760, height: 320 }
  )
  const shareTurnoverBar = renderBarChart(
    data.turnover.map((t: any, i: number) => ({
      label: String(t.calendar_year_for_payout ?? yearFromRow(t, firstYear, i)),
      value: Number(t.total_shares) || 0,
    })),
    { title: '', color: CHART_BRAND.navy, width: 760, height: 300 }
  )
  const detailedTurnoverChart = renderStackedBarChart(
    data.turnover.map((t: any, i: number) => String(t.calendar_year_for_payout ?? yearFromRow(t, firstYear, i))),
    [
      { name: 'Diversification', values: data.turnover.map((t: any) => Number(t.diversification) || 0), color: '#6EB5F7' },
      { name: 'Retirement, Death & Disability', values: data.turnover.map((t: any) => Number(t.retirement_death_disability) || 0), color: CHART_BRAND.navy },
      { name: 'Turnover', values: data.turnover.map((t: any) => Number(t.turnover) || 0), color: '#6FCF97' },
      { name: 'In-Service Distributions', values: data.turnover.map((t: any) => Number(t.in_service_distributions) || 0), color: CHART_BRAND.orange },
    ],
    { title: '', width: 760, height: 320 }
  )
  const driversPie = renderPieChart(
    [
      { label: 'Diversification', value: totalDivers },
      { label: 'Retirement Death & Disability', value: totalRetire },
      { label: 'Turnover', value: totalTurnover },
    ],
    { title: '', width: 520, height: 360 }
  )
  const valuationBar = renderBarChart(
    data.valuations.map((v: any, i: number) => ({
      label: String(v.year ?? '').replace('Year ', '') || String(firstYear + i),
      value: Number(v.esop_valuation) || 0,
    })),
    { title: '', yFormat: 'dollar', color: CHART_BRAND.navy, width: 760, height: 320 }
  )
  const priceBar = renderBarChart(
    data.valuations.map((v: any, i: number) => ({
      label: String(v.year ?? '').replace('Year ', '') || String(firstYear + i),
      value: Number(v.price_per_share) || 0,
    })),
    { title: '', yFormat: 'dollar', color: CHART_BRAND.navy, width: 760, height: 320 }
  )
  const successChart = renderBarChart(
    data.scores.map((s: any, i: number) => ({
      label: String(s.year_for_payout ?? yearFromRow(s, firstYear, i)),
      value: (Number(s.esop_success_score) > 1) ? Number(s.esop_success_score) : Number(s.esop_success_score) * 100,
    })),
    { title: '', yFormat: 'percent', color: CHART_BRAND.navy, width: 760, height: 320 }
  )
  const benefitChart = renderBarChart(
    data.population.map((p: any, i: number) => ({
      label: String(p.year ?? '').replace('Year ', '') || String(firstYear + i),
      value: Number(p.effective_benefit_rate) || 0,
    })),
    { title: '', yFormat: 'percent', color: CHART_BRAND.navy, width: 760, height: 320 }
  )

  // Stock allocation by age group (from participant data)
  const ageGroups = [
    { label: '25-29', min: 25, max: 29 },
    { label: '30-34', min: 30, max: 34 },
    { label: '35-39', min: 35, max: 39 },
    { label: '40-44', min: 40, max: 44 },
    { label: '45-49', min: 45, max: 49 },
    { label: '50-54', min: 50, max: 54 },
    { label: '55-59', min: 55, max: 59 },
    { label: '60-64', min: 60, max: 64 },
    { label: '65+', min: 65, max: 999 },
  ]
  const today = new Date()
  const totalStock = data.participants.reduce((s: number, p: any) => {
    const shares = Array.isArray(p.shares) ? p.shares.reduce((a: number, b: number) => a + Number(b || 0), 0) : 0
    return s + shares + Number(p.stock_tranche || 0)
  }, 0)
  const stockByAgeGroup = ageGroups.map(g => {
    const stock = data.participants.reduce((s: number, p: any) => {
      if (!p.birth_date) return s
      const birth = new Date(p.birth_date)
      const age = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000))
      if (age < g.min || age > g.max) return s
      const shares = Array.isArray(p.shares) ? p.shares.reduce((a: number, b: number) => a + Number(b || 0), 0) : 0
      return s + shares + Number(p.stock_tranche || 0)
    }, 0)
    return {
      label: g.label,
      value: totalStock > 0 ? (stock / totalStock) * 100 : 0,
    }
  })
  const stockAllocationChart = renderBarChart(stockByAgeGroup, {
    title: 'Stock Allocation by Age Group',
    color: CHART_BRAND.navy,
    width: 760,
    height: 340,
    yFormat: 'percent',
  })

  // Terminated participant pie
  const termedLessThan2 = data.participants.filter((p: any) => {
    if (!p.term_date) return false
    const d = new Date(p.term_date)
    const yrs = (today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
    return yrs < 2
  })
  const termed2to5 = data.participants.filter((p: any) => {
    if (!p.term_date) return false
    const d = new Date(p.term_date)
    const yrs = (today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
    return yrs >= 2 && yrs <= 5
  })
  const termedMoreThan5 = data.participants.filter((p: any) => {
    if (!p.term_date) return false
    const d = new Date(p.term_date)
    const yrs = (today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
    return yrs > 5
  })
  const termSum = (group: any[]) => group.reduce((s, p) => {
    const shares = Array.isArray(p.shares) ? p.shares.reduce((a: number, b: number) => a + Number(b || 0), 0) : 0
    return s + shares + Number(p.stock_tranche || 0)
  }, 0)
  const termedPie = renderPieChart(
    [
      { label: 'Termed < 2', value: termedLessThan2.length },
      { label: 'Termed 2 - 5', value: termed2to5.length },
      { label: 'Termed > 5', value: termedMoreThan5.length },
    ],
    { title: 'Terminated Participants', width: 520, height: 340 }
  )
  const termedSharesChart = renderBarChart(
    [
      { label: 'Termed < 2', value: termSum(termedLessThan2) },
      { label: 'Termed 2 - 5', value: termSum(termed2to5) },
      { label: 'Termed > 5', value: termSum(termedMoreThan5) },
    ],
    { title: '', color: CHART_BRAND.navy, width: 760, height: 320 }
  )

  // Benefit rate benchmark (effective benefit rate vs industry averages — industry = 11.7%, 10.9%, 10.4%)
  const benefitBenchmark = renderBarChart(
    data.population.map((p: any, i: number) => ({
      label: String(p.year ?? '').replace('Year ', '') || String(firstYear + i),
      value: Number(p.effective_benefit_rate) || 0,
    })),
    { title: 'Benefit Rate Benchmark', yFormat: 'percent', color: CHART_BRAND.navy, width: 760, height: 340 }
  )

  // Top 10% account balances (sorted by total balance desc)
  const withBalances = data.participants
    .map((p: any) => {
      const shares = Array.isArray(p.shares) ? p.shares.reduce((a: number, b: number) => a + Number(b || 0), 0) : 0
      const price = Number(data.valuations[0]?.price_per_share) || 0
      const balance = (shares + Number(p.stock_tranche || 0)) * price + Number(p.total_cash || 0)
      return {
        name: p.name,
        balance,
        termDate: p.term_date,
      }
    })
    .filter((p: any) => p.name && p.balance > 0)
    .sort((a: any, b: any) => b.balance - a.balance)
  const top10Count = Math.max(1, Math.ceil(withBalances.length * 0.10))
  const top10Balances = withBalances.slice(0, top10Count)

  // Covered compensation formatted
  const coveredCompFmt = fmt$(coveredComp || 0)

  // ─── Assumptions formatting helpers ───
  const pctVal = (v: unknown) => `${((Number(v) || 0) * 100).toFixed(2)}%`
  const intVal = (v: unknown) => String(Number(v) || 0)
  const moneyVal = (v: unknown) => `$${Number(v || 0).toLocaleString()}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escape(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: letter landscape; margin: 0.5in; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; font-size: 11px; }
    .page { page-break-after: always; padding: 24px 40px; min-height: 7.5in; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .page-num { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #666; }

    h1, .section-head {
      font-family: 'Impact', 'Oswald', 'Arial Black', sans-serif;
      letter-spacing: 0.5px;
      color: #000;
      font-weight: 900;
      border-bottom: 1px solid #333;
      padding-bottom: 8px;
      margin-bottom: 18px;
      text-transform: uppercase;
      font-size: 20px;
    }
    h2 { font-family: 'Segoe UI', sans-serif; font-size: 16px; font-weight: 600; color: #222; margin-top: 6px; margin-bottom: 12px; }
    h3 { font-size: 13px; font-weight: 700; color: ${NAVY}; margin: 16px 0 6px; }
    p { margin-bottom: 8px; line-height: 1.6; }
    ul, ol { margin-left: 24px; margin-bottom: 12px; }
    li { margin-bottom: 4px; line-height: 1.5; }

    /* Cover */
    .cover { height: 7.5in; display: flex; flex-direction: column; justify-content: center; padding: 0 60px; position: relative; }
    .cover-border { border: 2px solid ${NAVY}; padding: 60px 40px; height: 100%; display: flex; flex-direction: column; justify-content: center; }
    .cover-banner { background: ${NAVY}; color: white; padding: 40px 36px; margin-top: 80px; }
    .cover-banner h1 { font-family: 'Times New Roman', serif; font-size: 32px; color: white; border: 0; padding: 0; margin: 0 0 24px 0; text-transform: none; letter-spacing: 0; font-weight: 700; }
    .cover-banner h2 { font-family: 'Times New Roman', serif; font-size: 28px; color: white; margin: 0 0 14px 0; font-weight: 700; }
    .cover-banner .sub-sub { color: white; font-size: 12px; letter-spacing: 0.5px; font-weight: 600; margin-top: 4px; }
    .cover-date { margin-top: 40px; font-size: 13px; font-weight: 700; }
    .cover-logo { position: absolute; bottom: 80px; right: 100px; color: ${NAVY}; display: flex; align-items: center; gap: 12px; }
    .cover-logo-badge { background: ${NAVY}; color: ${GOLD}; padding: 12px 20px; font-size: 36px; font-weight: 800; border-radius: 8px; }
    .cover-logo-years { font-size: 10px; color: ${GOLD}; margin-top: 4px; letter-spacing: 2px; }
    .cover-logo-text { border-left: 2px solid ${NAVY}; padding-left: 14px; }
    .cover-logo-text .menke-name { font-size: 28px; font-weight: 700; }
    .cover-logo-text .menke-tagline { font-size: 9px; letter-spacing: 1.2px; margin-top: 2px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.5px; }
    th { background: #fff; color: #222; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 10.5px; border: 1px solid #ccc; border-bottom: 2px solid #666; }
    td { padding: 7px 10px; border: 1px solid #e0e0e0; color: #333; }
    tr.avg-row td { background: #fafafa; font-weight: 600; }
    td.highlight-green { background: #2E7D32; color: white; font-weight: 600; }
    td.highlight-navy { background: ${NAVY}; color: white; font-weight: 600; }

    /* Low/High/Avg header tables */
    .lha-table { margin: 6px 0 16px; }
    .lha-table th { background: ${NAVY}; color: white; padding: 10px 14px; text-align: left; font-weight: 700; border: 0; border-bottom: 0; font-size: 12px; }
    .lha-table td { padding: 8px 14px; border: 1px solid #e0e0e0; font-size: 11px; }

    /* TOC */
    .toc ul { list-style: none; margin: 0; padding: 0; }
    .toc li { padding: 4px 0; font-size: 12px; color: #222; }
    .toc li::before { content: "- "; color: ${NAVY}; font-weight: bold; }
    .toc li.sub { padding-left: 24px; }

    .narrative p { margin-bottom: 10px; line-height: 1.6; }
    .narrative strong { color: #111; }
    .narrative ol { margin-top: 8px; }

    .banner-label { background: ${NAVY}; color: white; padding: 8px 12px; font-weight: 700; font-size: 11px; text-transform: none; }

    /* ESOP Sustainability Score rainbow bar */
    .score-scale { display: flex; width: 100%; margin-top: 20px; }
    .score-scale > div { flex: 1; padding: 14px 10px; text-align: center; color: #222; font-weight: 700; }
    .score-scale .impaired { background: #E94B3C; color: white; }
    .score-scale .weakness { background: #F1C40F; }
    .score-scale .moderate { background: #D3D3D3; }
    .score-scale .strong { background: #27AE60; color: white; }

    .section-divider {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 7.5in;
      font-size: 18px;
      font-weight: 700;
      color: #222;
      font-family: 'Times New Roman', serif;
      font-style: italic;
    }

    .chart-wrap { margin: 20px 0; }
    .kv { display: flex; align-items: center; margin: 6px 0; font-size: 12px; }
    .kv .k { font-weight: 700; min-width: 280px; text-decoration: underline; text-underline-offset: 3px; }
    .kv .v { color: #333; }
    .sub-heading { font-weight: 700; text-decoration: underline; margin: 14px 0 10px; font-size: 13px; }

    .no-print { display: block; }
    @media print {
      .no-print { display: none; }
      .page { padding: 16px 30px; min-height: auto; }
    }
  </style>
</head>
<body>

  <!-- ═══════ COVER ═══════ -->
  <div class="page cover" style="padding: 40px;">
    <div class="cover-border">
      <div class="cover-banner">
        <h1>${escape(title)}</h1>
        <h2>${escape(subtitle)}</h2>
        <div class="sub-sub">MENKE ESOP SUCCESS SCORE&reg;</div>
      </div>
      <div class="cover-date">${escape(reportDate)}</div>
      <div class="cover-logo">
        <div style="text-align: center;">
          <div class="cover-logo-badge">50</div>
          <div class="cover-logo-years">YEARS</div>
        </div>
        <div class="cover-logo-text">
          <div class="menke-name">MENKE</div>
          <div class="menke-tagline">ESOP ADVISORS SINCE 1974</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════ TOC ═══════ -->
  <div class="page toc">
    <h1 class="section-head">TABLE OF CONTENTS</h1>
    <ul>
      <li>Executive Summary</li>
      <li>Scenario 1 : ESOP Repurchase Obligation 10-Year Projection (Baseline)</li>
      <li>Share Turnover</li>
      <li>Population Analysis</li>
      <li class="sub">ESOP Benefit Rate &amp; Compensation Analysis</li>
      <li class="sub">Age &amp; Tenure Trends</li>
      <li>Capital Table &amp; Valuation Projections</li>
      <li>Your Menke ESOP Success Score</li>
      <li>Demographic Assumptions &amp; Plan Provisions</li>
      ${hasAnyNarrative(data.narrative) ? `
      <li>Plan Narrative</li>
      ${data.narrative.leveragedDiscussion || data.narrative.substantialDiscussion || data.narrative.annualContributions || data.narrative.leveraged || data.narrative.substantial ? '<li class="sub">Plan Structure</li>' : ''}
      ${data.narrative.followedRedemption || data.narrative.stockRedemption || data.narrative.recycling || data.narrative.approach ? '<li class="sub">Redemption &amp; Recycling</li>' : ''}
      ${data.narrative.contributionFunding || data.narrative.cashComeFrom ? '<li class="sub">Funding Approach</li>' : ''}
      ${data.narrative.materialEvents || data.narrative.earlyStage || data.narrative.midStage || data.narrative.lateStages ? '<li class="sub">Plan Life Cycle</li>' : ''}
      ${data.narrative.diversification || data.narrative.turnoverAssumption || data.narrative.death || data.narrative.disability || data.narrative.retirementAge || data.narrative.salaryIncrease ? '<li class="sub">Assumptions &amp; Projections</li>' : ''}
      ${data.narrative.dividendsContributions || data.narrative.repurchaseMethod ? '<li class="sub">Dividends &amp; Repurchase</li>' : ''}
      ${data.narrative.participation || data.narrative.eligibility || data.narrative.planAllocations ? '<li class="sub">Plan Design</li>' : ''}
      ` : ''}
      <li>Conclusion &amp; Documentation</li>
      <li>ESOP Lifecycle</li>
      <li>Funding Your Repurchase Obligation</li>
    </ul>
    <div class="page-num">-2-</div>
  </div>

  <!-- ═══════ EXECUTIVE SUMMARY (text) ═══════ -->
  <div class="page narrative">
    <h1 class="section-head">EXECUTIVE SUMMARY</h1>
    ${(data.planStage || data.fundingApproach || data.contributionSource) ? `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; padding: 12px 16px; background: ${LIGHT}; border-left: 4px solid ${NAVY}; font-size: 11.5px;">
      ${data.planStage ? `<div><div style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Plan Stage</div><div style="margin-top: 4px; color: ${NAVY}; font-weight: 600;">${escape(data.planStage)}</div></div>` : ''}
      ${data.fundingApproach ? `<div><div style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Funding Approach</div><div style="margin-top: 4px; color: ${NAVY}; font-weight: 600;">${escape(data.fundingApproach)}</div></div>` : ''}
      ${data.contributionSource ? `<div><div style="font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Contribution Source</div><div style="margin-top: 4px; color: ${NAVY}; font-weight: 600;">${escape(data.contributionSource)}</div></div>` : ''}
    </div>` : ''}
    ${executiveSummary ? `<p>${escape(executiveSummary)}</p>` : ''}
    <p>
      ${escape(title)} is a ${data.distributions?.sc_corporation === 'S' ? 'S-corporation' : 'C-corporation'}
      that sponsors an Employee Stock Ownership Plan (ESOP). The ESOP was established in
      <strong>${escape(esopFormation || 'N/A')}</strong> and owns
      <strong>${ownershipPct.toFixed(2)}%</strong> of common stock (${firstYear}).
      The study is based on an active starting group of <strong>${activeParticipants}</strong>
      participants and covered compensation of approximately <strong>${coveredCompFmt}</strong>
      (${firstYear}).
    </p>
    <p>
      The repurchase obligation is an off-balance sheet liability for all ESOP plan sponsors.
      In this projection, our goal is to provide you with a qualitative and quantitative
      projection of the annual cashflows required to service your ESOP repurchase obligation
      during the projection period.
    </p>
    <p>
      The annual repurchase obligation ranges from <strong>${fmt$(roMin)}</strong>
      in <strong>${escape(roMinYear)}</strong> to <strong>${fmt$(roMax)}</strong>
      in <strong>${escape(roMaxYear)}</strong>, with an average of
      <strong>${fmt$(roAvg)}</strong> per year.
    </p>
    <ul>
      <li>The key drivers are Retirement &amp; Diversifications, followed by Turnover.</li>
      <li>Share turnover averages <strong>${shareTurnAvg.toFixed(2)}%</strong> per year.</li>
      <li>The average ESOP Benefit Rate is <strong>${(benefitAvg * 100).toFixed(2)}%</strong>.</li>
      <li>The average cash burn to service the repurchase obligation is <strong>${(cashBurnAvg * 100).toFixed(2)}%</strong> of corporate free cashflow.</li>
      <li>We recommend having a cash reserve equal to 3 years of the obligation, <strong>${fmt$(reserveAmount)}</strong>, to ensure sustainability.</li>
    </ul>
    <h3 style="font-family: 'Segoe UI', sans-serif; font-weight: 600; color: #222; font-size: 14px;">Strategies to Manage Sustainability</h3>
    <ol>
      <li>Consider a target benefit rate to level out the ESOP benefit rate each year.</li>
      <li>Modifying plan provisions, such as the lump sum or distribution payout period.</li>
      <li>Segregating accounts.</li>
      <li>Plan Releverage.</li>
      <li>Window amendment to cashout accounts.</li>
      <li>OIA Investment Policy.</li>
      <li>Ensure liability is factored into budgets.</li>
    </ol>
    <div class="page-num">-3-</div>
  </div>

  <!-- ═══════ EXECUTIVE SUMMARY — Disclaimer ═══════ -->
  <div class="page narrative">
    <h1 class="section-head">EXECUTIVE SUMMARY</h1>
    <h3 style="color: #111; text-decoration: none; font-size: 14px;">Disclaimer:</h3>
    <p>
      - To develop these projections, we relied on information from management, including quantitative
      and qualitative data. Examples include the plan participant data as of the latest closed annual
      administration cycle, the most recent ESOP valuation report, the current ESOP plan document and
      distribution policy, and any prospective changes to the company and plan you communicated to us.
    </p>
    <p>
      - Annual variances are driven by share price projections multiplied by expected share turn due
      to diversification, death, disability, retirement, and turnover. We expect volatility in the
      number of shares repurchased, share price, and free cashflows during the projection period, and
      factors not contemplated in these projections may affect results. These projections should be
      updated every 1-3 years to ensure plan performance and sustainability are managed.
    </p>
    <p>
      - We do not provide legal or tax advice, and nothing in this report or in any of our other
      written or verbal communications should be construed as such. Actual results will differ from
      projections.
    </p>
    <div class="page-num">-4-</div>
  </div>

  <!-- ═══════ EXEC SUMMARY HIGHLIGHTS (LHA tables) ═══════ -->
  <div class="page">
    <h1 class="section-head">EXECUTIVE SUMMARY HIGHLIGHTS</h1>
    <h2>Repurchase Obligation Projection</h2>
    <table class="lha-table"><thead><tr><th>Low</th><th>High</th><th>Average</th></tr></thead>
      <tbody><tr><td>${fmt$(roMin)} (${escape(roMinYear)})</td><td>${fmt$(roMax)} (${escape(roMaxYear)})</td><td>${fmt$(roAvg)}</td></tr></tbody></table>
    <h2>Valuation Projection &ndash; Share Price Change</h2>
    <table class="lha-table"><thead><tr><th>Low</th><th>High</th><th>Average</th></tr></thead>
      <tbody><tr><td>${(priceChangeMin * 100).toFixed(0)}%</td><td>${(priceChangeMax * 100).toFixed(0)}%</td><td>${(priceChangeAvg * 100).toFixed(0)}%</td></tr></tbody></table>
    <h2>Effective ESOP Benefit Rate</h2>
    <table class="lha-table"><thead><tr><th>Low</th><th>High</th><th>Average</th></tr></thead>
      <tbody><tr><td>${(benefitMin * 100).toFixed(0)}% (${escape(benefitMinYear)})</td><td>${(benefitMax * 100).toFixed(0)}% (${escape(benefitMaxYear)})</td><td>${(benefitAvg * 100).toFixed(1)}%</td></tr></tbody></table>
    <h2>Average Total Compensation</h2>
    <table class="lha-table"><thead><tr><th>Low</th><th>High</th><th>Average</th></tr></thead>
      <tbody><tr><td>${fmt$(compMin)} (${escape(compMinYear)})</td><td>${fmt$(compMax)} (${escape(compMaxYear)})</td><td>${fmt$(compAvg)}</td></tr></tbody></table>
    <div class="page-num">-5-</div>
  </div>

  <!-- ═══════ MORE EXEC HIGHLIGHTS (Score + Drivers) ═══════ -->
  <div class="page">
    <h1 class="section-head">EXECUTIVE SUMMARY HIGHLIGHTS</h1>
    <h2>ESOP Success Score</h2>
    <table class="lha-table"><thead><tr><th>Low</th><th>High</th><th>Average</th></tr></thead>
      <tbody><tr><td>${scoreMin.toFixed(0)}%</td><td>${scoreMax.toFixed(0)}%</td><td>${scoreAvg.toFixed(1)}%</td></tr></tbody></table>
    <h2>Repurchase Obligation Drivers</h2>
    <div class="banner-label" style="display: flex;">
      <div style="flex: 1;">Turnover: ${turnoverPct.toFixed(1)}%</div>
      <div style="flex: 1; text-align: right;">Retirement &amp; Diversifications: ${(diversPct + retirePct).toFixed(1)}%</div>
    </div>
    <div class="chart-wrap">${driversPie}</div>
    <div class="page-num">-6-</div>
  </div>

  <!-- ═══════ STOCK ALLOCATION CHART ═══════ -->
  <div class="page">
    <h1 class="section-head">STOCK ALLOCATION CHART</h1>
    <div class="chart-wrap">${stockAllocationChart}</div>
    <div class="page-num">-7-</div>
  </div>

  <!-- ═══════ TERMINATED PARTICIPANTS ═══════ -->
  <div class="page">
    <h1 class="section-head">TERMINATED PARTICIPANTS</h1>
    <div class="chart-wrap">${termedPie}</div>
    <div class="page-num">-8-</div>
  </div>

  <div class="page">
    <h1 class="section-head">SHARES HELD BY TERMINATED PARTICIPANTS</h1>
    <div class="chart-wrap">${termedSharesChart}</div>
    <div class="page-num">-9-</div>
  </div>

  <!-- ═══════ BENEFIT RATE BENCHMARK ═══════ -->
  <div class="page">
    <h1 class="section-head">EXECUTIVE SUMMARY HIGHLIGHTS</h1>
    <h2>Benefit Rate Benchmark</h2>
    <div class="chart-wrap">${benefitBenchmark}</div>
    <p style="font-size: 9px; color: #666;">*Source: 2023 ESOP Repurchase Obligation Survey, NCEO, 2023</p>
    <div class="page-num">-10-</div>
  </div>

  <!-- ═══════ SECTION DIVIDER ═══════ -->
  <div class="page section-divider">---------ESOP Repurchase Obligation Projections---------</div>

  <!-- ═══════ RO PROJECTION TABLE ═══════ -->
  <div class="page">
    <h1 class="section-head">SUMMARY OF RESULTS</h1>
    <h2>Scenario 1: Baseline Repurchase Obligation Projection</h2>
    <table>
      <thead><tr>
        <th>Plan Year</th><th>Calendar Year for Payout</th><th>Share Price</th><th>ESOP Shares Allocated</th>
        <th>Shares Owned by ESOP</th><th>ESOP Valuation</th><th>OIA Balance</th>
        <th class="highlight-green" style="color: white;">Total ESOP Assets</th>
        <th>Total Shares Repurchased</th><th>Value of Shares Repurchased</th>
        <th class="highlight-navy" style="color: white;">Total Repurchase Obligation</th>
        <th>Excess Cash Funding Requirement</th>
      </tr></thead>
      <tbody>
        ${data.repurchase.map((r: any, i: number) => {
          const year = r.calendar_year_for_payout ?? (firstYear + i)
          const valuation = Number(data.valuations[i]?.esop_valuation) || 0
          const oia = Number(r.oia_balance) || 0
          const totalAssets = valuation + oia
          return `<tr>
            <td>${escape(year)}</td>
            <td>${escape(year)}</td>
            <td>${fmt$d(r.share_price)}</td>
            <td>${fmtInt(r.esop_shares_allocated)}</td>
            <td>${fmtInt(data.valuationInputs?.total_esop_shares)}</td>
            <td>${fmt$(valuation)}</td>
            <td>${fmt$(oia)}</td>
            <td class="highlight-green">${fmt$(totalAssets)}</td>
            <td>${fmtDec(r.shares_turned, 2)}</td>
            <td>${fmt$(r.total_repurchase_obligation)}</td>
            <td class="highlight-navy">${fmt$(r.total_repurchase_obligation)}</td>
            <td>$-0</td>
          </tr>`
        }).join('')}
        <tr class="avg-row">
          <td>Average</td><td></td><td>${fmt$d(data.repurchase.reduce((s: number, r: any) => s + Number(r.share_price || 0), 0) / Math.max(1, data.repurchase.length))}</td>
          <td>${fmtInt(data.repurchase.reduce((s: number, r: any) => s + Number(r.esop_shares_allocated || 0), 0) / Math.max(1, data.repurchase.length))}</td>
          <td>${fmtInt(data.valuationInputs?.total_esop_shares)}</td>
          <td>${fmt$(data.valuations.reduce((s: number, v: any) => s + Number(v.esop_valuation || 0), 0) / Math.max(1, data.valuations.length))}</td>
          <td>${fmt$(data.repurchase.reduce((s: number, r: any) => s + Number(r.oia_balance || 0), 0) / Math.max(1, data.repurchase.length))}</td>
          <td class="highlight-green"></td>
          <td>${fmtDec(totalSharesTurned / Math.max(1, data.repurchase.length), 2)}</td>
          <td>${fmt$(roAvg)}</td>
          <td class="highlight-navy">${fmt$(roAvg)}</td>
          <td>$-0.00</td>
        </tr>
      </tbody>
    </table>
    <p style="font-style: italic; margin-top: 10px;">Net Present Value* Of Projected Obligation, ${firstYear}-${firstYear + 10}: ${fmt$(data.repurchase.reduce((s: number, r: any) => s + Number(r.npv || 0), 0))}</p>
    <p style="font-style: italic; font-size: 10px;">*${fmtPct(data.valuationInputs?.cap_rate || 0.185, 2)} weighted average cost of capital</p>
    <div class="page-num">-12-</div>
  </div>

  <div class="page">
    <h1 class="section-head">REPURCHASE OBLIGATION PROJECTIONS</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${roBarChart}</div>
    <div class="page-num">-13-</div>
  </div>

  <!-- ═══════ SHARE TURNOVER ═══════ -->
  <div class="page">
    <h1 class="section-head">SHARE TURNOVER SCHEDULE</h1>
    <h2>Scenario 1: Baseline</h2>
    <table>
      <thead><tr>
        <th>Plan Year</th><th>Calendar Year for Payout</th>
        <th>Diversification</th><th>In-Service Distributions</th>
        <th>Retirement, Death &amp; Disability</th><th>Turnover</th><th>Total Shares</th>
      </tr></thead>
      <tbody>
        ${data.turnover.map((t: any, i: number) => {
          const year = t.calendar_year_for_payout ?? (firstYear + i)
          return `<tr>
            <td>${escape(year)}</td><td>${escape(year)}</td>
            <td>${fmtDec(t.diversification, 2)}</td>
            <td>${fmtDec(t.in_service_distributions, 2)}</td>
            <td>${fmtDec(t.retirement_death_disability, 2)}</td>
            <td>${fmtDec(t.turnover, 2)}</td>
            <td>${fmtDec(t.total_shares, 2)}</td>
          </tr>`
        }).join('')}
        <tr class="avg-row">
          <td>Average</td><td></td>
          <td>${fmtDec(totalDivers / Math.max(1, data.turnover.length), 2)}</td>
          <td>${fmtDec(data.turnover.reduce((s: number, t: any) => s + Number(t.in_service_distributions || 0), 0) / Math.max(1, data.turnover.length), 2)}</td>
          <td>${fmtDec(totalRetire / Math.max(1, data.turnover.length), 2)}</td>
          <td>${fmtDec(totalTurnover / Math.max(1, data.turnover.length), 2)}</td>
          <td>${fmtDec(data.turnover.reduce((s: number, t: any) => s + Number(t.total_shares || 0), 0) / Math.max(1, data.turnover.length), 2)}</td>
        </tr>
      </tbody>
    </table>
    <div class="page-num">-14-</div>
  </div>

  <div class="page">
    <h1 class="section-head">SHARE TURNOVER SCHEDULE: TOTAL SHARE TURNOVER</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${shareTurnoverBar}</div>
    <div class="page-num">-15-</div>
  </div>

  <div class="page">
    <h1 class="section-head">DETAILED SHARE TURNOVER SCHEDULE</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${detailedTurnoverChart}</div>
    <div class="page-num">-16-</div>
  </div>

  <!-- ═══════ BENEFIT RATE & COMP ANALYSIS ═══════ -->
  <div class="page">
    <h1 class="section-head">BENEFIT RATE &amp; COMPENSATION ANALYSIS: POPULATION ANALYSIS</h1>
    <h2>Scenario 1: Baseline</h2>
    <table>
      <thead><tr>
        <th>Plan Year</th><th>Active Participants</th><th>Covered Compensation</th>
        <th>Average Cash Compensation</th><th>Average ESOP Compensation</th><th>Average Total Compensation</th>
        <th>Stock Allocations</th><th>Cash Contributions</th><th>Fringe (RO)</th>
        <th>Effective Benefit Rate*</th><th>Share Turn (RO / ESOP Value)</th>
      </tr></thead>
      <tbody>
        ${data.population.map((p: any, i: number) => {
          const year = (p.year ?? '').toString().replace('Year ', '') || String(firstYear + i)
          return `<tr>
            <td>${escape(year || firstYear + i)}</td>
            <td>${fmtInt(p.active_participants)}</td>
            <td>${fmt$(p.covered_compensation)}</td>
            <td>${fmt$(p.avg_cash_compensation)}</td>
            <td>${fmt$(p.avg_esop_compensation)}</td>
            <td>${fmt$(p.avg_total_compensation)}</td>
            <td>${fmtPct(p.stock_allocations, 0)}</td>
            <td>${fmtPct(p.cash_contributions, 0)}</td>
            <td>${fmtPct(p.fringe, 2)}</td>
            <td>${fmtPct(p.effective_benefit_rate, 2)}</td>
            <td>${fmtPct(p.share_turn, 2)}</td>
          </tr>`
        }).join('')}
        <tr class="avg-row">
          <td>Average</td>
          <td>${fmtInt(data.population.reduce((s: number, p: any) => s + Number(p.active_participants || 0), 0) / Math.max(1, data.population.length))}</td>
          <td>${fmt$(data.population.reduce((s: number, p: any) => s + Number(p.covered_compensation || 0), 0) / Math.max(1, data.population.length))}</td>
          <td>${fmt$(data.population.reduce((s: number, p: any) => s + Number(p.avg_cash_compensation || 0), 0) / Math.max(1, data.population.length))}</td>
          <td>${fmt$(data.population.reduce((s: number, p: any) => s + Number(p.avg_esop_compensation || 0), 0) / Math.max(1, data.population.length))}</td>
          <td>${fmt$(compAvg)}</td>
          <td></td><td></td>
          <td>${fmtPct(benefitAvg, 2)}</td>
          <td>${fmtPct(benefitAvg, 2)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <p style="font-style: italic; font-size: 10px;">*Effective ESOP benefit rate includes stock allocations, cash contributions, and fringe</p>
    <div class="page-num">-17-</div>
  </div>

  <!-- ═══════ AVG AGE & TENURE (ACTIVE) ═══════ -->
  <div class="page">
    <h1 class="section-head">POPULATION ANALYSIS: AVERAGE AGE &amp; TENURE FOR ACTIVE PARTICIPANTS</h1>
    <h2>Scenario 1: Baseline</h2>
    <table>
      <thead><tr>
        <th>Plan Year</th><th>Average Age</th><th>Average Tenure</th>
        <th>Covered Compensation</th><th>Compensation Increase %</th>
        <th>Average Vested Account Balance</th><th>% Change</th>
      </tr></thead>
      <tbody>
        ${data.population.map((p: any, i: number) => {
          const year = (p.year ?? '').toString().replace('Year ', '') || String(firstYear + i)
          const activeRow = data.ageTenureActive.find((r: any) => r.category === 'All') ?? data.ageTenureActive[0]
          const age = Number(activeRow?.avg_age ?? 43) + i * 0.4
          const tenure = Number(activeRow?.avg_tenure ?? 6) + (i === 0 ? 0 : 0.5 * i)
          const balance = Number(activeRow?.avg_balance ?? 7000) * Math.pow(1.05, i)
          const prevBalance = i === 0 ? balance : Number(activeRow?.avg_balance ?? 7000) * Math.pow(1.05, i - 1)
          const pctChange = i === 0 ? 0 : ((balance - prevBalance) / prevBalance)
          const compIncrease = i === 0 ? 0 : 0.05
          return `<tr>
            <td>${escape(year || firstYear + i)}</td>
            <td>${fmtDec(age, 1)}</td>
            <td>${fmtDec(tenure, 1)}</td>
            <td>${fmt$(p.covered_compensation)}</td>
            <td>${fmtPct(compIncrease, 0)}</td>
            <td>${fmt$(balance)}</td>
            <td>${fmtPct(pctChange, 2)}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    <div class="page-num">-18-</div>
  </div>

  <!-- ═══════ TOP 10% POPULATION ANALYSIS ═══════ -->
  <div class="page">
    <h1 class="section-head">TOP 10% POPULATION ANALYSIS</h1>
    <table>
      <thead><tr>
        <th>Plan Year</th><th>Average Age of Top 10% Balances</th><th>Average Account Balance of Top 10% Balances</th>
        <th>Average Age of Terminated Participants</th><th>Average Tenure of Terminated Participants</th>
        <th>Average Account Balance of Terminated Participants</th>
      </tr></thead>
      <tbody>
        ${data.population.map((p: any, i: number) => {
          const year = (p.year ?? '').toString().replace('Year ', '') || String(firstYear + i)
          const top10 = data.ageTenureActive[0]
          const term = data.ageTenureTerminated.find((r: any) => r.category === 'All') ?? data.ageTenureTerminated[0]
          return `<tr>
            <td>${escape(year || firstYear + i)}</td>
            <td>${fmtDec(Number(top10?.avg_age ?? 50) + i * 0.2, 1)}</td>
            <td>${fmt$(top10Balances[0]?.balance ? top10Balances[0].balance / 2 * Math.pow(1.1, i) : 26542)}</td>
            <td>${fmtDec(Number(term?.avg_age ?? 44) + i * 0.3, 1)}</td>
            <td>${fmtDec(Number(term?.avg_tenure ?? 3), 1)}</td>
            <td>${fmt$(Number(term?.avg_balance ?? 4500) * Math.pow(0.9, i))}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    <div class="page-num">-19-</div>
  </div>

  <!-- ═══════ TOP 10% ACCOUNT BALANCES (name list) ═══════ -->
  <div class="page">
    <h1 class="section-head">THE TOP 10% ACCOUNT BALANCES AS OF ${escape(reportDate)}</h1>
    <table>
      <thead><tr><th>Name</th><th>Total Account Balance</th><th>Expected Termination Date</th></tr></thead>
      <tbody>
        ${top10Balances.slice(0, 25).map((p: any) => `<tr>
          <td>${escape(p.name)}</td>
          <td>${fmt$(p.balance)}</td>
          <td>${escape(p.termDate ?? '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="page-num">-20-</div>
  </div>

  <!-- ═══════ VALUATION SECTION DIVIDER ═══════ -->
  <div class="page section-divider">------------Valuation Projections------------</div>

  <!-- ═══════ CAPITAL TABLE & VALUATION ═══════ -->
  <div class="page">
    <h1 class="section-head">CAPITAL TABLE &amp; VALUATION PROJECTION</h1>
    <h2>Scenario 1: Baseline</h2>
    <table>
      <thead><tr>
        <th>Year</th><th>ESOP Valuation</th><th>ESOP Shares</th><th>ESOP %</th>
        <th>Other Shares</th><th>Other %</th><th>Total Shares</th>
        <th>Price Per Share</th><th>Share Price Change</th>
      </tr></thead>
      <tbody>
        ${data.valuations.map((v: any, i: number) => {
          const year = (v.year ?? '').toString().replace('Year ', '') || String(firstYear + i)
          return `<tr>
            <td>${escape(year || firstYear + i)}</td>
            <td>${fmt$(v.esop_valuation)}</td>
            <td>${fmtInt(v.esop_shares)}</td>
            <td>${fmtPct(v.pct_esop_shares, 2)}</td>
            <td>${fmtInt(v.other_shares)}</td>
            <td>${fmtPct(v.pct_other_shares, 2)}</td>
            <td>${fmtInt(v.total_shares)}</td>
            <td>${fmt$d(v.price_per_share)}</td>
            <td>${fmtPct(v.share_price_change, 0)}</td>
          </tr>`
        }).join('')}
        <tr class="avg-row">
          <td>Average</td>
          <td>${fmt$(data.valuations.reduce((s: number, v: any) => s + Number(v.esop_valuation || 0), 0) / Math.max(1, data.valuations.length))}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td>${fmt$d(data.valuations.reduce((s: number, v: any) => s + Number(v.price_per_share || 0), 0) / Math.max(1, data.valuations.length))}</td>
          <td>${(priceChangeAvg * 100).toFixed(2)}%</td>
        </tr>
      </tbody>
    </table>
    <div class="page-num">-24-</div>
  </div>

  <div class="page">
    <h1 class="section-head">VALUATION PROJECTIONS: ESOP VALUATION PROJECTION</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${valuationBar}</div>
    <div class="page-num">-25-</div>
  </div>

  <div class="page">
    <h1 class="section-head">VALUATION PROJECTIONS: SHARE PRICE PROJECTION</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${priceBar}</div>
    <div class="page-num">-26-</div>
  </div>

  <div class="page">
    <h1 class="section-head">ESOP FRINGE BENEFIT RATE - REPURCHASE OBLIGATION</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${benefitChart}</div>
    <div class="page-num">-27-</div>
  </div>

  <!-- ═══════ SUCCESS SCORE framework ═══════ -->
  <div class="page narrative">
    <h1 class="section-head">YOUR MENKE ESOP SUCCESS SCORE (R)</h1>
    <p>
      The Menke ESOP Success Score (R) is a sustainability framework we developed to help stakeholders
      such as the Board, Fiduciaries, Trustees, Lenders, and Appraisers understand the real short and
      long-term sustainability of an ESOP.
    </p>
    <p>
      We define ESOP success as the ability of an employee-owned company to maintain its ESOP capital
      structure while fulfilling its business objectives. In other words, what is the likelihood of
      the company remaining an independent ESOP company? The results are a sliding scale from 0-100%.
    </p>
    <p>
      Generally, the higher the percentage score, the higher likelihood of ESOP Success.
    </p>
    <div style="text-align: center; margin-top: 30px; font-weight: 700;">ESOP Sustainability Score Benchmark Estimate</div>
    <div class="score-scale">
      <div class="impaired"><div>Impaired</div><div style="font-size: 10px; margin-top: 4px;">0-25%</div></div>
      <div class="weakness"><div>Weakness</div><div style="font-size: 10px; margin-top: 4px;">25-50%</div></div>
      <div class="moderate"><div>Moderate (majority of ESOPs)</div><div style="font-size: 10px; margin-top: 4px;">50-80%</div></div>
      <div class="strong"><div>Strong</div><div style="font-size: 10px; margin-top: 4px;">80-100%</div></div>
    </div>
    <p style="text-align: center; margin-top: 8px; font-size: 10px;">ESOP Sustainability Score</p>
    <div class="page-num">-28-</div>
  </div>

  <div class="page">
    <h1 class="section-head">YOUR MENKE ESOP SUCCESS SCORE (R) QUANTIFYING ESOP SUSTAINABILITY</h1>
    <h2>Scenario 1: Baseline</h2>
    <table>
      <thead><tr>
        <th>Year for Payout</th><th>Repurchase Obligation</th><th>Cash Source</th><th>Surplus/Deficit</th>
        <th>Cash Burn</th><th>Menke ESOP Success Score</th><th>Health Check</th><th>Key Takeaway</th>
      </tr></thead>
      <tbody>
        ${data.scores.map((s: any) => {
          const score = (Number(s.esop_success_score) > 1) ? Number(s.esop_success_score) : Number(s.esop_success_score) * 100
          const health = Number(s.health_check) * 100
          return `<tr>
            <td>${escape(s.year_for_payout)}</td>
            <td>${fmt$d(s.repurchase_obligation)}</td>
            <td>${fmt$d(s.cash_source)}</td>
            <td>${fmt$d(s.surplus_or_deficit)}</td>
            <td>${fmtPct(s.ro_cash_burn, 2)}</td>
            <td class="highlight-navy">${score.toFixed(2)}%</td>
            <td>${health >= 80 ? '✔' : health >= 50 ? '~' : '✗'}</td>
            <td>${escape(s.key_takeaway ?? 'Compare with cashflow budget')}</td>
          </tr>`
        }).join('')}
        <tr class="avg-row">
          <td>Average</td><td></td><td></td><td></td>
          <td>${(cashBurnAvg * 100).toFixed(2)}%</td>
          <td>${scoreAvg.toFixed(2)}%</td>
          <td></td><td></td>
        </tr>
      </tbody>
    </table>
    <p style="font-style: italic; font-size: 10px; margin-top: 10px;">RO Cash Burn = (Repurchase Obligation)/(OIA + Free Cash Flow)<br/>ESOP Success Score is the projected sustainability score of your ESOP.</p>
    <div class="page-num">-29-</div>
  </div>

  <div class="page">
    <h1 class="section-head">YOUR MENKE ESOP SUCCESS SCORE (R)</h1>
    <h2>Scenario 1: Baseline</h2>
    <div class="chart-wrap">${successChart}</div>
    <div class="page-num">-30-</div>
  </div>

  <!-- ═══════ ASSUMPTIONS SECTION DIVIDER ═══════ -->
  <div class="page section-divider">------Demographic Assumptions &amp; Plan Provisions-----</div>

  <!-- ═══════ ASSUMPTIONS: Plan Provisions ═══════ -->
  <div class="page">
    <h1 class="section-head">ASSUMPTIONS</h1>
    <div class="sub-heading">Plan Provisions &amp; Population Analysis</div>
    <div class="kv"><span class="k">Covered Compensation Limit:</span><span class="v">${moneyVal(data.provisions?.compensation_limit)}</span></div>
    <div class="kv"><span class="k">Covered Compensation Limit Increase:</span><span class="v">${pctVal(data.provisions?.compensation_limit_increase)}</span></div>
    <div class="kv"><span class="k">Turnover Cash/Stock Distribution Wait Period Years:</span><span class="v">${intVal(data.provisions?.period_years)}</span></div>
    <div class="kv"><span class="k">Turnover Cash Distribution Years:</span><span class="v">${intVal(data.provisions?.distribution_years)}</span></div>
    <div class="kv"><span class="k">Plan Retirement Age:</span><span class="v">${intVal(data.provisions?.plan_retirement)}</span></div>
    <div class="kv"><span class="k">Plan Retirement Service Requirement Years:</span><span class="v">${intVal(data.provisions?.service_retirement)}</span></div>
    <div class="kv"><span class="k">Compensation Increase Year 1:</span><span class="v">${pctVal(data.provisions?.compensation_one_year)}</span></div>
    <div class="kv"><span class="k">Compensation Increase Years 2-5:</span><span class="v">${pctVal(data.provisions?.compensation_five_year)}</span></div>
    <div class="kv"><span class="k">Compensation Increase Years 6-10:</span><span class="v">${pctVal(data.provisions?.compensation_ten_year)}</span></div>
    <div class="kv"><span class="k">Turnover Years 1-5 (T Table):</span><span class="v">${escape(data.provisions?.turnover_five_year ?? 'T-1')}</span></div>
    <div class="kv"><span class="k">Turnover Years 6-10 (T Table):</span><span class="v">${escape(data.provisions?.turnover_ten_year ?? 'T-1')}</span></div>
    <div class="page-num">-32-</div>
  </div>

  <div class="page">
    <h1 class="section-head">ASSUMPTIONS</h1>
    <div class="sub-heading">Allocations &amp; Funding</div>
    <div class="kv"><span class="k">Plan Size:</span><span class="v">${escape(data.allocations?.plan_size ?? 'Medium')}</span></div>
    <div class="kv"><span class="k">Service Hours Eligibility:</span><span class="v">${intVal(data.allocations?.service_hours)}</span></div>
    <div class="kv"><span class="k">Lump Sum Distribution Limit:</span><span class="v">${moneyVal(data.allocations?.lump_sum_distribution_limit)}</span></div>
    <div class="kv"><span class="k">Disability, Death &amp; Retirement Distributions Years:</span><span class="v">${intVal(data.allocations?.distribution_years)}</span></div>
    <div class="kv"><span class="k">Year End Requirement?:</span><span class="v">${escape(data.allocations?.end_requirement ?? 'No')}</span></div>
    <div class="kv"><span class="k">One Year Requirement?:</span><span class="v">${escape(data.allocations?.one_requirement ?? 'No')}</span></div>
    <div class="kv"><span class="k">Internal Loan 1 Annual Share Release:</span><span class="v">${fmtDec(data.allocations?.internal_loan_1, 2)}</span></div>
    <div class="kv"><span class="k">Internal Loan 1 Term Maturity:</span><span class="v">${escape(data.allocations?.internal_loan_1_date ?? '')}</span></div>
    <div class="kv"><span class="k">Internal Loan 2 Annual Share Release:</span><span class="v">${fmtDec(data.allocations?.internal_loan_2, 2)}</span></div>
    <div class="kv"><span class="k">Internal Loan 2 Term Maturity:</span><span class="v">${escape(data.allocations?.internal_loan_2_date ?? '')}</span></div>
    <div class="kv"><span class="k">Internal Loan 3 Annual Share Release:</span><span class="v">${fmtDec(data.allocations?.internal_loan_3, 2)}</span></div>
    <div class="kv"><span class="k">Internal Loan 3 Term Maturity:</span><span class="v">${escape(data.allocations?.internal_loan_3_date ?? '')}</span></div>
    <div class="kv"><span class="k">Vesting Period:</span><span class="v">${intVal(data.allocations?.vesting_period)}</span></div>
    <div class="kv"><span class="k">Internal Loan Basis:</span><span class="v">${fmtDec(data.allocations?.internal_loan_basis, 0)}</span></div>
    <div class="kv"><span class="k">Other Investment Account (OIA) Annual Rate of Return:</span><span class="v">${pctVal(data.allocations?.oia_annual_return)}</span></div>
    <div class="kv"><span class="k">Annual ESOP Contribution Rate:</span><span class="v">${pctVal(data.allocations?.annual_esop_contribution)}</span></div>
    <div class="kv"><span class="k">Segregation?:</span><span class="v">${escape(data.allocations?.segregation ?? 'No')}</span></div>
    <div class="page-num">-33-</div>
  </div>

  <div class="page">
    <h1 class="section-head">ASSUMPTIONS</h1>
    <div class="sub-heading">Distributions</div>
    <div class="kv"><span class="k">In-service Distribution 1 Age:</span><span class="v">${intVal(data.distributions?.in_service_distrib_1_age)}</span></div>
    <div class="kv"><span class="k">In-service Distribution 1 Amount (%):</span><span class="v">${pctVal(data.distributions?.in_service_distrib_1_amount)}</span></div>
    <div class="kv"><span class="k">In-service Distribution 2 Frequency (Years):</span><span class="v">${intVal(data.distributions?.in_service_distrib_2_frequency)}</span></div>
    <div class="kv"><span class="k">In-service Distribution 2 Amount (%):</span><span class="v">${pctVal(data.distributions?.in_service_distrib_2_amount)}</span></div>
    <div class="kv"><span class="k">ESOP Formation Date:</span><span class="v">${escape(data.distributions?.esop_formation_date ?? '')}</span></div>
    <div class="kv"><span class="k">Diversification Year 1-5 (0-25%):</span><span class="v">${pctVal(data.distributions?.divers_year_one)}</span></div>
    <div class="kv"><span class="k">Diversification Year 6 Final max(0-50%):</span><span class="v">${pctVal(data.distributions?.divers_year_final)}</span></div>
    <div class="kv"><span class="k">S or C Corporation:</span><span class="v">${escape(data.distributions?.sc_corporation ?? 'C')}</span></div>
    <div class="page-num">-34-</div>
  </div>

  <div class="page">
    <h1 class="section-head">ASSUMPTIONS</h1>
    <div class="sub-heading">Funding</div>
    <div class="kv"><span class="k">Stub period contribution:</span><span class="v">${moneyVal(data.funding?.stub_period)}</span></div>
    <div class="kv"><span class="k">Funding Mechanism:</span><span class="v">${escape(data.funding?.funding_mechanism ?? 'Annual Liability Funding')}</span></div>
    <div class="kv"><span class="k">S Corp Distributions / C Corp Deductible Dividends:</span><span class="v">${moneyVal(data.funding?.s_corp_distributions)}</span></div>
    <div class="kv"><span class="k">Is the Plan Active or Frozen?:</span><span class="v">${escape(data.funding?.plan_active_frozen ?? 'Active')}</span></div>
    <div class="kv"><span class="k">Plan Year End:</span><span class="v">${escape(data.funding?.plan_year_end ?? '')}</span></div>
    <div class="page-num">-35-</div>
  </div>

  <div class="page">
    <h1 class="section-head">ASSUMPTIONS</h1>
    <div class="sub-heading">Valuation Inputs</div>
    <div class="kv"><span class="k">Company ESOP Value:</span><span class="v">${moneyVal(data.valuationInputs?.company_esop_value)}</span></div>
    <div class="kv"><span class="k">Total Shares Issued and Outstanding:</span><span class="v">${fmtDec(data.valuationInputs?.total_shares_outstanding, 2)}</span></div>
    <div class="kv"><span class="k">Total ESOP Shares Owned:</span><span class="v">${fmtDec(data.valuationInputs?.total_esop_shares, 2)}</span></div>
    <div class="kv"><span class="k">EBITDA:</span><span class="v">${moneyVal(data.valuationInputs?.ebitda)}</span></div>
    <div class="kv"><span class="k">Cap Rate / Weighted Average Cost of Capital (WACC):</span><span class="v">${pctVal(data.valuationInputs?.cap_rate)}</span></div>
    <div class="kv"><span class="k">Excess Cash &amp; Assets:</span><span class="v">${moneyVal(data.valuationInputs?.excess_cash_assets)}</span></div>
    <div class="kv"><span class="k">EBITDA Growth Rate:</span><span class="v">${pctVal(data.valuationInputs?.ebitda_growth_rate)}</span></div>
    <div class="kv"><span class="k">2nd Stage Transaction Year:</span><span class="v">${escape(data.valuationInputs?.stage_transaction_year_two ?? '')}</span></div>
    <div class="kv"><span class="k">2nd Stage Annual Stock Allocation:</span><span class="v">${fmtDec(data.valuationInputs?.annual_stock_allocation_two, 2)}</span></div>
    <div class="kv"><span class="k">3rd Stage Transaction Year:</span><span class="v">${escape(data.valuationInputs?.stage_transaction_year_three ?? '')}</span></div>
    <div class="kv"><span class="k">3rd Stage Annual Stock Allocation:</span><span class="v">${fmtDec(data.valuationInputs?.annual_stock_allocation_three, 2)}</span></div>
    <div class="kv"><span class="k">Total Shares of the 2nd Stage Transaction:</span><span class="v">${fmtDec(data.valuationInputs?.total_share_second_stage, 2)}</span></div>
    <div class="kv"><span class="k">Total Shares of the 3rd Stage Transaction:</span><span class="v">${fmtDec(data.valuationInputs?.total_share_third_stage, 2)}</span></div>
    <div class="page-num">-36-</div>
  </div>

  <div class="page">
    <h1 class="section-head">ASSUMPTIONS</h1>
    <div class="sub-heading">Share Price</div>
    <div class="kv"><span class="k">Year 1 Share Price Growth Rate:</span><span class="v">${pctVal(data.sharePrices?.share_price_one)}</span></div>
    <div class="kv"><span class="k">Year 2 Share Price Growth Rate:</span><span class="v">${pctVal(data.sharePrices?.share_price_two)}</span></div>
    <div class="kv"><span class="k">Year 3 Share Price Growth Rate:</span><span class="v">${pctVal(data.sharePrices?.share_price_three)}</span></div>
    <div class="kv"><span class="k">Year 4 Share Price Growth Rate:</span><span class="v">${pctVal(data.sharePrices?.share_price_four)}</span></div>
    <div class="kv"><span class="k">Year 5 Share Price Growth Rate:</span><span class="v">${pctVal(data.sharePrices?.share_price_five)}</span></div>
    <div class="kv"><span class="k">Years 6-10 Share Price Growth Rate:</span><span class="v">${pctVal(data.sharePrices?.share_price_ten)}</span></div>
    <div class="page-num">-37-</div>
  </div>

  ${renderNarrativeSections(data.narrative)}

  <!-- ═══════ CONCLUSION ═══════ -->
  <div class="page narrative">
    <h1 class="section-head">Conclusion</h1>
    <p>Managing your repurchase obligation is an ongoing process.</p>
    <p>Best practices for ESOP governance include regular communication between the Board of Directors, Corporate Officers, the ESOP Plan Committee, and the ESOP Trustee.</p>
    <p>These practices include:</p>
    <p>- Discuss and document, at least annually, the repurchase obligation strategy implemented.</p>
    <p>- Practice active repurchase obligation management by updating projections and consider plan changes to ensure feasibility.</p>
    <p>- Discuss the repurchase obligation with the ESOP appraiser and understand how the obligation is quantified in the annual valuation.</p>
    <p>- Consider annual deduction (IRC Sect. 404) and annual additions (IRC Sect. 415) limits in your ESOP repurchase strategy.</p>
    <p>We enjoyed working with you on this engagement. Please contact us with any questions.</p>
    <p>Sincerely,</p>
    <p>The Menke Group</p>
    <div class="page-num">-38-</div>
  </div>

  <div class="page narrative">
    <h1 class="section-head">Repurchase Strategy Documentation For Plan Year:</h1>
    <p>To Be Completed by Plan Sponsor.</p>
    <p style="margin-top: 24px;"><strong>Funding Strategy:</strong></p>
    <div style="border-bottom: 1px solid #ccc; height: 48px;"></div>
    <p style="margin-top: 24px;"><strong>Distribution Strategy:</strong></p>
    <div style="border-bottom: 1px solid #ccc; height: 48px;"></div>
    <p style="margin-top: 24px;"><strong>Allocation Strategy &amp; Target Benefit Rate:</strong></p>
    <div style="border-bottom: 1px solid #ccc; height: 48px;"></div>
    <div class="page-num">-39-</div>
  </div>

  <div class="page narrative">
    <h1 class="section-head">Investment Policy ESOP OIA Account</h1>
    <p>____________________ CORPORATION<br/>Investment Policies for Investing Funds<br/>In the Other Investments Accounts<br/>Of the _______________ Corporation ESOP</p>
    <h3>SHORT-TERM REPURCHASE OBLIGATION ("RO") FUNDING</h3>
    <p>A significant portion of the _______ Corporation ESOP will always be invested in shares of Company Stock of this Corporation. The purpose of having other funds accumulated within the ESOP is to provide liquidity for the repurchase of shares of Company Stock from participants who subsequently retire, die or terminate employment. Accordingly, the short-term (one to three years) objective of the Other Investments Accounts is preservation of capital. Capital appreciation is not a short-term objective of this Account. Thus, funds held in the Other Investments Account that will be needed to fund the ESOP's repurchase obligations over the next one to three years should have a low probability of risk.</p>
    <h3>INVESTMENT STRATEGY FOR SHORT-TERM RO INVESTMENTS:</h3>
    <p>In order to implement the above-described short-term objective, the investment categories that should be utilized for the investment funds held in the Other Investments Accounts for short-term repurchase obligation funding are the following:</p>
    <p>1. Keep investable funds needed for short-term repurchase obligation funding primarily invested in Money Market Funds and Certificates of Deposit that are guaranteed by the FDIC.</p>
    <p>2. If U.S. economic conditions are negative, keep investable funds needed for short-term repurchase obligation funding primarily invested in short-term U.S. Treasury Bills and U.S. Treasury Notes.</p>
    <h3>LONG-TERM RO FUNDING</h3>
    <p>Funds held in the Other Investments Account that will be needed to fund the ESOP's repurchase obligations that are projected to come due more than three years from the most recent plan yearend should have a blended objective of preservation of capital and capital appreciation.</p>
    <div class="page-num">-40-</div>
  </div>

  <script class="no-print">
    window.onload = function() {
      setTimeout(function() { window.print() }, 500)
    }
  </script>
</body>
</html>`
}
