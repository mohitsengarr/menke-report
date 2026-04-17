import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FORMULA_CONFIG_REGISTRY, CONFIG_CATEGORIES } from '@/lib/formulas/config'

/* ------------------------------------------------------------------ */
/*  Data: Pipeline Steps                                               */
/* ------------------------------------------------------------------ */

const pipelineSteps = [
  {
    step: 1,
    name: 'Data Ingestion',
    description:
      'Participant census data is extracted from the uploaded Excel workbook. Each row represents one plan participant with demographic, employment, and financial data across 27+ interlinked worksheets.',
    inputs: 'Excel workbook (.xlsx)',
    outputs: 'Normalized participant array',
  },
  {
    step: 2,
    name: 'Base Calculations',
    description:
      'One-time, per-participant fields are computed: vesting, account values, separation dates, eligibility flags, and initial distributions. These 47 formulas run once per participant.',
    inputs: 'Raw participant record + plan settings',
    outputs: '47 computed fields per participant',
  },
  {
    step: 3,
    name: '11-Year Projection Loop',
    description:
      'For each participant, the engine iterates through 11 projection years (Year 0 through Year 10). Each year applies 39 formulas that model compensation growth, share allocations, distributions, and account value changes.',
    inputs: 'Base calculations + prior-year state',
    outputs: '39 fields x 11 years per participant',
  },
  {
    step: 4,
    name: 'Aggregation',
    description:
      'Individual participant projections are summed, averaged, and counted across the entire plan population to produce plan-level totals for each projection year.',
    inputs: 'All participant-year projections',
    outputs: 'Plan-level aggregates by year',
  },
  {
    step: 5,
    name: 'Output Generation',
    description:
      'Aggregated data is formatted into 7 analytical tables: Capital Table & Valuation, Share Turnover Schedule, Repurchase Obligation, Population Analysis, Population Projection, Average Age & Tenure, and ESOP Success Score.',
    inputs: 'Aggregated plan-level data',
    outputs: '7 analytical output tables',
  },
]

/* ------------------------------------------------------------------ */
/*  Data: Base Participant Formulas                                    */
/* ------------------------------------------------------------------ */

const baseFormulas: {
  id: string
  name: string
  description: string
  formula: string
  inputs: string
  outputType: string
}[] = [
  {
    id: 'BJ',
    name: 'Vesting Period',
    description: "Plan's vesting cliff or graded period length",
    formula: 'From plan settings H17',
    inputs: 'Plan settings',
    outputType: 'Integer (years)',
  },
  {
    id: 'BK',
    name: 'Cash Balance',
    description: "Participant's total cash balance in ESOP account",
    formula: 'Direct from column T',
    inputs: 'Census column T',
    outputType: 'Currency',
  },
  {
    id: 'BL',
    name: 'Total Shares',
    description: 'Sum of all 10 years of share allocations',
    formula: 'SUM(shr1..shr10)',
    inputs: 'shr1, shr2, ... shr10',
    outputType: 'Number (shares)',
  },
  {
    id: 'BM',
    name: 'Total Account Value',
    description: 'Combined cash and share value at current price',
    formula: 'BK + BL x SharePrice[0]',
    inputs: 'BK, BL, SharePrice',
    outputType: 'Currency',
  },
  {
    id: 'BN',
    name: 'Prior Distributions',
    description: 'Negative sum of all historical cash-out distributions',
    formula: '-SUM(diver1..diver10)',
    inputs: 'diver1, diver2, ... diver10',
    outputType: 'Currency (negative)',
  },
  {
    id: 'BO',
    name: 'Ownership Percentage',
    description: 'Vested account value as percentage of plan total',
    formula: 'BM x (vestingPct / 100)',
    inputs: 'BM, vestingPct',
    outputType: 'Currency',
  },
  {
    id: 'BP',
    name: 'Highly Compensated Flag',
    description: 'Whether participant is in top 10% by account value',
    formula: 'BM > PERCENTILE(allBM, 0.9)',
    inputs: 'BM, all participant BM values',
    outputType: 'Boolean',
  },
  {
    id: 'BQ',
    name: 'Age at Valuation',
    description: 'Current age of participant at valuation date',
    formula: '(valuationDate - DOB) / 365.25',
    inputs: 'valuationDate, DOB',
    outputType: 'Decimal (years)',
  },
  {
    id: 'BR',
    name: 'Normal Retirement Age',
    description: 'Plan-defined normal retirement age',
    formula: 'From settings B11',
    inputs: 'Plan settings',
    outputType: 'Integer (age)',
  },
  {
    id: 'BS',
    name: 'Separation Date',
    description: 'Expected date of plan exit',
    formula: 'If terminated: termDate; else DOB + retAge',
    inputs: 'termDate, DOB, retAge, status',
    outputType: 'Date',
  },
  {
    id: 'BT',
    name: 'Separation Reason',
    description: 'Categorized reason for plan departure',
    formula: 'If manual: reason; else "RETIREMENT"',
    inputs: 'Manual reason, status',
    outputType: 'Enum (string)',
  },
  {
    id: 'BU',
    name: 'Service at Separation',
    description: 'Total years of service from hire to exit',
    formula: '(separationDate - hireDate) / 365',
    inputs: 'separationDate, hireDate',
    outputType: 'Decimal (years)',
  },
  {
    id: 'BV',
    name: 'Age at Turnover',
    description: 'Age at time of separation if reason is turnover',
    formula: '(separationDate - DOB) / 365.25',
    inputs: 'separationDate, DOB',
    outputType: 'Decimal (years)',
  },
  {
    id: 'BW',
    name: 'Left This Year',
    description: 'Whether turnover occurred in the current plan year',
    formula: 'BS within current year AND reason = TURNOVER',
    inputs: 'BS, currentYear, BT',
    outputType: 'Boolean',
  },
  {
    id: 'BX',
    name: 'Retirement Eligible',
    description: 'Meets plan age and service requirements for retirement',
    formula: 'reason = RETIREMENT AND service >= minService',
    inputs: 'BT, BU, minService',
    outputType: 'Boolean',
  },
  {
    id: 'BY',
    name: 'Research Flag',
    description: 'Ineligible retiree needing manual review',
    formula: 'reason = RETIREMENT AND NOT eligible',
    inputs: 'BT, BX',
    outputType: 'Boolean',
  },
  {
    id: 'BZ',
    name: 'Lump Sum Distribution',
    description: 'Small balance cash-out for terminated participants',
    formula: 'If terminated AND balance < threshold',
    inputs: 'status, BM, threshold',
    outputType: 'Boolean',
  },
  {
    id: 'CA',
    name: 'Alive in Plan',
    description: 'Whether participant is currently in the plan',
    formula: 'Born before valuation AND not yet separated',
    inputs: 'DOB, valuationDate, BS',
    outputType: 'Boolean',
  },
  {
    id: 'CB',
    name: 'Active Participant',
    description: 'Has account value and has not yet separated',
    formula: 'BM > 0 AND not past separation',
    inputs: 'BM, BS, valuationDate',
    outputType: 'Boolean',
  },
  {
    id: 'CC',
    name: 'Annualized Compensation',
    description: 'Full-year salary equivalent, prorated if < 1 year',
    formula: 'If <1 year service: prorate; else raw salary',
    inputs: 'salary, hireDate, valuationDate',
    outputType: 'Currency',
  },
  {
    id: 'CD',
    name: 'Active Compensation',
    description: 'Compensation counted only for active participants',
    formula: 'If active: annualized; else 0',
    inputs: 'CB, CC',
    outputType: 'Currency',
  },
  {
    id: 'CE',
    name: 'Years Since Sep (Ret/Death)',
    description: 'Years elapsed since separation for retirees and deceased',
    formula: '(valuationDate - separationDate) / 365.25',
    inputs: 'valuationDate, BS, BT',
    outputType: 'Decimal (years)',
  },
  {
    id: 'CF',
    name: 'Years Since Sep (Turnover)',
    description: 'Capped years since separation for turnover distributions',
    formula: 'MIN(yearsSinceSep, maxDistYears)',
    inputs: 'CE, maxDistYears',
    outputType: 'Decimal (years)',
  },
  {
    id: 'CG',
    name: 'Projected Compensation',
    description: 'Salary with annual raise applied',
    formula: 'annualizedComp x (1 + raiseRate)',
    inputs: 'CC, raiseRate',
    outputType: 'Currency',
  },
  {
    id: 'CH',
    name: 'Cash Repurchase',
    description: 'Amortized cash payout over distribution period',
    formula: 'Terminated: -cash / payoutPeriod; Active: Sarason-adjusted',
    inputs: 'BK, payoutPeriod, Sarason tables',
    outputType: 'Currency',
  },
  {
    id: 'CI',
    name: 'Net Cash',
    description: 'Cash balance after repurchase obligation',
    formula: 'cash + cashRepurchase',
    inputs: 'BK, CH',
    outputType: 'Currency',
  },
  {
    id: 'CJ',
    name: 'Share Repurchase',
    description: 'Shares distributed based on turnover and diversification',
    formula: 'Based on turnover years and diversification',
    inputs: 'BL, CF, diversRate',
    outputType: 'Number (shares)',
  },
  {
    id: 'CK',
    name: 'Vesting Adjustment',
    description: 'Unvested share forfeiture upon separation',
    formula: 'If not 100% vested: -vestingPct x shareRepurchase',
    inputs: 'vestingPct, CJ',
    outputType: 'Number (shares)',
  },
  {
    id: 'CL',
    name: 'Net Share Repurchase',
    description: 'Share distribution after vesting adjustment',
    formula: 'shareRepurchase + vestingAdjust',
    inputs: 'CJ, CK',
    outputType: 'Number (shares)',
  },
  {
    id: 'CM',
    name: 'Early Retirement Dist',
    description: 'Distribution based on diversification rate for eligible retirees',
    formula: 'Shares x diversification rate (if eligible)',
    inputs: 'BL, diversRate, BX',
    outputType: 'Number (shares)',
  },
  {
    id: 'CN',
    name: 'Death Benefit Dist',
    description: 'Mortality-adjusted distribution of shares',
    formula: 'Shares x mortality rate',
    inputs: 'BL, mortalityRate',
    outputType: 'Number (shares)',
  },
  {
    id: 'CO',
    name: 'RMD Distribution',
    description: 'Required Minimum Distribution for participants age 72+',
    formula: 'If age >= 72: -shares / lifeExpectancy',
    inputs: 'BQ, BL, lifeExpectancy table',
    outputType: 'Number (shares)',
  },
  {
    id: 'CP',
    name: 'Total Share Distribution',
    description: 'Aggregate of all share distribution types',
    formula: 'SUM(CL, CM, CN, CO)',
    inputs: 'CL, CM, CN, CO',
    outputType: 'Number (shares)',
  },
  {
    id: 'CQ',
    name: 'New Share Allocation',
    description: 'Pro-rata new shares based on compensation ratio',
    formula: 'If not frozen: totalAlloc x (comp / totalComp)',
    inputs: 'totalAlloc, CD, totalComp, frozenFlag',
    outputType: 'Number (shares)',
  },
  {
    id: 'CR',
    name: 'End-of-Year Shares',
    description: 'Closing share balance after distributions and allocations',
    formula: 'shares + distributions + allocation',
    inputs: 'BL, CP, CQ',
    outputType: 'Number (shares)',
  },
  {
    id: 'CS',
    name: 'Cumulative Distributions',
    description: 'Running total of all prior distributions',
    formula: 'priorDist + earlyRetirement',
    inputs: 'BN, CM',
    outputType: 'Currency',
  },
  {
    id: 'CT',
    name: 'OIA Income',
    description: 'Other Investment Account return allocation',
    formula: 'If OIA plan: proportional allocation',
    inputs: 'OIA flag, allocation ratio',
    outputType: 'Currency',
  },
  {
    id: 'CU',
    name: 'Cash RMD',
    description: 'Cash Required Minimum Distribution for age 72+',
    formula: 'If age >= 72: -cash / lifeExpectancy',
    inputs: 'BQ, BK, lifeExpectancy table',
    outputType: 'Currency',
  },
  {
    id: 'CV',
    name: 'Contribution Reallocation',
    description: 'Dividend income distribution to participants',
    formula: 'dividendRate x priceRatio x (comp / totalComp)',
    inputs: 'dividendRate, priceRatio, CD, totalComp',
    outputType: 'Currency',
  },
  {
    id: 'CW',
    name: 'Tax Benefit Pass-through',
    description: 'S-Corp tax deduction passed to participants',
    formula: 'taxAmount x (shares / totalShares)',
    inputs: 'taxAmount, CR, totalShares',
    outputType: 'Currency',
  },
  {
    id: 'CX',
    name: 'Total Account Value',
    description: 'Year-end total account including all cash flows and return',
    formula: '(netCash + OIA + cashDist + contrib + tax) x (1 + returnRate)',
    inputs: 'CI, CT, CU, CV, CW, returnRate',
    outputType: 'Currency',
  },
  {
    id: 'CY',
    name: 'Share Value',
    description: 'Year-end market value of shares held',
    formula: 'endShares x sharePrice',
    inputs: 'CR, sharePrice[year]',
    outputType: 'Currency',
  },
  {
    id: 'CZ',
    name: 'Repurchase Obligation',
    description: 'Total repurchase obligation for this participant',
    formula: '(accountValue + shareValue) x vestingPct',
    inputs: 'CX, CY, vestingPct',
    outputType: 'Currency',
  },
  {
    id: 'DA',
    name: 'Age at Valuation',
    description: 'Age recalculated for the projection year',
    formula: '(yearDate - DOB) / 365.25',
    inputs: 'yearDate, DOB',
    outputType: 'Decimal (years)',
  },
  {
    id: 'DB',
    name: 'Active Age',
    description: 'Age used for averaging (active participants only)',
    formula: 'If active: age; else 0',
    inputs: 'CB, DA',
    outputType: 'Decimal (years)',
  },
  {
    id: 'DC',
    name: 'Years of Service',
    description: 'Cumulative service years from hire to projection year',
    formula: '(valuationDate - hireDate) / 365',
    inputs: 'valuationDate, hireDate',
    outputType: 'Decimal (years)',
  },
]

/* ------------------------------------------------------------------ */
/*  Data: Actuarial Tables                                             */
/* ------------------------------------------------------------------ */

const actuarialTables = [
  {
    name: 'Sarason T-Tables',
    purpose:
      'Determine the present value of future distribution obligations. The Sarason T-Tables provide annuity factors used to amortize lump-sum cash repurchase obligations over the plan-defined distribution period.',
    lookup:
      'Indexed by participant age and distribution period length. The engine selects the appropriate T-table value based on the participant separation age and the number of installment years remaining.',
    usage:
      'Applied to terminated participants receiving installment distributions (formula CH). Used when the plan specifies installment payouts rather than lump-sum distributions.',
  },
  {
    name: 'IRS 417(e)(3) Mortality Table',
    purpose:
      'Mandated by IRC Section 417(e)(3) for calculating the present value of qualified retirement plan distributions. Provides gender-neutral mortality rates used in lump-sum equivalency calculations.',
    lookup:
      'Indexed by participant age. Returns the probability of survival to each future age, which is used to weight expected future cash flows in the distribution present-value calculation.',
    usage:
      'Applied to death benefit distributions (formula CN). Required for ERISA compliance when converting annuity values to lump sums.',
  },
  {
    name: 'IRS Uniform Life Expectancy (RMD)',
    purpose:
      'Used to calculate Required Minimum Distributions under IRC Section 401(a)(9). Participants who reach age 72 must begin receiving minimum annual distributions from their ESOP accounts.',
    lookup:
      'Indexed by participant age (starting at 72). Returns the distribution period divisor, which represents the expected number of remaining years of life. The account balance is divided by this divisor to determine the minimum annual distribution.',
    usage:
      'Applied to RMD calculations for both shares (formula CO) and cash (formula CU). Automatically triggered when DA >= 72.',
  },
]

/* ------------------------------------------------------------------ */
/*  Data: Vesting Schedules                                            */
/* ------------------------------------------------------------------ */

const vestingSchedules = {
  headers: ['Year of Service', '1-Year Cliff', '3-Year Cliff', '6-Year Graded'],
  rows: [
    ['< 1', '0%', '0%', '0%'],
    ['1', '100%', '0%', '0%'],
    ['2', '100%', '0%', '20%'],
    ['3', '100%', '100%', '40%'],
    ['4', '100%', '100%', '60%'],
    ['5', '100%', '100%', '80%'],
    ['6+', '100%', '100%', '100%'],
  ],
}

/* ------------------------------------------------------------------ */
/*  Data: Aggregation Outputs                                          */
/* ------------------------------------------------------------------ */

const aggregationOutputs = [
  {
    table: 'Capital Table & Valuation',
    method: 'SUM of share values, total shares outstanding, and derived price per share for each projection year',
    keyFormulas: 'SUM(CY) by year, SUM(CR) by year, Price = SUM(CY) / SUM(CR)',
  },
  {
    table: 'Share Turnover Schedule',
    method: 'SUM of all share distributions by driver category (turnover, retirement, death, RMD, diversification) per year',
    keyFormulas: 'SUM(CL) turnover, SUM(CM) retirement, SUM(CN) death, SUM(CO) RMD by year',
  },
  {
    table: 'Repurchase Obligation',
    method: 'SUM of total repurchase obligation across all participants, broken down by distribution driver',
    keyFormulas: 'SUM(CZ) total, segmented by BT category per year',
  },
  {
    table: 'Population Analysis',
    method: 'COUNT of active participants, AVG of compensation, AVG of benefit rate (allocation / compensation)',
    keyFormulas: 'COUNT(CB=true), AVG(CD where CB=true), AVG(CQ x price / CD)',
  },
  {
    table: 'Population Projection',
    method: 'Projected headcount by status category (active, retired, terminated, deceased) for each year',
    keyFormulas: 'COUNT by BT group per year, net of new separations',
  },
  {
    table: 'Average Age & Tenure',
    method: 'Weighted averages of participant age and service years, split by active vs. terminated populations',
    keyFormulas: 'AVG(DB where CB=true), AVG(DC where CB=true), similar for terminated',
  },
  {
    table: 'ESOP Success Score',
    method: 'Cash sources vs. repurchase obligation, surplus/deficit, and burn rate analysis',
    keyFormulas: 'Cash sources (contributions + dividends + recycled shares) - SUM(CZ); burn rate = RO / cash sources',
  },
]

/* ------------------------------------------------------------------ */
/*  Data: Stats for header cards                                       */
/* ------------------------------------------------------------------ */

const engineStats = [
  { label: 'Total Formulas', value: '958', detail: '47 base + 39 x 11 years + aggregation' },
  { label: 'Per Participant', value: '476', detail: '47 base + 39 x 11 year projections' },
  { label: 'Projection Years', value: '11', detail: 'Year 0 (current) through Year 10' },
  { label: 'Output Tables', value: '7', detail: 'Valuation, RO, Population, Success Score' },
]

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export const metadata = { title: 'Formula Engine' }

export default async function FormulasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  let overrideCount = 0
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase
        .from('formula_configs')
        .select('config_key', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ])
    isAdmin = profile?.role === 'admin'
    overrideCount = count ?? 0
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-12">
      {/* ---- Header ---- */}
      <div className="text-center space-y-4 py-10 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-menke-navy">Formula Engine Documentation</h1>
        <p className="text-lg text-gray-600">
          Complete reference for all 958 ESOP projection calculations
        </p>
        <p className="text-sm text-gray-400 uppercase tracking-widest">
          Menke &amp; Associates Repurchase Obligation Engine
        </p>
        {isAdmin && (
          <div className="inline-flex items-center gap-3 pt-2">
            <Link
              href="/formulas/edit"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-menke-navy text-white rounded-md hover:bg-menke-navy-light transition-colors"
            >
              Edit Formula Parameters
              <span className="text-xs opacity-80">({FORMULA_CONFIG_REGISTRY.length} tunable)</span>
            </Link>
            {overrideCount > 0 && (
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                {overrideCount} customized
              </span>
            )}
          </div>
        )}
      </div>

      {/* ---- Admin quick-jump bar ---- */}
      {isAdmin && (
        <section className="space-y-3 border border-gray-200 rounded-lg p-5 bg-gray-50/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-menke-navy">Admin: Tunable Parameters</h2>
            <Link
              href="/formulas/edit"
              className="text-sm text-menke-navy hover:underline"
            >
              Open editor &rarr;
            </Link>
          </div>
          <p className="text-sm text-gray-600">
            The calculation engine exposes {FORMULA_CONFIG_REGISTRY.length} admin-editable parameters
            (thresholds, growth rates, age limits, distribution percentages, score tiers). Each
            parameter ships with a safe default and can be overridden per account. All changes are
            logged to the audit table.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {CONFIG_CATEGORIES.map(c => {
              const n = FORMULA_CONFIG_REGISTRY.filter(d => d.category === c.id).length
              return (
                <div key={c.id} className="flex items-baseline justify-between text-xs text-gray-700 bg-white border border-gray-200 rounded-md px-3 py-2">
                  <span>{c.label}</span>
                  <span className="font-mono font-semibold text-menke-navy">{n}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ---- Engine Stats Cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {engineStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-menke-navy">{stat.value}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ============================================================ */}
      {/* Section 1: Calculation Pipeline Overview                      */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          1. Calculation Pipeline Overview
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          The ESOP projection engine follows a strict 5-step pipeline. Each uploaded workbook
          passes through data ingestion, base calculations, an 11-year projection loop, plan-level
          aggregation, and finally output generation. Understanding this pipeline is essential for
          interpreting the formulas documented below.
        </p>

        <div className="space-y-4">
          {pipelineSteps.map((step) => (
            <div key={step.step} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-menke-navy text-white flex items-center justify-center text-sm font-bold">
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-menke-navy">{step.name}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
                <div className="flex gap-6 mt-2 text-xs text-gray-400">
                  <span>
                    <span className="font-medium text-gray-500">In:</span> {step.inputs}
                  </span>
                  <span>
                    <span className="font-medium text-gray-500">Out:</span> {step.outputs}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* Section 2: Base Participant Calculations                      */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          2. Base Participant Calculations (47 Formulas)
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          These formulas are computed once per participant during Step 2 of the pipeline. They
          establish the baseline demographic, employment, and financial state for each individual
          before the year-over-year projection loop begins.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-menke-navy text-white">
                <th className="text-left py-3 px-3 font-medium border-b border-menke-navy-light w-12">ID</th>
                <th className="text-left py-3 px-3 font-medium border-b border-menke-navy-light w-40">Name</th>
                <th className="text-left py-3 px-3 font-medium border-b border-menke-navy-light">Description</th>
                <th className="text-left py-3 px-3 font-medium border-b border-menke-navy-light w-56">Formula</th>
                <th className="text-left py-3 px-3 font-medium border-b border-menke-navy-light w-40">Inputs</th>
                <th className="text-left py-3 px-3 font-medium border-b border-menke-navy-light w-32">Output Type</th>
              </tr>
            </thead>
            <tbody>
              {baseFormulas.map((f, i) => (
                <tr
                  key={f.id}
                  className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/50`}
                >
                  <td className="py-2 px-3 font-mono text-xs font-bold text-menke-navy">{f.id}</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{f.name}</td>
                  <td className="py-2 px-3 text-gray-600">{f.description}</td>
                  <td className="py-2 px-3 font-mono text-xs text-gray-700 bg-gray-50/50">{f.formula}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{f.inputs}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{f.outputType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Section 3: Actuarial Lookups                                  */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          3. Actuarial Lookup Tables
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Several formulas depend on actuarial lookup tables mandated by the IRS or established by
          actuarial standards. These tables are embedded in the engine and are used as reference
          data during the projection calculations.
        </p>

        <div className="space-y-6">
          {actuarialTables.map((table) => (
            <Card key={table.name}>
              <CardHeader>
                <CardTitle className="text-menke-navy">{table.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Purpose</p>
                  <p className="text-sm text-gray-700">{table.purpose}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Lookup Method</p>
                  <p className="text-sm text-gray-700">{table.lookup}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">When Used</p>
                  <p className="text-sm text-gray-700">{table.usage}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* Section 4: Repeating Year Template                            */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          4. Repeating Year Template (Years 0-10)
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          After base calculations are complete, the engine enters the projection loop. The same
          set of 39 formulas is evaluated for each participant across 11 projection years (Year 0
          through Year 10). Each iteration carries forward the prior year&apos;s closing balances as
          the opening state.
        </p>

        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-menke-navy">39</p>
                <p className="text-xs text-gray-600 mt-1">Formulas per year</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-menke-navy">11</p>
                <p className="text-xs text-gray-600 mt-1">Projection years</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-menke-navy">429</p>
                <p className="text-xs text-gray-600 mt-1">Per-participant year calcs</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <h3 className="font-semibold text-menke-navy">How the Year Template Works</h3>
              <p>
                Each year template operates on the same logical formulas (CG through DC) but with
                shifted input references. Year 1 reads from Year 0&apos;s closing values, Year 2 from
                Year 1, and so on. This creates the chain of dependencies that models the multi-year
                projection.
              </p>

              <h3 className="font-semibold text-menke-navy">Key Year-over-Year Formulas</h3>
              <ul className="space-y-1.5 text-gray-600 ml-4">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-menke-navy shrink-0" />
                  <span><span className="font-medium">CG (Projected Compensation):</span> Prior year comp x (1 + raise rate) -- compounds annually</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-menke-navy shrink-0" />
                  <span><span className="font-medium">CR (End-of-Year Shares):</span> Prior year shares + distributions + new allocations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-menke-navy shrink-0" />
                  <span><span className="font-medium">CX (Total Account Value):</span> All cash flows summed and grown by return rate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-menke-navy shrink-0" />
                  <span><span className="font-medium">CY (Share Value):</span> Shares x projected share price for that year</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-menke-navy shrink-0" />
                  <span><span className="font-medium">CZ (Repurchase Obligation):</span> Total vested account value -- the key output</span>
                </li>
              </ul>

              <h3 className="font-semibold text-menke-navy">Separation and Mortality Events</h3>
              <p>
                As years progress, participants may cross separation thresholds (reaching retirement
                age, triggering turnover events, or mortality). The year template checks eligibility
                conditions at each step and activates the appropriate distribution formulas (CM, CN,
                CO) when triggered.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Section 5: Aggregation Formulas                               */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          5. Aggregation Formulas
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          After all participant-level projections are computed, the engine aggregates individual
          results into plan-level totals for each projection year. These aggregates populate the 7
          output tables displayed in the application.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-menke-navy text-white">
                <th className="text-left py-3 px-4 font-medium border-b border-menke-navy-light w-1/4">Output Table</th>
                <th className="text-left py-3 px-4 font-medium border-b border-menke-navy-light">Aggregation Method</th>
                <th className="text-left py-3 px-4 font-medium border-b border-menke-navy-light w-1/3">Key Formulas</th>
              </tr>
            </thead>
            <tbody>
              {aggregationOutputs.map((row, i) => (
                <tr
                  key={row.table}
                  className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/50`}
                >
                  <td className="py-2.5 px-4 font-medium text-menke-navy">{row.table}</td>
                  <td className="py-2.5 px-4 text-gray-700">{row.method}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-gray-600">{row.keyFormulas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Section 6: Vesting Schedule                                   */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-menke-navy border-b border-gray-200 pb-2">
          6. Vesting Schedules
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Vesting determines what percentage of a participant&apos;s account they are entitled to
          upon separation. The engine supports three standard vesting schedules, configured per
          plan in settings. The vesting percentage directly affects the Vesting Adjustment formula
          (CK) and the Repurchase Obligation formula (CZ).
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-menke-navy text-white">
                {vestingSchedules.headers.map((h) => (
                  <th key={h} className="text-center py-3 px-4 font-medium border-b border-menke-navy-light">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vestingSchedules.rows.map((row, i) => (
                <tr
                  key={row[0]}
                  className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`py-2.5 px-4 text-center ${
                        j === 0
                          ? 'font-medium text-menke-navy'
                          : cell === '100%'
                            ? 'text-green-700 font-medium'
                            : cell === '0%'
                              ? 'text-gray-400'
                              : 'text-blue-700 font-medium'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold text-menke-navy">1-Year Cliff</h4>
              <p className="text-xs text-gray-500 mt-1">
                Participant is 0% vested until completing 1 full year of service, then immediately
                becomes 100% vested. Simplest schedule, common in smaller plans.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold text-menke-navy">3-Year Cliff</h4>
              <p className="text-xs text-gray-500 mt-1">
                Participant is 0% vested until completing 3 full years of service, then immediately
                becomes 100% vested. Standard ERISA-compliant cliff schedule.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold text-menke-navy">6-Year Graded</h4>
              <p className="text-xs text-gray-500 mt-1">
                Vesting increases 20% per year starting at year 2, reaching 100% at year 6. Provides
                a retention incentive over a longer period. Maximum ERISA-allowed graded schedule.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---- About the Engine (footer section) ---- */}
      <section className="space-y-4 border-t border-gray-200 pt-8">
        <h2 className="text-xl font-bold text-menke-navy">About the Engine</h2>
        <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
          <p>
            The MenkeReport calculation engine is a TypeScript reimplementation of the Excel-based
            ESOP projection model that Menke &amp; Associates has refined over decades of actuarial
            consulting. The engine processes the same 27+ interlinked worksheets that the original
            Excel workbook contains, but runs entirely server-side in a deterministic,
            reproducible pipeline.
          </p>
          <p>
            Each formula in this documentation corresponds to a named column in the original Excel
            workbook (columns BJ through DC in the participant calculation sheet). The formula IDs
            preserve the original Excel column references to maintain traceability between the
            digital platform and the source workbook.
          </p>
          <p>
            The total formula count of 958 is derived from: 47 base per-participant formulas + (39
            repeating year formulas x 11 projection years = 429) + plan-level aggregation formulas
            that produce the 7 output tables. For a plan with N participants, the engine evaluates
            476 x N individual calculations plus the aggregation layer.
          </p>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-6">
        MenkeReport Formula Engine Documentation &mdash; v2.0
      </div>
    </div>
  )
}
