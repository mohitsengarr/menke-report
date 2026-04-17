import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { title, subtitle, reportDate, executiveSummary } = body

    // Fetch all data
    const [profile, valuations, repurchase, turnover, population, scores, ageTenureActive] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('valuation_projections').select('*').eq('user_id', user.id).order('year'),
      supabase.from('repurchase_obligations').select('*').eq('user_id', user.id).order('year'),
      supabase.from('share_turnover_schedules').select('*').eq('user_id', user.id).order('year'),
      supabase.from('population_analyses').select('*').eq('user_id', user.id).order('year'),
      supabase.from('success_scores').select('*').eq('user_id', user.id).order('year_for_payout'),
      supabase.from('average_age_tenure_active').select('*').eq('user_id', user.id).order('year'),
    ])

    // Build HTML report
    const html = buildReportHTML({
      title: title || profile.data?.company_name || 'ESOP Report',
      subtitle: subtitle || 'ESOP Sustainability Analysis',
      reportDate: reportDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      executiveSummary: executiveSummary || '',
      valuations: valuations.data || [],
      repurchase: repurchase.data || [],
      turnover: turnover.data || [],
      population: population.data || [],
      scores: scores.data || [],
      ageTenureActive: ageTenureActive.data || [],
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

function buildReportHTML(data: {
  title: string
  subtitle: string
  reportDate: string
  executiveSummary: string
  valuations: Record<string, unknown>[]
  repurchase: Record<string, unknown>[]
  turnover: Record<string, unknown>[]
  population: Record<string, unknown>[]
  scores: Record<string, unknown>[]
  ageTenureActive: Record<string, unknown>[]
}): string {
  const { title, subtitle, reportDate, executiveSummary, valuations, repurchase, turnover, population, scores, ageTenureActive } = data

  const fmt = (n: number) => n?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '0'
  const fmtPct = (n: number) => `${((n || 0) * 100).toFixed(2)}%`
  const fmtDollar = (n: number) => `$${fmt(n)}`

  // Calculate summary stats
  const roValues = repurchase.map((r) => (r.total_repurchase_obligation as number) || 0)
  const avgRO = roValues.length > 0 ? roValues.reduce((a, b) => a + b, 0) / roValues.length : 0
  const minRO = roValues.length > 0 ? Math.min(...roValues) : 0
  const maxRO = roValues.length > 0 ? Math.max(...roValues) : 0

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
    h1 { color: #1B2A4A; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #2C3E6B; font-size: 20px; margin: 24px 0 12px; border-bottom: 2px solid #3B7DD8; padding-bottom: 6px; }
    h3 { color: #3B7DD8; font-size: 16px; margin: 16px 0 8px; }
    p { margin-bottom: 8px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th { background: #1B2A4A; color: white; padding: 8px 10px; text-align: center; font-weight: 600; }
    td { padding: 6px 10px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .cover { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    .cover h1 { font-size: 42px; margin-bottom: 4px; }
    .cover .subtitle { font-size: 18px; color: #3B7DD8; margin-bottom: 16px; }
    .cover .gold-line { width: 120px; height: 3px; background: #D4A843; margin: 20px auto; }
    .cover .meta { color: #888; font-size: 12px; margin-top: 40px; }
    .kpi-row { display: flex; gap: 16px; margin: 20px 0; }
    .kpi { flex: 1; text-align: center; padding: 16px; background: #E8F0FE; border: 1px solid #3B7DD8; border-radius: 8px; }
    .kpi .value { font-size: 24px; font-weight: 700; color: #1B2A4A; }
    .kpi .label { font-size: 10px; color: #888; margin-top: 4px; }
    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; }
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
    ${executiveSummary ? `<p>${executiveSummary}</p>` : ''}
    <div class="kpi-row">
      <div class="kpi"><div class="value">${fmtDollar(minRO)}</div><div class="label">Low RO</div></div>
      <div class="kpi"><div class="value">${fmtDollar(maxRO)}</div><div class="label">High RO</div></div>
      <div class="kpi"><div class="value">${fmtDollar(avgRO)}</div><div class="label">Average RO</div></div>
      <div class="kpi"><div class="value">${scores.length > 0 ? fmtPct((scores[0] as Record<string, unknown>).esop_success_score as number || 0) : 'N/A'}</div><div class="label">Success Score</div></div>
    </div>
  </div>

  <div class="page">
    <h2>Capital Table &amp; Valuation Projection</h2>
    <table>
      <thead><tr><th>Year</th><th>ESOP Valuation</th><th>ESOP Shares</th><th>% ESOP</th><th>Total Shares</th><th>Price/Share</th><th>Change</th></tr></thead>
      <tbody>${valuations.map((v) => `<tr><td>${v.year}</td><td>${fmtDollar(v.esop_valuation as number)}</td><td>${fmt(v.esop_shares as number)}</td><td>${fmtPct(v.pct_esop_shares as number)}</td><td>${fmt(v.total_shares as number)}</td><td>$${((v.price_per_share as number) || 0).toFixed(2)}</td><td>${fmtPct(v.share_price_change as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Repurchase Obligation Projection</h2>
    <table>
      <thead><tr><th>Year</th><th>Share Price</th><th>Diversification</th><th>Retirement/Death</th><th>Turnover</th><th>Total RO</th></tr></thead>
      <tbody>${repurchase.map((r) => `<tr><td>${r.year}</td><td>$${((r.share_price as number) || 0).toFixed(2)}</td><td>${fmtDollar(r.diversification as number)}</td><td>${fmtDollar(r.retirement_death_disability as number)}</td><td>${fmtDollar(r.turnover as number)}</td><td>${fmtDollar(r.total_repurchase_obligation as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Share Turnover Schedule</h2>
    <table>
      <thead><tr><th>Year</th><th>Diversification</th><th>In-Service</th><th>Retirement/Death/Disability</th><th>Turnover</th><th>Total Shares</th></tr></thead>
      <tbody>${turnover.map((t) => `<tr><td>${t.year}</td><td>${fmt(t.diversification as number)}</td><td>${fmt(t.in_service_distributions as number)}</td><td>${fmt(t.retirement_death_disability as number)}</td><td>${fmt(t.turnover as number)}</td><td>${fmt(t.total_shares as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>Population Analysis</h2>
    <table>
      <thead><tr><th>Year</th><th>Active Participants</th><th>Covered Compensation</th><th>Avg Total Comp</th><th>Effective Benefit Rate</th><th>Share Turn</th></tr></thead>
      <tbody>${population.map((p) => `<tr><td>${p.year}</td><td>${fmt(p.active_participants as number)}</td><td>${fmtDollar(p.covered_compensation as number)}</td><td>${fmtDollar(p.avg_total_compensation as number)}</td><td>${fmtPct(p.effective_benefit_rate as number)}</td><td>${fmtPct(p.share_turn as number)}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page">
    <h2>ESOP Success Score</h2>
    <table>
      <thead><tr><th>Year</th><th>Repurchase Obligation</th><th>Cash Source</th><th>Surplus/Deficit</th><th>RO Cash Burn</th><th>Success Score</th><th>Health Check</th></tr></thead>
      <tbody>${scores.map((s) => `<tr><td>${s.year_for_payout}</td><td>${fmtDollar(s.repurchase_obligation as number)}</td><td>${fmtDollar(s.cash_source as number)}</td><td>${fmtDollar(s.surplus_or_deficit as number)}</td><td>${fmtPct(s.ro_cash_burn as number)}</td><td>${fmtPct(s.esop_success_score as number)}</td><td>${fmtPct(s.health_check as number)}</td></tr>`).join('')}</tbody>
    </table>
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
    // Auto-trigger print dialog for PDF save
    window.onload = function() {
      // Small delay to let styles render
      setTimeout(function() { window.print(); }, 500);
    }
  </script>
</body>
</html>`
}
