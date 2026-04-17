import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import PptxGenJS from 'pptxgenjs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { title, subtitle } = body

    const [profile, valuations, repurchase, turnover, population, scores] = await Promise.all([
      supabase.from('profiles').select('company_name').eq('id', user.id).single(),
      supabase.from('valuation_projections').select('*').eq('user_id', user.id).order('year'),
      supabase.from('repurchase_obligations').select('*').eq('user_id', user.id).order('year'),
      supabase.from('share_turnover_schedules').select('*').eq('user_id', user.id).order('year'),
      supabase.from('population_analyses').select('*').eq('user_id', user.id).order('year'),
      supabase.from('success_scores').select('*').eq('user_id', user.id).order('year_for_payout'),
    ])

    const reportTitle = title || profile.data?.company_name || 'ESOP Report'

    const pptx = new PptxGenJS()
    pptx.author = 'Menke & Associates'
    pptx.company = 'Menke & Associates'
    pptx.title = reportTitle

    // --- Slide 1: Title ---
    const slide1 = pptx.addSlide()
    slide1.background = { color: '1B2A4A' }
    slide1.addText(reportTitle, {
      x: 0.5, y: 1.5, w: 9, h: 1.5,
      fontSize: 36, color: 'FFFFFF', bold: true, align: 'center',
    })
    slide1.addText(subtitle || 'ESOP Sustainability Analysis', {
      x: 0.5, y: 3.0, w: 9, h: 0.8,
      fontSize: 20, color: '3B7DD8', align: 'center',
    })
    slide1.addText('Prepared by Menke & Associates | ESOP Advisors Since 1974', {
      x: 0.5, y: 5.0, w: 9, h: 0.5,
      fontSize: 12, color: '888888', align: 'center',
    })

    // --- Slide 2: Valuation Line Chart ---
    if (valuations.data && valuations.data.length > 0) {
      const slide2 = pptx.addSlide()
      slide2.addText('Capital Table & Valuation Projection', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = valuations.data.map((v) => String(v.year || ''))
      const esopVals = valuations.data.map((v) => ((v.esop_valuation as number) || 0))
      slide2.addChart(pptx.ChartType.line, [
        { name: 'ESOP Valuation', labels, values: esopVals },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.5,
        showTitle: true, title: 'ESOP Valuation Over Time',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['1B2A4A'], showLegend: false,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      })
    }

    // --- Slide 2b: Share Price Trend ---
    if (valuations.data && valuations.data.length > 0) {
      const slide2b = pptx.addSlide()
      slide2b.addText('Share Price Trend', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = valuations.data.map((v) => String(v.year || ''))
      const prices = valuations.data.map((v) => ((v.price_per_share as number) || 0))
      slide2b.addChart(pptx.ChartType.line, [
        { name: 'Price per Share', labels, values: prices },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.5,
        showTitle: true, title: 'Price per Share Over Time',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['22C55E'], showLegend: false,
      })
    }

    // --- Slide 3: Total RO Line Chart ---
    if (repurchase.data && repurchase.data.length > 0) {
      const slide3 = pptx.addSlide()
      slide3.addText('Total Repurchase Obligation', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = repurchase.data.map((r) => String(r.year || ''))
      slide3.addChart(pptx.ChartType.line, [
        { name: 'Total RO', labels, values: repurchase.data.map((r) => (r.total_repurchase_obligation as number) || 0) },
        { name: 'NPV', labels, values: repurchase.data.map((r) => (r.npv as number) || 0) },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.5,
        showTitle: true, title: 'Total RO vs NPV by Year',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['EF4444', '3B82F6'],
        showLegend: true, legendPos: 'b',
      })
    }

    // --- Slide 3b: RO Breakdown Pie Chart ---
    if (repurchase.data && repurchase.data.length > 0) {
      const slide3b = pptx.addSlide()
      slide3b.addText('Repurchase Obligation by Driver', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const pieValues = [
        repurchase.data.reduce((s, r) => s + ((r.diversification as number) || 0), 0),
        repurchase.data.reduce((s, r) => s + ((r.retirement_death_disability as number) || 0), 0),
        repurchase.data.reduce((s, r) => s + ((r.turnover as number) || 0), 0),
        repurchase.data.reduce((s, r) => s + ((r.in_service_distributions as number) || 0), 0),
      ]
      slide3b.addChart(pptx.ChartType.pie, [{
        name: 'Drivers',
        labels: ['Diversification', 'Retirement/Death', 'Turnover', 'In-Service'],
        values: pieValues,
      }], {
        x: 1.5, y: 1.0, w: 7, h: 4.5,
        showTitle: true, title: '10-Year Cumulative RO by Driver',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['3B82F6', '1E3A8A', 'F97316', '0EA5E9'],
        showLegend: true, legendPos: 'r',
        showPercent: true,
      })
    }

    // --- Slide 3c: Share Turnover Stacked Bar ---
    if (turnover.data && turnover.data.length > 0) {
      const slide3c = pptx.addSlide()
      slide3c.addText('Share Turnover Schedule', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = turnover.data.map((t) => String(t.year || ''))
      slide3c.addChart(pptx.ChartType.bar, [
        { name: 'Diversification', labels, values: turnover.data.map((t) => (t.diversification as number) || 0) },
        { name: 'Retirement', labels, values: turnover.data.map((t) => (t.retirement_death_disability as number) || 0) },
        { name: 'Turnover', labels, values: turnover.data.map((t) => (t.turnover as number) || 0) },
        { name: 'In-Service', labels, values: turnover.data.map((t) => (t.in_service_distributions as number) || 0) },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.5,
        barDir: 'col', barGrouping: 'stacked',
        showTitle: true, title: 'Share Turnover by Category',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['3B82F6', '1E3A8A', 'F97316', '0EA5E9'],
        showLegend: true, legendPos: 'b',
      })
    }

    // --- Slide 4: Population Chart ---
    if (population.data && population.data.length > 0) {
      const slide4 = pptx.addSlide()
      slide4.addText('Active Participants by Year', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = population.data.map((p) => String(p.year || ''))
      slide4.addChart(pptx.ChartType.bar, [
        { name: 'Active Participants', labels, values: population.data.map((p) => (p.active_participants as number) || 0) },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.5,
        barDir: 'col',
        showTitle: true, title: 'Active Participants Over Time',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['8B5CF6'], showLegend: false,
      })
    }

    // --- Slide 4b: Effective Benefit Rate Line Chart ---
    if (population.data && population.data.length > 0) {
      const slide4b = pptx.addSlide()
      slide4b.addText('Effective Benefit Rate', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = population.data.map((p) => String(p.year || ''))
      slide4b.addChart(pptx.ChartType.line, [
        { name: 'Benefit Rate', labels, values: population.data.map((p) => ((p.effective_benefit_rate as number) || 0) * 100) },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.5,
        showTitle: true, title: 'Effective Benefit Rate (%)',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['3B82F6'], showLegend: false,
      })
    }

    // --- Slide 5: Success Score Line Chart ---
    if (scores.data && scores.data.length > 0) {
      const slide5 = pptx.addSlide()
      slide5.addText('ESOP Success Score Trend', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })
      const labels = scores.data.map((s) => String(s.year_for_payout || ''))
      slide5.addChart(pptx.ChartType.line, [
        { name: 'Success Score', labels, values: scores.data.map((s) => ((s.esop_success_score as number) || 0) * 100) },
        { name: 'Health Check', labels, values: scores.data.map((s) => ((s.health_check as number) || 0) * 100) },
      ], {
        x: 0.5, y: 1.0, w: 9, h: 4.0,
        showTitle: true, title: 'Success Score & Health Over Time (%)',
        titleFontSize: 14, titleColor: '1B2A4A',
        chartColors: ['D4A843', '22C55E'],
        showLegend: true, legendPos: 'b',
      })

      // Score summary below the chart
      const latestScore = scores.data[0]
      const scoreValue = (latestScore.esop_success_score as number) || 0
      const scoreText = latestScore.esop_success_score ? `${(scoreValue * 100).toFixed(1)}%` : 'N/A'
      const health = scoreValue >= 0.7 ? 'Healthy' : scoreValue >= 0.4 ? 'Moderate' : 'At Risk'
      const healthColor = health === 'Healthy' ? '22C55E' : health === 'Moderate' ? 'D4A843' : 'EF4444'
      slide5.addText(`Current: ${scoreText} — ${health}`, {
        x: 0.5, y: 5.2, w: 9, h: 0.5,
        fontSize: 16, color: healthColor, bold: true, align: 'center',
      })
    }

    // --- Slide 6: Actuarial Assumptions (narrative) ---
    const slide6 = pptx.addSlide()
    slide6.addText('Actuarial Assumptions & Plan Design', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, color: '1B2A4A', bold: true,
    })
    slide6.addText([
      { text: 'Diversification: ', options: { bold: true, color: '1B2A4A' } },
      { text: 'IRC 401(a)(28) at age 55 + 10 yrs service. 25% yrs 1-5, 50% yr 6.\n' },
      { text: 'Turnover: ', options: { bold: true, color: '1B2A4A' } },
      { text: 'Sarason T-1..T-11 age-graded tables, configurable per plan.\n' },
      { text: 'Mortality: ', options: { bold: true, color: '1B2A4A' } },
      { text: 'RP-2000 Combined Healthy, gender-specific.\n' },
      { text: 'Retirement age: ', options: { bold: true, color: '1B2A4A' } },
      { text: 'Plan-defined normal retirement age.\n' },
      { text: 'Salary increase: ', options: { bold: true, color: '1B2A4A' } },
      { text: '3-tier growth (yr 0-1, 2-5, 6+), capped at IRS 401(a)(17).\n' },
      { text: 'RMD: ', options: { bold: true, color: '1B2A4A' } },
      { text: 'IRS Uniform Lifetime Table starting age 72 (configurable).\n' },
      { text: 'Cash source: ', options: { bold: true, color: '1B2A4A' } },
      { text: 'EBITDA × contribution rate + OIA returns + S-Corp tax benefits.\n' },
    ], {
      x: 0.5, y: 1.2, w: 9, h: 4.5,
      fontSize: 12, color: '333333',
      valign: 'top',
      paraSpaceAfter: 4,
    })

    // --- Slide 7: Disclaimer ---
    const slide7 = pptx.addSlide()
    slide7.addText('Disclaimer', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, color: '1B2A4A', bold: true,
    })
    slide7.addText(
      'This report is confidential and prepared exclusively for the named plan sponsor. ' +
      'Projections are based on the assumptions, plan settings, and participant data provided at ' +
      'the time of generation. Actual results will vary based on experience, market conditions, ' +
      'regulatory changes, and plan amendments. This document does not constitute legal, tax, or ' +
      'investment advice. Consult your ESOP counsel and actuary before making plan-design decisions.',
      {
        x: 0.5, y: 1.2, w: 9, h: 3.5,
        fontSize: 12, color: '333333',
        valign: 'top',
      }
    )
    slide7.addText(
      `© ${new Date().getFullYear()} Menke & Associates. ESOP Advisors Since 1974.`,
      {
        x: 0.5, y: 5.0, w: 9, h: 0.5,
        fontSize: 10, color: '888888', align: 'center', italic: true,
      }
    )

    // Generate PPTX buffer
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer

    const safeFilename = (title || 'report').replace(/[^a-zA-Z0-9]/g, '_')

    return new NextResponse(pptxBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeFilename}.pptx"`,
      },
    })
  } catch (error) {
    console.error('PPTX generation error:', error)
    return NextResponse.json({ error: 'PPTX generation failed' }, { status: 500 })
  }
}
