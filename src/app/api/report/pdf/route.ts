import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CHART_COLORS } from '@/lib/chart-colors'
import {
  renderLineChart, renderBarChart, renderPieChart, renderStackedBarChart,
  CHART_BRAND,
} from '@/lib/report/svg-charts'

/** Brand colors for the standalone HTML report (mirrors globals.css) */
const BRAND = {
  navy: CHART_COLORS.navy,
  navyLight: '#2C3E6B',
  blue: CHART_COLORS.blue,
  gold: '#D4A843',
} as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      title, subtitle, reportDate, executiveSummary,
      // Optional narrative overrides
      planStage, fundingApproach, contributionSource,
    } = body as Record<string, string | undefined>

    const [profile, valuations, repurchase, turnover, population, scores, ageTenureActive, settings] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('valuation_projections').select('*').eq('user_id', user.id).order('year'),
      supabase.from('repurchase_obligations').select('*').eq('user_id', user.id).order('year'),
      supabase.from('share_turnover_schedules').select('*').eq('user_id', user.id).order('year'),
      supabase.from('population_analyses').select('*').eq('user_id', user.id).order('year'),
      supabase.from('success_scores').select('*').eq('user_id', user.id).order('year_for_payout'),
      supabase.from('average_age_tenure_active').select('*').eq('user_id', user.id).order('year'),
      supabase.from('distributions').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    const html = buildReportHTML({
      title: title || profile.data?.company_name || 'ESOP Report',
      subtitle: subtitle || 'ESOP Sustainability Analysis',
      reportDate: reportDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      executiveSummary: executiveSummary || '',
      planStage: planStage || deriveStage(valuations.data ?? []),
      fundingApproach: fundingApproach || 'Redemption + recycling',
      contributionSource: contributionSource || 'Operating cash flow',
      valuations: valuations.data || [],
      repurchase: repurchase.data || [],
      turnover: turnover.data || [],
      population: population.data || [],
      scores: scores.data || [],
      ageTenureActive: ageTenureActive.data || [],
      esopFormationDate: settings.data?.esop_formation_date ?? null,
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

function deriveStage(valuations: Array<{ year?: string; esop_valuation?: number | null }>): string {
  if (!valuations || valuations.length < 2) return 'Early stage'
  const first = valuations[0]?.esop_valuation ?? 0
  const last = valuations[valuations.length - 1]?.esop_valuation ?? 0
  if (first > 0 && last / first > 1.5) return 'Growth stage'
  if (first > 10_000_000) return 'Mature / Late stage'
  return 'Mid stage'
}

function buildReportHTML(data: {
  title: string
  subtitle: string
  reportDate: string
  executiveSummary: string
  planStage: string
  fundingApproach: string
  contributionSource: string
  valuations: Record<string, unknown>[]
  repurchase: Record<string, unknown>[]
  turnover: Record<string, unknown>[]
  population: Record<string, unknown>[]
  scores: Record<string, unknown>[]
  ageTenureActive: Record<string, unknown>[]
  esopFormationDate: string | null
}): string {
  const {
    title, subtitle, reportDate, executiveSummary,
    planStage, fundingApproach, contributionSource,
    valuations, repurchase, turnover, population, scores, ageTenureActive,
  } = data

  const fmt = (n: number) => n?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '0'
  const fmtPct = (n: number) => `${((n || 0) * 100).toFixed(2)}%`
  const fmtDollar = (n: number) => `$${fmt(n)}`

  const roValues = repurchase.map((r) => (r.total_repurchase_obligation as number) || 0)
  const avgRO = roValues.length > 0 ? roValues.reduce((a, b) => a + b, 0) / roValues.length : 0
  const minRO = roValues.length > 0 ? Math.min(...roValues) : 0
  const maxRO = roValues.length > 0 ? Math.max(...roValues) : 0

  const firstScore = scores.length > 0 ? ((scores[0] as Record<string, unknown>).esop_success_score as number || 0) : 0

  // ─── Build charts ────────────────────────────────────────────
  const valuationChart = renderLineChart(
    valuations.map(v => ({ label: String(v.year ?? ''), value: (v.esop_valuation as number) || 0 })),
    { title: 'ESOP Valuation Projection', yFormat: 'dollar', color: CHART_BRAND.navy, width: 720, height: 260 }
  )
  const priceChart = renderLineChart(
    valuations.map(v => ({ label: String(v.year ?? ''), value: (v.price_per_share as number) || 0 })),
    { title: 'Share Price Trend', yFormat: 'dollar', color: CHART_BRAND.green, width: 720, height: 260 }
  )
  const purchaseChart = renderLineChart(
    repurchase.map(r => ({ label: String(r.year ?? ''), value: (r.total_repurchase_obligation as number) || 0 })),
    { title: 'Total Repurchase Obligation', yFormat: 'dollar', color: CHART_BRAND.red, width: 720, height: 260 }
  )
  const successChart = renderLineChart(
    scores.map(s => ({ label: String(s.year_for_payout ?? ''), value: (s.esop_success_score as number) || 0 })),
    { title: 'ESOP Success Score Over Time', yFormat: 'percent', color: CHART_BRAND.gold, width: 720, height: 260 }
  )
  const benefitChart = renderLineChart(
    population.map(p => ({ label: String(p.year ?? ''), value: (p.effective_benefit_rate as number) || 0 })),
    { title: 'Effective Benefit Rate', yFormat: 'percent', color: CHART_BRAND.blue, width: 720, height: 260 }
  )
  const pieData = repurchase.length > 0 ? [
    { label: 'Diversification', value: repurchase.reduce((s, r) => s + ((r.diversification as number) || 0), 0) },
    { label: 'Retirement/Death', value: repurchase.reduce((s, r) => s + ((r.retirement_death_disability as number) || 0), 0) },
    { label: 'Turnover', value: repurchase.reduce((s, r) => s + ((r.turnover as number) || 0), 0) },
    { label: 'In-Service', value: repurchase.reduce((s, r) => s + ((r.in_service_distributions as number) || 0), 0) },
  ] : []
  const pieChart = renderPieChart(pieData, { title: 'RO Breakdown by Driver', width: 420, height: 280 })

  const shareTurnoverChart = renderStackedBarChart(
    turnover.map(t => String(t.year ?? '')),
    [
      { name: 'Diversification', values: turnover.map(t => (t.diversification as number) || 0), color: CHART_BRAND.blue },
      { name: 'Retirement', values: turnover.map(t => (t.retirement_death_disability as number) || 0), color: CHART_BRAND.navy },
      { name: 'Turnover', values: turnover.map(t => (t.turnover as number) || 0), color: CHART_BRAND.orange },
      { name: 'In-Service', values: turnover.map(t => (t.in_service_distributions as number) || 0), color: CHART_BRAND.teal },
    ],
    { title: 'Share Turnover Schedule', width: 720, height: 280 }
  )

  const populationChart = renderBarChart(
    population.map(p => ({ label: String(p.year ?? ''), value: (p.active_participants as number) || 0 })),
    { title: 'Active Participants by Year', color: CHART_BRAND.purple, width: 720, height: 260 }
  )

  const healthLabel = firstScore >= 0.7 ? 'Healthy' : firstScore >= 0.4 ? 'Moderate' : 'At Risk'
  const healthColor = firstScore >= 0.7 ? CHART_BRAND.green : firstScore >= 0.4 ? CHART_BRAND.gold : CHART_BRAND.red

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
    .page { page-break-after: always; padding: 40px 60px; min-height: 100vh; }
    .page:last-child { page-break-after: avoid; }
    h1 { color: ${BRAND.navy}; font-size: 28px; margin-bottom: 8px; }
    h2 { color: ${BRAND.navyLight}; font-size: 20px; margin: 24px 0 12px; border-bottom: 2px solid ${BRAND.blue}; padding-bottom: 6px; }
    h3 { color: ${BRAND.blue}; font-size: 15px; margin: 16px 0 8px; }
    p { margin-bottom: 8px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
    th { background: ${BRAND.navy}; color: white; padding: 8px 10px; text-align: center; font-weight: 600; }
    td { padding: 6px 10px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .cover { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    .cover h1 { font-size: 42px; margin-bottom: 4px; }
    .cover .subtitle { font-size: 18px; color: ${BRAND.blue}; margin-bottom: 16px; }
    .cover .gold-line { width: 120px; height: 3px; background: ${BRAND.gold}; margin: 20px auto; }
    .cover .meta { color: #888; font-size: 12px; margin-top: 40px; }
    .kpi-row { display: flex; gap: 16px; margin: 20px 0; flex-wrap: wrap; }
    .kpi { flex: 1; min-width: 140px; text-align: center; padding: 16px; background: #E8F0FE; border: 1px solid ${BRAND.blue}; border-radius: 8px; }
    .kpi .value { font-size: 24px; font-weight: 700; color: ${BRAND.navy}; }
    .kpi .label { font-size: 10px; color: #888; margin-top: 4px; }
    .health-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .narrative { background: #fafafa; border-left: 4px solid ${BRAND.blue}; padding: 12px 18px; margin: 12px 0; font-size: 12px; }
    .narrative strong { color: ${BRAND.navy}; }
    .chart-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 12px 0; }
    .two-col { display: flex; gap: 12px; align-items: flex-start; }
    .two-col > * { flex: 1; }
    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; }
    .disclaimer { font-size: 10px; color: #666; background: #fffbea; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; margin-top: 16px; }
    @media print {
      .page { padding: 20px 40px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <div class="page cover">
    <h1>${title}</h1>
    <div class="subtitle">${subtitle}</div>
    <div class="gold-line"></div>
    <div class="subtitle" style="margin-top: 20px;">ESOP Repurchase Obligation 10-Year Projection</div>
    <div class="meta">
      <p>${reportDate}</p>
      <p>Prepared by Menke &amp; Associates</p>
      <p>ESOP Advisors Since 1974</p>
    </div>
  </div>

  <div class="page">
    <h1>Executive Summary</h1>
    ${executiveSummary ? `<p>${executiveSummary}</p>` : `<p>This report presents a 10-year projection of ESOP valuation, repurchase obligations, participant population, and sustainability scoring for ${title}. The analysis incorporates plan settings, actuarial assumptions (Sarason T-tables, IRS 417(e)(3), IRS Uniform Lifetime), and company-specific financial inputs to model expected cash flows and share distributions.</p>`}
    <div class="kpi-row">
      <div class="kpi"><div class="value">${fmtDollar(minRO)}</div><div class="label">Low RO</div></div>
      <div class="kpi"><div class="value">${fmtDollar(maxRO)}</div><div class="label">High RO</div></div>
      <div class="kpi"><div class="value">${fmtDollar(avgRO)}</div><div class="label">Average RO</div></div>
      <div class="kpi">
        <div class="value">${fmtPct(firstScore)}</div>
        <div class="label">Success Score</div>
        <span class="health-pill" style="background:${healthColor}20;color:${healthColor};margin-top:6px;">${healthLabel}</span>
      </div>
    </div>

    <h3>Plan Stage &amp; Funding Approach</h3>
    <div class="narrative">
      <p><strong>Plan stage:</strong> ${planStage}</p>
      <p><strong>Funding approach:</strong> ${fundingApproach}</p>
      <p><strong>Contribution source:</strong> ${contributionSource}</p>
    </div>
  </div>

  <div class="page">
    <h2>Capital Table &amp; Valuation</h2>
    <div class="chart-card">${valuationChart}</div>
    <div class="chart-card">${priceChart}</div>
    <table>
      <thead><tr><th>Year</th><th>ESOP Valuation</th><th>ESOP Shares</th><th>% ESOP</th><th>Total Shares</th><th>Price/Share</th><th>Change</th></tr></thead>
      <tbody>${valuations.map((v) => `<tr><td>${v.year}</td><td>${fmtDollar(v.esop_valuation as number)}</td><td>${fmt(v.esop_shares as number)}</td><td>${fmtPct(v.pct_esop_shares as number)}</td><td>${fmt(v.total_shares as number)}</td><td>$${((v.price_per_share as number) || 0).toFixed(2)}</td><td>${fmtPct(v.share_price_change as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Repurchase Obligation</h2>
    <div class="chart-card">${purchaseChart}</div>
    <div class="two-col">
      <div class="chart-card">${pieChart}</div>
      <div>
        <h3>Distribution Drivers</h3>
        <p>The chart beside breaks the cumulative 10-year repurchase obligation into the four categorical drivers: <strong>Diversification</strong> (elective under IRC 401(a)(28) for participants age 55 with 10 years of service), <strong>Retirement/Death/Disability</strong> (statutory distribution events), <strong>Turnover</strong> (voluntary separations graded by Sarason turnover tables), and <strong>In-Service</strong> distributions (including RMDs for participants age 72+).</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Year</th><th>Share Price</th><th>Diversification</th><th>Retirement/Death</th><th>Turnover</th><th>Total RO</th></tr></thead>
      <tbody>${repurchase.map((r) => `<tr><td>${r.year}</td><td>$${((r.share_price as number) || 0).toFixed(2)}</td><td>${fmtDollar(r.diversification as number)}</td><td>${fmtDollar(r.retirement_death_disability as number)}</td><td>${fmtDollar(r.turnover as number)}</td><td>${fmtDollar(r.total_repurchase_obligation as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Share Turnover Schedule</h2>
    <div class="chart-card">${shareTurnoverChart}</div>
    <table>
      <thead><tr><th>Year</th><th>Diversification</th><th>In-Service</th><th>Retirement/Death/Disability</th><th>Turnover</th><th>Total Shares</th></tr></thead>
      <tbody>${turnover.map((t) => `<tr><td>${t.year}</td><td>${fmt(t.diversification as number)}</td><td>${fmt(t.in_service_distributions as number)}</td><td>${fmt(t.retirement_death_disability as number)}</td><td>${fmt(t.turnover as number)}</td><td>${fmt(t.total_shares as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Population &amp; Benefits</h2>
    <div class="chart-card">${populationChart}</div>
    <div class="chart-card">${benefitChart}</div>
    <table>
      <thead><tr><th>Year</th><th>Active Participants</th><th>Covered Compensation</th><th>Avg Total Comp</th><th>Effective Benefit Rate</th><th>Share Turn</th></tr></thead>
      <tbody>${population.map((p) => `<tr><td>${p.year}</td><td>${fmt(p.active_participants as number)}</td><td>${fmtDollar(p.covered_compensation as number)}</td><td>${fmtDollar(p.avg_total_compensation as number)}</td><td>${fmtPct(p.effective_benefit_rate as number)}</td><td>${fmtPct(p.share_turn as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>ESOP Success Score</h2>
    <div class="chart-card">${successChart}</div>
    <h3>Your ESOP Success Score</h3>
    <div class="narrative">
      <p>The ESOP Success Score compares the plan's projected <strong>cash source</strong> (EBITDA × contribution rate + OIA returns + S-Corp tax benefits) against the projected <strong>repurchase obligation</strong>. Higher scores indicate a greater cushion to absorb obligation spikes without straining operating cash flow.</p>
      <p>Current score: <strong>${fmtPct(firstScore)}</strong> — <span style="color:${healthColor};font-weight:600">${healthLabel}</span>.</p>
    </div>
    <table>
      <thead><tr><th>Year</th><th>Repurchase Obligation</th><th>Cash Source</th><th>Surplus/Deficit</th><th>RO Cash Burn</th><th>Success Score</th><th>Health Check</th></tr></thead>
      <tbody>${scores.map((s) => `<tr><td>${s.year_for_payout}</td><td>${fmtDollar(s.repurchase_obligation as number)}</td><td>${fmtDollar(s.cash_source as number)}</td><td>${fmtDollar(s.surplus_or_deficit as number)}</td><td>${fmtPct(s.ro_cash_burn as number)}</td><td>${fmtPct(s.esop_success_score as number)}</td><td>${fmtPct(s.health_check as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Actuarial Assumptions &amp; Plan Design</h2>

    <h3>Assumptions</h3>
    <div class="narrative">
      <p><strong>Diversification:</strong> IRC 401(a)(28) eligibility at age 55 with 10+ years of service. 25% annually for years 1-5, 50% in year 6.</p>
      <p><strong>Turnover:</strong> Sarason T-1 through T-11 age-graded tables (configurable per plan).</p>
      <p><strong>Death:</strong> RP-2000 Combined Healthy mortality, gender-specific.</p>
      <p><strong>Disability:</strong> Equivalent treatment to retirement (full vesting, lump-sum or installment per plan).</p>
      <p><strong>Retirement age:</strong> Plan-defined normal retirement age.</p>
      <p><strong>Salary increase:</strong> Three-tier growth (year 0-1, 2-5, 6+) applied to plan compensation, capped at IRS 401(a)(17) limit.</p>
      <p><strong>Dividends &amp; contributions:</strong> Annual S-Corp distributions plus plan contribution rate of EBITDA.</p>
      <p><strong>Repurchase method:</strong> ${fundingApproach}.</p>
    </div>

    <h3>Participation, Eligibility &amp; Allocations</h3>
    <div class="narrative">
      <p>All participants receive pro-rata allocations based on compensation ratio, subject to the plan's vesting schedule (1-year cliff, 3-year cliff, or 6-year graded). Terminated participants receive vested balances in installments over the plan-defined distribution period, with lump-sum payouts for small balances below the threshold.</p>
    </div>

    <div class="disclaimer">
      <strong>Disclaimer:</strong> This report is confidential and prepared exclusively for the named plan sponsor. Projections are based on the assumptions, plan settings, and participant data provided at the time of generation. Actual results will vary based on experience, market conditions, regulatory changes, and plan amendments. This document does not constitute legal, tax, or investment advice. Consult your ESOP counsel and actuary before making plan-design decisions.
    </div>
  </div>

  <div class="page">
    <h2>Average Age &amp; Tenure for Active Participants</h2>
    <table>
      <thead><tr><th>Year</th><th>Avg Age</th><th>Avg Tenure</th><th>Covered Compensation</th><th>Change %</th><th>Avg Account Balance</th></tr></thead>
      <tbody>${ageTenureActive.map((a) => `<tr><td>${a.year}</td><td>${a.average_age}</td><td>${a.average_tenure}</td><td>${a.covered_compensation}</td><td>${a.change_pct}</td><td>${a.average_account_balance}</td></tr>`).join('')}</tbody>
    </table>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Menke &amp; Associates. ESOP Advisors Since 1974.</p>
      <p>This report is confidential and intended for the plan sponsor only.</p>
    </div>
  </div>

  <script class="no-print">
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    }
  </script>
</body>
</html>`
}
