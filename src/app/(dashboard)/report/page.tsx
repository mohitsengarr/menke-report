'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Presentation, Eye, Loader2 } from 'lucide-react'

/**
 * SEN-223: Report builder expanded to match legacy `Models/ReportModel.cs` —
 * the legacy form collects 15+ narrative fields that feed into the PDF
 * deliverable. The prior Next.js form only had 7 (Title, Subtitle, Date,
 * Executive Summary, Plan Stage, Funding Approach, Contribution Source);
 * users migrating from esopsuccessscore.com were losing the ability to
 * enter the plan-design and life-cycle narrative blocks.
 *
 * Fields are grouped into expandable `<details>` sections so the form
 * stays compact but every legacy input has a home. All fields are passed
 * through to `/api/report/pdf` and rendered in a new "Narrative" section
 * of the PDF when present.
 */
export default function ReportPage() {
  // ── Identity & cover ──
  const [title, setTitle] = useState('ESOP Repurchase Obligation Analysis')
  const [subtitle, setSubtitle] = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [executiveSummary, setExecutiveSummary] = useState('')

  // ── Plan structure ──
  const [leveraged, setLeveraged] = useState<'yes' | 'no' | ''>('')
  const [leveragedDiscussion, setLeveragedDiscussion] = useState('')
  const [substantial, setSubstantial] = useState<'yes' | 'no' | ''>('')
  const [substantialDiscussion, setSubstantialDiscussion] = useState('')
  const [annualContributions, setAnnualContributions] = useState('')

  // ── Redemption & recycling ──
  const [followedRedemption, setFollowedRedemption] = useState('')
  const [stockRedemption, setStockRedemption] = useState('')
  const [recycling, setRecycling] = useState('')
  const [approach, setApproach] = useState('')

  // ── Funding ──
  const [planStage, setPlanStage] = useState('')
  const [fundingApproach, setFundingApproach] = useState('Redemption + recycling')
  const [contributionSource, setContributionSource] = useState('Operating cash flow')
  const [contributionFunding, setContributionFunding] = useState('')
  const [cashComeFrom, setCashComeFrom] = useState('')

  // ── Plan life cycle ──
  const [materialEvents, setMaterialEvents] = useState('')
  const [earlyStage, setEarlyStage] = useState('')
  const [midStage, setMidStage] = useState('')
  const [lateStages, setLateStages] = useState('')

  // ── Assumptions & projections ──
  const [diversification, setDiversification] = useState('')
  const [turnoverAssumption, setTurnoverAssumption] = useState('')
  const [death, setDeath] = useState('')
  const [disability, setDisability] = useState('')
  const [retirementAge, setRetirementAge] = useState('')
  const [salaryIncrease, setSalaryIncrease] = useState('')

  // ── Dividends & repurchase ──
  const [dividendsContributions, setDividendsContributions] = useState('')
  const [repurchaseMethod, setRepurchaseMethod] = useState('')

  // ── Plan design ──
  const [participation, setParticipation] = useState('')
  const [eligibility, setEligibility] = useState('')
  const [allocations, setAllocations] = useState('')

  // ── Footer ──
  const [disclaimer, setDisclaimer] = useState('')

  const [pdfLoading, setPdfLoading] = useState(false)
  const [pptxLoading, setPptxLoading] = useState(false)

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
  const textareaCls = `${inputCls} min-h-[96px] resize-y`
  const sectionCls =
    'rounded-lg border border-gray-200 bg-gray-50/40 p-3 open:bg-white transition-colors'
  const summaryCls =
    'text-sm font-medium text-menke-navy cursor-pointer select-none'
  const labelCls = 'block text-xs font-medium text-gray-700'

  const payload = () => ({
    title, subtitle, reportDate, executiveSummary,
    leveraged, leveragedDiscussion, substantial, substantialDiscussion, annualContributions,
    followedRedemption, stockRedemption, recycling, approach,
    planStage, fundingApproach, contributionSource, contributionFunding, cashComeFrom,
    materialEvents, earlyStage, midStage, lateStages,
    diversification, turnoverAssumption, death, disability, retirementAge, salaryIncrease,
    dividendsContributions, repurchaseMethod,
    participation, eligibility, allocations,
    disclaimer,
  })

  async function handleGeneratePDF() {
    setPdfLoading(true)
    try {
      const res = await fetch('/api/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      alert('Failed to generate PDF report. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleGeneratePPTX() {
    setPptxLoading(true)
    try {
      const res = await fetch('/api/report/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      if (!res.ok) throw new Error('PPTX generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.pptx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate PPTX. Please try again.')
    } finally {
      setPptxLoading(false)
    }
  }

  // Count filled narrative fields for the preview section count.
  const narrativeFields = [
    leveragedDiscussion, substantialDiscussion, annualContributions,
    followedRedemption, stockRedemption, recycling, approach,
    planStage, fundingApproach, contributionSource, contributionFunding, cashComeFrom,
    materialEvents, earlyStage, midStage, lateStages,
    diversification, turnoverAssumption, death, disability, retirementAge, salaryIncrease,
    dividendsContributions, repurchaseMethod,
    participation, eligibility, allocations, disclaimer,
  ]
  const filledCount = narrativeFields.filter(v => v && v.trim().length > 0).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Generate Reports</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Form ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cover */}
            <div className="space-y-1">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
              <input id="title" type="text" className={inputCls} value={title}
                onChange={(e) => setTitle(e.target.value)} placeholder="Report title" />
            </div>
            <div className="space-y-1">
              <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700">Subtitle</label>
              <input id="subtitle" type="text" className={inputCls} value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional subtitle or company name" />
            </div>
            <div className="space-y-1">
              <label htmlFor="reportDate" className="block text-sm font-medium text-gray-700">Report Date</label>
              <input id="reportDate" type="date" className={inputCls} value={reportDate}
                onChange={(e) => setReportDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="summary" className="block text-sm font-medium text-gray-700">Executive Summary</label>
              <textarea id="summary" className={`${inputCls} min-h-[120px] resize-y`} value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                placeholder="Narrative summary — defaults to an auto-generated paragraph if left blank." rows={5} />
              <p className="text-[11px] text-gray-400">Leave blank to use the default summary.</p>
            </div>

            {/* Plan Structure */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Plan Structure (leveraged / substantial / annual contributions)</summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Leveraged ESOP?</label>
                    <select className={inputCls} value={leveraged}
                      onChange={(e) => setLeveraged(e.target.value as 'yes' | 'no' | '')}>
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Substantial ESOP Ownership?</label>
                    <select className={inputCls} value={substantial}
                      onChange={(e) => setSubstantial(e.target.value as 'yes' | 'no' | '')}>
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Leveraged Discussion</label>
                  <textarea className={textareaCls} value={leveragedDiscussion}
                    onChange={(e) => setLeveragedDiscussion(e.target.value)}
                    placeholder="Describe loan structure, balance, amortization, tax benefits..." />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Substantial Discussion</label>
                  <textarea className={textareaCls} value={substantialDiscussion}
                    onChange={(e) => setSubstantialDiscussion(e.target.value)}
                    placeholder="Ownership %, strategic implications..." />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Annual Contributions Description</label>
                  <textarea className={textareaCls} value={annualContributions}
                    onChange={(e) => setAnnualContributions(e.target.value)}
                    placeholder="How annual contributions are funded and sized." />
                </div>
              </div>
            </details>

            {/* Redemption / Recycling */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Redemption &amp; Recycling</summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className={labelCls}>Followed Redemption</label>
                  <textarea className={textareaCls} value={followedRedemption}
                    onChange={(e) => setFollowedRedemption(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Stock Redemption</label>
                  <textarea className={textareaCls} value={stockRedemption}
                    onChange={(e) => setStockRedemption(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Recycling</label>
                  <textarea className={textareaCls} value={recycling}
                    onChange={(e) => setRecycling(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Approach</label>
                  <textarea className={textareaCls} value={approach}
                    onChange={(e) => setApproach(e.target.value)} />
                </div>
              </div>
            </details>

            {/* Funding */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Funding &amp; Plan Stage</summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className={labelCls}>Plan Stage</label>
                  <select className={inputCls} value={planStage}
                    onChange={(e) => setPlanStage(e.target.value)}>
                    <option value="">Auto-detect from valuation</option>
                    <option>Early stage</option>
                    <option>Mid stage</option>
                    <option>Growth stage</option>
                    <option>Mature / Late stage</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Funding Approach</label>
                  <select className={inputCls} value={fundingApproach}
                    onChange={(e) => setFundingApproach(e.target.value)}>
                    <option>Redemption + recycling</option>
                    <option>Redemption only</option>
                    <option>Recycling only</option>
                    <option>OIA-funded</option>
                    <option>Mixed / S-Corp distributions</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Contribution Source</label>
                  <input type="text" className={inputCls} value={contributionSource}
                    onChange={(e) => setContributionSource(e.target.value)}
                    placeholder="Operating cash flow / dividends / refinancing / etc." />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Contribution Funding</label>
                  <textarea className={textareaCls} value={contributionFunding}
                    onChange={(e) => setContributionFunding(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Where Does the Cash Come From?</label>
                  <textarea className={textareaCls} value={cashComeFrom}
                    onChange={(e) => setCashComeFrom(e.target.value)} />
                </div>
              </div>
            </details>

            {/* Life Cycle */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Plan Life Cycle</summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className={labelCls}>Material Events</label>
                  <textarea className={textareaCls} value={materialEvents}
                    onChange={(e) => setMaterialEvents(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Early Stage</label>
                  <textarea className={textareaCls} value={earlyStage}
                    onChange={(e) => setEarlyStage(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Mid Stage</label>
                  <textarea className={textareaCls} value={midStage}
                    onChange={(e) => setMidStage(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Late Stages</label>
                  <textarea className={textareaCls} value={lateStages}
                    onChange={(e) => setLateStages(e.target.value)} />
                </div>
              </div>
            </details>

            {/* Assumptions */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Assumptions &amp; Projections</summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>Diversification</label>
                  <textarea className={textareaCls} value={diversification}
                    onChange={(e) => setDiversification(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Turnover</label>
                  <textarea className={textareaCls} value={turnoverAssumption}
                    onChange={(e) => setTurnoverAssumption(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Death</label>
                  <textarea className={textareaCls} value={death}
                    onChange={(e) => setDeath(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Disability</label>
                  <textarea className={textareaCls} value={disability}
                    onChange={(e) => setDisability(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Retirement Age</label>
                  <textarea className={textareaCls} value={retirementAge}
                    onChange={(e) => setRetirementAge(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Salary Increase</label>
                  <textarea className={textareaCls} value={salaryIncrease}
                    onChange={(e) => setSalaryIncrease(e.target.value)} />
                </div>
              </div>
            </details>

            {/* Dividends & Repurchase */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Dividends &amp; Repurchase Method</summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className={labelCls}>Dividends / Contributions</label>
                  <textarea className={textareaCls} value={dividendsContributions}
                    onChange={(e) => setDividendsContributions(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Repurchase Method</label>
                  <textarea className={textareaCls} value={repurchaseMethod}
                    onChange={(e) => setRepurchaseMethod(e.target.value)} />
                </div>
              </div>
            </details>

            {/* Plan Design */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Plan Design (Participation / Eligibility / Allocations)</summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className={labelCls}>Participation</label>
                  <textarea className={textareaCls} value={participation}
                    onChange={(e) => setParticipation(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Eligibility</label>
                  <textarea className={textareaCls} value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Allocations</label>
                  <textarea className={textareaCls} value={allocations}
                    onChange={(e) => setAllocations(e.target.value)} />
                </div>
              </div>
            </details>

            {/* Disclaimer */}
            <details className={sectionCls}>
              <summary className={summaryCls}>Disclaimer</summary>
              <div className="mt-3 space-y-1">
                <textarea className={`${textareaCls} min-h-[140px]`} value={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.value)}
                  placeholder="Override the default disclaimer at the end of the PDF. Leave blank to use the Menke default." />
              </div>
            </details>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleGeneratePDF} disabled={pdfLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-menke-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-menke-navy-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {pdfLoading ? 'Generating...' : 'Generate PDF'}
              </button>
              <button onClick={handleGeneratePPTX} disabled={pptxLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-menke-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-menke-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {pptxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                {pptxLoading ? 'Generating...' : 'Generate PPTX'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Preview ─── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <CardTitle>Report Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 bg-white shadow-inner">
              <div className="flex flex-col items-center justify-center p-8 min-h-[360px] text-center space-y-6">
                <div className="w-16 h-1 bg-menke-navy rounded-full" />
                <div>
                  <h2 className="text-xl font-bold text-menke-navy leading-tight">{title || 'Untitled Report'}</h2>
                  {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
                </div>
                <div className="w-12 h-px bg-gray-300" />
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Prepared by</p>
                  <p className="text-sm font-medium text-gray-700">Menke &amp; Associates, Inc.</p>
                </div>
                {reportDate && (
                  <p className="text-xs text-gray-400">
                    {new Date(reportDate + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                )}
                {executiveSummary && (
                  <div className="mt-4 w-full text-left border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Executive Summary</p>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-6">{executiveSummary}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-lg space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-menke-navy uppercase tracking-wider">Report Contents</p>
                  <p className="text-[10px] text-gray-400">
                    {filledCount} of 28 narrative fields completed
                  </p>
                </div>
                <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                  <li>Cover + Executive Summary with KPI tiles</li>
                  <li>Plan Structure — Leveraged, Substantial, Annual Contributions</li>
                  <li>Redemption &amp; Recycling</li>
                  <li>Funding, Plan Stage, Contribution Source</li>
                  <li>Plan Life Cycle — Material Events / Early / Mid / Late</li>
                  <li>Capital Table &amp; Valuation — line charts + data table</li>
                  <li>Repurchase Obligation — chart + driver pie + table</li>
                  <li>Share Turnover Schedule — stacked bar + table</li>
                  <li>Population &amp; Benefits — bar + benefit-rate line + table</li>
                  <li>ESOP Success Score — trend chart + commentary</li>
                  <li>Actuarial Assumptions — Diversification, Turnover, Death, Disability, Retirement Age, Salary Increase</li>
                  <li>Dividends &amp; Repurchase Method</li>
                  <li>Plan Design — Participation, Eligibility, Allocations</li>
                  <li>Average Age &amp; Tenure</li>
                  <li>Disclaimer &amp; Footer</li>
                </ul>
                <p className="text-[10px] text-gray-400 italic pt-1">
                  PDF opens in a new tab with a print dialog for save-as-PDF. PPTX downloads directly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
