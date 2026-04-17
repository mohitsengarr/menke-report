import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const kpiCards = [
  { label: 'Estimated Plan Assets', value: '$2.1T', description: 'Total ESOP plan assets in the U.S.' },
  { label: 'Active ESOP Companies', value: '6,411', description: 'Companies with active ESOPs' },
  { label: 'ESOP Participants', value: '10.9M', description: 'Employees participating in ESOPs' },
  { label: 'Avg. Annual Return', value: '9.4%', description: 'Historical ESOP portfolio return' },
]

const marketStats = [
  { metric: 'Total ESOP Plans (active)', value: '6,411' },
  { metric: 'Total Participants', value: '10.9 million' },
  { metric: 'Total Plan Assets', value: '$2.1 trillion' },
  { metric: 'Average Account Balance', value: '$134,000' },
  { metric: 'S-Corp ESOPs', value: '~3,200' },
  { metric: 'C-Corp ESOPs', value: '~3,200' },
  { metric: 'Leveraged ESOPs', value: '~2,500' },
  { metric: 'New ESOPs per Year', value: '~250-300' },
]

const services = [
  'ESOP Feasibility Studies',
  'ESOP Transaction Design & Structuring',
  'ESOP Repurchase Obligation Studies',
  'Employee Communication Programs',
  'ESOP Administration',
  'Annual Valuation Services',
  'Trustee Advisory Services',
  'Post-Transaction Support',
]

const dataPipelineRows = [
  { stage: 'Input', description: 'Excel workbook upload with participant data, plan provisions, and financial assumptions' },
  { stage: 'Processing', description: 'Formula computation engine processes 27+ Excel tabs of interlinked calculations' },
  { stage: 'Analysis', description: 'Valuation projections, repurchase obligations, population analytics, success scoring' },
  { stage: 'Visualization', description: 'Interactive charts, tables, and KPI dashboards for each analytical dimension' },
  { stage: 'Reporting', description: 'PDF and PPTX report generation with executive summaries and detailed breakdowns' },
]

const techStackRows = [
  { layer: 'Frontend', technology: 'Next.js 15, React, Tailwind CSS', purpose: 'Server-rendered UI with responsive design' },
  { layer: 'Backend', technology: 'Next.js API Routes, Supabase Edge Functions', purpose: 'Serverless compute for data processing' },
  { layer: 'Database', technology: 'Supabase (PostgreSQL)', purpose: 'Relational storage with RLS policies' },
  { layer: 'Authentication', technology: 'Supabase Auth', purpose: 'Email/password auth with role-based access' },
  { layer: 'Storage', technology: 'Supabase Storage', purpose: 'Excel file uploads and snapshot storage' },
  { layer: 'Computation', technology: 'ExcelJS', purpose: 'Server-side formula parsing and calculation' },
  { layer: 'Deployment', technology: 'Railway', purpose: 'Docker-based cloud deployment' },
]

const tocItems = [
  'I. Executive Summary',
  'II. Market Context',
  'III. Menke & Associates',
  'IV. Product Overview',
  'V. Technical Architecture',
]

export const metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      {/* Cover */}
      <div className="text-center space-y-4 py-10 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-menke-navy">MenkeReport</h1>
        <p className="text-lg text-gray-600">Product &amp; Market Analysis</p>
        <p className="text-sm text-gray-400 uppercase tracking-widest">
          ESOP Repurchase Obligation Analytics Platform
        </p>
      </div>

      {/* Table of Contents */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-gray-900">Table of Contents</h2>
        <ul className="space-y-1.5 text-sm text-gray-600">
          {tocItems.map((item) => (
            <li key={item} className="pl-2 border-l-2 border-gray-200 py-0.5">
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Section I: Executive Summary */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          I. Executive Summary
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          MenkeReport is a modern web-based analytics platform designed to help ESOP companies,
          trustees, and advisors analyze and manage repurchase obligations. By digitizing the
          complex Excel-based calculation workflows that Menke &amp; Associates has refined over
          decades, MenkeReport delivers real-time projections, interactive visualizations, and
          actionable insights through a clean, accessible interface.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          The ESOP market represents a significant segment of the U.S. retirement benefits
          landscape. With over 6,400 active plans holding more than $2 trillion in assets and
          covering nearly 11 million participants, the need for sophisticated repurchase obligation
          analytics has never been greater.
        </p>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-menke-navy">{kpi.value}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{kpi.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Section II: Market Context */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          II. Market Context
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Employee Stock Ownership Plans have experienced steady growth since their formalization
          under ERISA in 1974. Today, ESOPs are used across diverse industries as a tool for
          business succession, employee retention, and corporate finance optimization.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-700 border-b">Metric</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 border-b">Value</th>
              </tr>
            </thead>
            <tbody>
              {marketStats.map((row) => (
                <tr key={row.metric} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2.5 px-4 text-gray-700">{row.metric}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-gray-900">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section III: Menke & Associates */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          III. Menke &amp; Associates
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Menke &amp; Associates, Inc. is one of the oldest and most experienced ESOP advisory
          firms in the United States. Founded in 1974, the firm has been involved in the design
          and implementation of more ESOPs than any other advisory firm. Menke provides a
          comprehensive suite of services covering the full lifecycle of an ESOP, from initial
          feasibility through ongoing administration and repurchase obligation management.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Core Services</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map((service) => (
              <li
                key={service}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-menke-navy shrink-0" />
                {service}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section IV: Product Overview */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          IV. Product Overview
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          MenkeReport transforms the traditional Excel-based ESOP analytics workflow into a
          cloud-native platform. Users upload their ESOP workbook, and the system processes all
          27+ interlinked worksheets to produce comprehensive projections and analytics.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Data Pipeline</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 border-b w-1/4">Stage</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 border-b">Description</th>
                </tr>
              </thead>
              <tbody>
                {dataPipelineRows.map((row) => (
                  <tr key={row.stage} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-menke-navy">{row.stage}</td>
                    <td className="py-2.5 px-4 text-gray-700">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section V: Technical Architecture */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          V. Technical Architecture
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          MenkeReport is built on a modern, scalable architecture designed for security,
          performance, and maintainability. The platform uses server-side rendering for fast
          initial loads and client-side interactivity for responsive data exploration.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-700 border-b w-1/5">Layer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 border-b w-2/5">Technology</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 border-b">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {techStackRows.map((row) => (
                <tr key={row.layer} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2.5 px-4 font-medium text-menke-navy">{row.layer}</td>
                  <td className="py-2.5 px-4 text-gray-700">{row.technology}</td>
                  <td className="py-2.5 px-4 text-gray-500">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-6">
        MenkeReport v2.0 &mdash; Built for Menke &amp; Associates, Inc.
      </div>
    </div>
  )
}
