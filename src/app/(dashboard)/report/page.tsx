'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Presentation, Eye, Loader2 } from 'lucide-react'

export default function ReportPage() {
  const [title, setTitle] = useState('ESOP Repurchase Obligation Analysis')
  const [subtitle, setSubtitle] = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [executiveSummary, setExecutiveSummary] = useState('')

  // Narrative plan-design fields (legacy ReportModel.cs parity)
  const [planStage, setPlanStage] = useState('')
  const [fundingApproach, setFundingApproach] = useState('Redemption + recycling')
  const [contributionSource, setContributionSource] = useState('Operating cash flow')

  const [pdfLoading, setPdfLoading] = useState(false)
  const [pptxLoading, setPptxLoading] = useState(false)

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

  const payload = () => ({
    title, subtitle, reportDate, executiveSummary,
    planStage, fundingApproach, contributionSource,
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Generate Reports</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                id="title"
                type="text"
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Report title"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700">
                Subtitle
              </label>
              <input
                id="subtitle"
                type="text"
                className={inputCls}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Optional subtitle or company name"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="reportDate" className="block text-sm font-medium text-gray-700">
                Report Date
              </label>
              <input
                id="reportDate"
                type="date"
                className={inputCls}
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
                Executive Summary
              </label>
              <textarea
                id="summary"
                className={`${inputCls} min-h-[120px] resize-y`}
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                placeholder="Narrative summary — defaults to an auto-generated paragraph if left blank."
                rows={5}
              />
              <p className="text-[11px] text-gray-400">
                Leave blank to use the default summary for the report&apos;s Executive Summary section.
              </p>
            </div>

            {/* Narrative plan-design fields */}
            <details className="rounded-lg border border-gray-200 bg-gray-50/40 p-3">
              <summary className="text-sm font-medium text-menke-navy cursor-pointer">
                Plan Narrative (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Plan Stage</label>
                  <select
                    className={inputCls}
                    value={planStage}
                    onChange={(e) => setPlanStage(e.target.value)}
                  >
                    <option value="">Auto-detect from valuation</option>
                    <option>Early stage</option>
                    <option>Mid stage</option>
                    <option>Growth stage</option>
                    <option>Mature / Late stage</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Funding Approach</label>
                  <select
                    className={inputCls}
                    value={fundingApproach}
                    onChange={(e) => setFundingApproach(e.target.value)}
                  >
                    <option>Redemption + recycling</option>
                    <option>Redemption only</option>
                    <option>Recycling only</option>
                    <option>OIA-funded</option>
                    <option>Mixed / S-Corp distributions</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Contribution Source</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={contributionSource}
                    onChange={(e) => setContributionSource(e.target.value)}
                    placeholder="Operating cash flow / dividends / refinancing / etc."
                  />
                </div>
              </div>
            </details>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleGeneratePDF}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-menke-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-menke-navy-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {pdfLoading ? 'Generating...' : 'Generate PDF'}
              </button>
              <button
                onClick={handleGeneratePPTX}
                disabled={pptxLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-menke-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-menke-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pptxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                {pptxLoading ? 'Generating...' : 'Generate PPTX'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <CardTitle>Report Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 bg-white shadow-inner">
              {/* Mock cover page */}
              <div className="flex flex-col items-center justify-center p-8 min-h-[360px] text-center space-y-6">
                <div className="w-16 h-1 bg-menke-navy rounded-full" />
                <div>
                  <h2 className="text-xl font-bold text-menke-navy leading-tight">
                    {title || 'Untitled Report'}
                  </h2>
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
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Executive Summary
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-6">
                      {executiveSummary}
                    </p>
                  </div>
                )}
              </div>

              {/* Report sections list */}
              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-lg space-y-2">
                <p className="text-xs font-semibold text-menke-navy uppercase tracking-wider">
                  Report Contents
                </p>
                <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                  <li>Cover + Executive Summary with KPI tiles</li>
                  <li>Plan Stage, Funding Approach, Contribution Source narrative</li>
                  <li>Capital Table &amp; Valuation — line charts (ESOP Valuation, Share Price) + data table</li>
                  <li>Repurchase Obligation — line chart, driver pie chart, data table</li>
                  <li>Share Turnover Schedule — stacked bar chart + data table</li>
                  <li>Population &amp; Benefits — bar chart, Effective Benefit Rate line + data table</li>
                  <li>ESOP Success Score — trend chart + narrative commentary</li>
                  <li>Actuarial Assumptions &amp; Plan Design (diversification, turnover, mortality, RMD, salary increase)</li>
                  <li>Participation, Eligibility &amp; Allocations narrative</li>
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
