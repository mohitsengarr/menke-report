export type Profile = {
  id: string
  username: string
  email: string
  role: 'admin' | 'member'
  status: 'active' | 'inactive'
  avatar_url: string | null
  company_name: string | null
  inc_rate: number
  last_updated_at: string | null
  created_at: string
}

export type PlanProvisions = {
  id: string
  user_id: string
  compensation_limit: number
  compensation_limit_increase: number
  period_years: number
  distribution_years: number
  plan_retirement: number
  service_retirement: number
  compensation_one_year: number
  compensation_five_year: number
  compensation_ten_year: number
  turnover_five_year: string
  turnover_ten_year: string
  updated_at: string
}

export type Allocations = {
  id: string
  user_id: string
  plan_size: string
  service_hours: number
  lump_sum_distribution_limit: number
  distribution_years: number
  end_requirement: string
  one_requirement: string
  internal_loan_1: number
  internal_loan_1_date: string | null
  internal_loan_2: number
  internal_loan_2_date: string | null
  internal_loan_3: number
  internal_loan_3_date: string | null
  vesting_period: number
  internal_loan_basis: number
  oia_annual_return: number
  annual_esop_contribution: number
  segregation: string
  updated_at: string
}

export type Distributions = {
  id: string
  user_id: string
  in_service_distrib_1_age: number
  in_service_distrib_1_amount: number
  in_service_distrib_2_frequency: number
  in_service_distrib_2_amount: number
  esop_formation_date: string
  divers_year_one: number
  divers_year_two: number
  divers_year_three: number
  divers_year_four: number
  divers_year_five: number
  divers_year_final: number
  sc_corporation: string
  updated_at: string
}

export type Funding = {
  id: string
  user_id: string
  stub_period: number
  funding_mechanism: string
  s_corp_distributions: number
  plan_active_frozen: string
  plan_year_end: string
  updated_at: string
}

export type ValuationInputs = {
  id: string
  user_id: string
  company_esop_value: number
  total_shares_outstanding: number
  total_esop_shares: number
  ebitda: number
  cap_rate: number
  dloc: number
  dlom: number
  lt_debt: number
  working_capital: number
  excess_cash_assets: number
  ebitda_growth_rate: number
  stage_transaction_year_two: string | null
  annual_stock_allocation_two: number
  stage_transaction_year_three: string | null
  annual_stock_allocation_three: number
  total_share_second_stage: number
  total_share_third_stage: number
  updated_at: string
}

export type BeginningSharePrices = {
  id: string
  user_id: string
  share_price_one: number
  share_price_two: number
  share_price_three: number
  share_price_four: number
  share_price_five: number
  share_price_ten: number
  updated_at: string
}

export type ValuationProjection = {
  id: string
  user_id: string
  year: string
  esop_valuation: number
  esop_shares: number
  pct_esop_shares: number
  other_shares: number
  pct_other_shares: number
  total_shares: number
  price_per_share: number
  share_price_change: number
}

export type RepurchaseObligation = {
  id: string
  user_id: string
  year: string
  calendar_year_for_payout: string
  share_price: number
  esop_shares_allocated: number
  shares_turned: number
  oia_balance: number
  esop_shares_redeemed: number
  diversification: number
  in_service_distributions: number
  retirement_death_disability: number
  turnover: number
  total_repurchase_obligation: number
  npv: number
}

export type ShareTurnoverSchedule = {
  id: string
  user_id: string
  year: string
  calendar_year_for_payout: string
  diversification: number
  in_service_distributions: number
  retirement_death_disability: number
  turnover: number
  total_shares: number
}

export type PopulationAnalysis = {
  id: string
  user_id: string
  year: string
  active_participants: number
  covered_compensation: number
  avg_cash_compensation: number
  avg_esop_compensation: number
  avg_total_compensation: number
  stock_allocations: number
  cash_contributions: number
  fringe: number
  effective_benefit_rate: number
  share_turn: number
}

export type SuccessScore = {
  id: string
  user_id: string
  year_for_payout: string
  repurchase_obligation: number
  cash_source: number
  surplus_or_deficit: number
  ro_cash_burn: number
  esop_success_score: number
  health_check: number
  key_takeaway: string | null
}

export type Snapshot = {
  id: string
  user_id: string
  company_name: string | null
  snapshot_data: Record<string, unknown>
  excel_storage_path: string | null
  notes: string | null
  created_at: string
}

export type InputData = {
  id: string
  user_id: string
  row_number: number
  ss_num: string | null
  ss_seq: string | null
  name: string | null
  loc_no: string | null
  div_no: string | null
  birth_date: string | null
  hire_date: string | null
  esop_date: string | null
  vesting_pct: number
  comp_years: number
  gender: string | null
  plan_comp: number
  emp_group: number
  divers: number
  sra: string | null
  term_date: string | null
  reason: string | null
  nonvested: string | null
  oia_tranche: number
  total_cash: number
  stock_tranche: number
  shares: number[]
  diversifications: number[]
  p_diver_years: string[]
  p_diver_shares: number[]
}
