'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Reusable form field
// ---------------------------------------------------------------------------
const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

type FieldDef = {
  key: string
  label: string
  type?: 'number' | 'text' | 'date' | 'select'
  options?: string[]
  suffix?: string
}

function FormField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | number
  onChange: (key: string, val: string | number) => void
}) {
  const id = `field-${field.key}`
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {field.label}
        {field.suffix && (
          <span className="ml-1 text-xs text-gray-400">({field.suffix})</span>
        )}
      </label>
      {field.type === 'select' && field.options ? (
        <select
          id={id}
          className={inputCls}
          value={value ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type ?? 'text'}
          className={inputCls}
          value={value ?? ''}
          onChange={(e) =>
            onChange(
              field.key,
              field.type === 'number' ? Number(e.target.value) : e.target.value,
            )
          }
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  'Plan Provisions',
  'Allocations',
  'Distributions',
  'Funding',
  'Valuation Inputs',
  'Share Prices',
] as const
type TabName = (typeof TABS)[number]

const TABLE_MAP: Record<TabName, string> = {
  'Plan Provisions': 'plan_provisions',
  Allocations: 'allocations',
  Distributions: 'distributions',
  Funding: 'funding',
  'Valuation Inputs': 'valuation_inputs',
  'Share Prices': 'beginning_share_prices',
}

const FIELDS: Record<TabName, FieldDef[]> = {
  'Plan Provisions': [
    { key: 'compensation_limit', label: 'Compensation Limit', type: 'number' },
    { key: 'compensation_limit_increase', label: 'Compensation Limit Increase', type: 'number', suffix: '%' },
    { key: 'period_years', label: 'Period (Years)', type: 'number' },
    { key: 'distribution_years', label: 'Distribution Years', type: 'number' },
    { key: 'plan_retirement', label: 'Plan Retirement', type: 'number' },
    { key: 'service_retirement', label: 'Service Retirement', type: 'number' },
    { key: 'compensation_one_year', label: 'Compensation 1-Year', type: 'number', suffix: '%' },
    { key: 'compensation_five_year', label: 'Compensation 5-Year', type: 'number', suffix: '%' },
    { key: 'compensation_ten_year', label: 'Compensation 10-Year', type: 'number', suffix: '%' },
    { key: 'turnover_five_year', label: 'Turnover 5-Year', type: 'text' },
    { key: 'turnover_ten_year', label: 'Turnover 10-Year', type: 'text' },
  ],
  Allocations: [
    { key: 'plan_size', label: 'Plan Size', type: 'select', options: ['Small', 'Medium', 'Large'] },
    { key: 'service_hours', label: 'Service Hours', type: 'number' },
    { key: 'lump_sum_distribution_limit', label: 'Lump Sum Distribution Limit', type: 'number' },
    { key: 'distribution_years', label: 'Distribution Years', type: 'number' },
    { key: 'end_requirement', label: 'End Requirement', type: 'select', options: ['Yes', 'No'] },
    { key: 'one_requirement', label: 'One Requirement', type: 'select', options: ['Yes', 'No'] },
    { key: 'internal_loan_1', label: 'Internal Loan 1', type: 'number' },
    { key: 'internal_loan_1_date', label: 'Internal Loan 1 Date', type: 'date' },
    { key: 'internal_loan_2', label: 'Internal Loan 2', type: 'number' },
    { key: 'internal_loan_2_date', label: 'Internal Loan 2 Date', type: 'date' },
    { key: 'internal_loan_3', label: 'Internal Loan 3', type: 'number' },
    { key: 'internal_loan_3_date', label: 'Internal Loan 3 Date', type: 'date' },
    { key: 'vesting_period', label: 'Vesting Period', type: 'number' },
    { key: 'internal_loan_basis', label: 'Internal Loan Basis', type: 'number' },
    { key: 'oia_annual_return', label: 'OIA Annual Return', type: 'number', suffix: '%' },
    { key: 'annual_esop_contribution', label: 'Annual ESOP Contribution', type: 'number', suffix: '%' },
    { key: 'segregation', label: 'Segregation', type: 'select', options: ['Yes', 'No'] },
  ],
  Distributions: [
    { key: 'in_service_distrib_1_age', label: 'In-Service Distrib 1 Age', type: 'number' },
    { key: 'in_service_distrib_1_amount', label: 'In-Service Distrib 1 Amount', type: 'number', suffix: '%' },
    { key: 'in_service_distrib_2_frequency', label: 'In-Service Distrib 2 Frequency', type: 'number' },
    { key: 'in_service_distrib_2_amount', label: 'In-Service Distrib 2 Amount', type: 'number', suffix: '%' },
    { key: 'esop_formation_date', label: 'ESOP Formation Date', type: 'text' },
    { key: 'divers_year_one', label: 'Diversification Year 1', type: 'number', suffix: '%' },
    { key: 'divers_year_two', label: 'Diversification Year 2', type: 'number', suffix: '%' },
    { key: 'divers_year_three', label: 'Diversification Year 3', type: 'number', suffix: '%' },
    { key: 'divers_year_four', label: 'Diversification Year 4', type: 'number', suffix: '%' },
    { key: 'divers_year_five', label: 'Diversification Year 5', type: 'number', suffix: '%' },
    { key: 'divers_year_final', label: 'Diversification Final', type: 'number', suffix: '%' },
    { key: 'sc_corporation', label: 'S/C Corporation', type: 'select', options: ['S', 'C'] },
  ],
  Funding: [
    { key: 'stub_period', label: 'Stub Period', type: 'number' },
    { key: 'funding_mechanism', label: 'Funding Mechanism', type: 'select', options: ['Redeem', 'OIA'] },
    { key: 's_corp_distributions', label: 'S-Corp Distributions', type: 'number' },
    { key: 'plan_active_frozen', label: 'Plan Active / Frozen', type: 'select', options: ['Active', 'FROZEN'] },
    { key: 'plan_year_end', label: 'Plan Year End', type: 'date' },
  ],
  'Valuation Inputs': [
    { key: 'company_esop_value', label: 'Company ESOP Value', type: 'number' },
    { key: 'total_shares_outstanding', label: 'Total Shares Outstanding', type: 'number' },
    { key: 'total_esop_shares', label: 'Total ESOP Shares', type: 'number' },
    { key: 'ebitda', label: 'EBITDA', type: 'number' },
    { key: 'cap_rate', label: 'Cap Rate', type: 'number', suffix: '%' },
    { key: 'dloc', label: 'DLOC', type: 'number' },
    { key: 'dlom', label: 'DLOM', type: 'number' },
    { key: 'lt_debt', label: 'Long-Term Debt', type: 'number' },
    { key: 'working_capital', label: 'Working Capital', type: 'number' },
    { key: 'excess_cash_assets', label: 'Excess Cash / Assets', type: 'number' },
    { key: 'ebitda_growth_rate', label: 'EBITDA Growth Rate', type: 'number', suffix: '%' },
    { key: 'stage_transaction_year_two', label: 'Stage Transaction Year 2', type: 'text' },
    { key: 'annual_stock_allocation_two', label: 'Annual Stock Allocation 2', type: 'number' },
    { key: 'stage_transaction_year_three', label: 'Stage Transaction Year 3', type: 'text' },
    { key: 'annual_stock_allocation_three', label: 'Annual Stock Allocation 3', type: 'number' },
    { key: 'total_share_second_stage', label: 'Total Share 2nd Stage', type: 'number' },
    { key: 'total_share_third_stage', label: 'Total Share 3rd Stage', type: 'number' },
  ],
  'Share Prices': [
    { key: 'share_price_one', label: 'Share Price Year 1', type: 'number', suffix: '%' },
    { key: 'share_price_two', label: 'Share Price Year 2', type: 'number', suffix: '%' },
    { key: 'share_price_three', label: 'Share Price Year 3', type: 'number', suffix: '%' },
    { key: 'share_price_four', label: 'Share Price Year 4', type: 'number', suffix: '%' },
    { key: 'share_price_five', label: 'Share Price Year 5', type: 'number', suffix: '%' },
    { key: 'share_price_ten', label: 'Share Price Year 10', type: 'number', suffix: '%' },
  ],
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabName>('Plan Provisions')
  const [data, setData] = useState<Record<TabName, Record<string, unknown>>>({
    'Plan Provisions': {},
    Allocations: {},
    Distributions: {},
    Funding: {},
    'Valuation Inputs': {},
    'Share Prices': {},
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // ---- fetch all settings on mount ----
  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const results: Record<string, Record<string, unknown>> = {}

    await Promise.all(
      TABS.map(async (tab) => {
        const table = TABLE_MAP[tab]
        const { data: rows } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user.id)
          .limit(1)
        results[tab] = (rows && rows[0]) ?? {}
      }),
    )

    setData(results as Record<TabName, Record<string, unknown>>)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- save current tab ----
  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const table = TABLE_MAP[activeTab]
      const fields = FIELDS[activeTab]

      // Build payload from only the known field keys
      const payload: Record<string, unknown> = { user_id: user.id }
      for (const f of fields) {
        payload[f.key] = data[activeTab][f.key] ?? (f.type === 'number' ? 0 : '')
      }

      const { error } = await supabase
        .from(table)
        .upsert(payload, { onConflict: 'user_id' })

      if (error) throw error
      setMessage({ type: 'success', text: `${activeTab} saved successfully.` })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  // ---- field change handler ----
  const handleChange = (key: string, val: string | number) => {
    setData((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: val },
    }))
  }

  // ---- render ----
  const currentFields = FIELDS[activeTab]
  const currentData = data[activeTab] ?? {}

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ESOP Settings</h1>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setMessage(null)
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#1B2A4A] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-sm text-gray-400">Loading settings...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              {currentFields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={(currentData[field.key] as string | number) ?? ''}
                  onChange={handleChange}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[#1B2A4A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#243558] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
