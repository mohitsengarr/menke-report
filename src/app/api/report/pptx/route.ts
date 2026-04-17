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

    const [profile, valuations, repurchase, population, scores] = await Promise.all([
      supabase.from('profiles').select('company_name').eq('id', user.id).single(),
      supabase.from('valuation_projections').select('*').eq('user_id', user.id).order('year'),
      supabase.from('repurchase_obligations').select('*').eq('user_id', user.id).order('year'),
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

    // --- Slide 2: Valuation Summary ---
    if (valuations.data && valuations.data.length > 0) {
      const slide2 = pptx.addSlide()
      slide2.addText('Capital Table & Valuation Projection', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })

      const headerOpts = { bold: true, color: 'FFFFFF', fill: { color: '1B2A4A' } }
      const tableRows: PptxGenJS.TableRow[] = [
        [
          { text: 'Year', options: headerOpts },
          { text: 'ESOP Valuation', options: headerOpts },
          { text: 'Price/Share', options: headerOpts },
          { text: 'Change', options: headerOpts },
        ],
      ]
      valuations.data.forEach((v) => {
        tableRows.push([
          { text: String(v.year || '') },
          { text: `$${((v.esop_valuation as number) || 0).toLocaleString()}` },
          { text: `$${((v.price_per_share as number) || 0).toFixed(2)}` },
          { text: `${(((v.share_price_change as number) || 0) * 100).toFixed(1)}%` },
        ])
      })

      slide2.addTable(tableRows, {
        x: 0.5, y: 1.2, w: 9,
        fontSize: 11,
        border: { pt: 0.5, color: 'CCCCCC' },
      })
    }

    // --- Slide 3: Repurchase Obligation ---
    if (repurchase.data && repurchase.data.length > 0) {
      const slide3 = pptx.addSlide()
      slide3.addText('Repurchase Obligation Projection', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })

      const headerOpts = { bold: true, color: 'FFFFFF', fill: { color: '1B2A4A' } }
      const tableRows: PptxGenJS.TableRow[] = [
        [
          { text: 'Year', options: headerOpts },
          { text: 'Total RO', options: headerOpts },
          { text: 'Diversification', options: headerOpts },
          { text: 'Turnover', options: headerOpts },
        ],
      ]
      repurchase.data.forEach((r) => {
        tableRows.push([
          { text: String(r.year || '') },
          { text: `$${((r.total_repurchase_obligation as number) || 0).toLocaleString()}` },
          { text: `$${((r.diversification as number) || 0).toLocaleString()}` },
          { text: `$${((r.turnover as number) || 0).toLocaleString()}` },
        ])
      })

      slide3.addTable(tableRows, {
        x: 0.5, y: 1.2, w: 9,
        fontSize: 11,
        border: { pt: 0.5, color: 'CCCCCC' },
      })
    }

    // --- Slide 4: Population Analysis ---
    if (population.data && population.data.length > 0) {
      const slide4 = pptx.addSlide()
      slide4.addText('Population Analysis', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })

      const headerOpts = { bold: true, color: 'FFFFFF', fill: { color: '1B2A4A' } }
      const tableRows: PptxGenJS.TableRow[] = [
        [
          { text: 'Year', options: headerOpts },
          { text: 'Participants', options: headerOpts },
          { text: 'Covered Comp', options: headerOpts },
          { text: 'Benefit Rate', options: headerOpts },
        ],
      ]
      population.data.forEach((p) => {
        tableRows.push([
          { text: String(p.year || '') },
          { text: `${((p.active_participants as number) || 0).toLocaleString()}` },
          { text: `$${((p.covered_compensation as number) || 0).toLocaleString()}` },
          { text: `${(((p.effective_benefit_rate as number) || 0) * 100).toFixed(2)}%` },
        ])
      })

      slide4.addTable(tableRows, {
        x: 0.5, y: 1.2, w: 9,
        fontSize: 11,
        border: { pt: 0.5, color: 'CCCCCC' },
      })
    }

    // --- Slide 5: Success Score ---
    if (scores.data && scores.data.length > 0) {
      const slide5 = pptx.addSlide()
      slide5.addText('ESOP Success Score', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 24, color: '1B2A4A', bold: true,
      })

      const latestScore = scores.data[0]
      const scoreValue = (latestScore.esop_success_score as number) || 0
      const scoreText = latestScore.esop_success_score ? `${(scoreValue * 100).toFixed(1)}%` : 'N/A'
      const health = scoreValue >= 0.8 ? 'Strong' : scoreValue >= 0.5 ? 'Moderate' : 'Impaired'
      const healthColor = health === 'Strong' ? '27AE60' : health === 'Moderate' ? 'E67E22' : 'C0392B'

      slide5.addText(scoreText, {
        x: 2, y: 1.5, w: 6, h: 2,
        fontSize: 72, color: '1B2A4A', bold: true, align: 'center',
      })
      slide5.addText(health, {
        x: 2, y: 3.5, w: 6, h: 1,
        fontSize: 28, color: healthColor, bold: true, align: 'center',
      })
    }

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
