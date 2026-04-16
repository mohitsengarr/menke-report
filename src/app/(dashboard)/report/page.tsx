'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FileSpreadsheet, Eye } from 'lucide-react'

export default function ReportPage() {
  const [title, setTitle] = useState('ESOP Repurchase Obligation Analysis')
  const [subtitle, setSubtitle] = useState('')
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [executiveSummary, setExecutiveSummary] = useState('')

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

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
                placeholder="Enter the executive summary for your report..."
                rows={5}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <div className="relative group">
                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed"
                >
                  <FileText className="h-4 w-4" />
                  Generate PDF
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                  <div className="rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white whitespace-nowrap shadow-lg">
                    Coming soon - Phase 5
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
              <div className="relative group">
                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Generate PPTX
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                  <div className="rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white whitespace-nowrap shadow-lg">
                    Coming soon - Phase 5
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
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
              <div className="flex flex-col items-center justify-center p-8 min-h-[400px] text-center space-y-6">
                <div className="w-16 h-1 bg-[#1B2A4A] rounded-full" />
                <div>
                  <h2 className="text-xl font-bold text-[#1B2A4A] leading-tight">
                    {title || 'Untitled Report'}
                  </h2>
                  {subtitle && (
                    <p className="text-sm text-gray-500 mt-2">{subtitle}</p>
                  )}
                </div>
                <div className="w-12 h-px bg-gray-300" />
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Prepared by</p>
                  <p className="text-sm font-medium text-gray-700">Menke &amp; Associates, Inc.</p>
                </div>
                {reportDate && (
                  <p className="text-xs text-gray-400">
                    {new Date(reportDate + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
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

              {/* Mock sections indicator */}
              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-lg">
                <p className="text-xs text-gray-400 text-center">
                  Report sections (Valuation, Repurchase, Population, Success Score) will be
                  auto-generated from your data in Phase 5.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
