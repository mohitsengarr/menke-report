import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { runFormulaEngine, type ParticipantInput, type PlanSettings } from '@/lib/formulas/engine'

/**
 * Processes an uploaded ESOP Excel workbook:
 * 1. Opens the workbook from Supabase Storage
 * 2. Reads all 3 worksheets
 * 3. Extracts participant data, settings, and analytical outputs
 * 4. Stores everything in Supabase tables
 */
export async function processExcelWorkbook(userId: string, fileBuffer: Buffer) {
  const supabase = await createClient()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer)

  const ws0 = workbook.worksheets[0] // RO10 Workbook Input
  const ws1 = workbook.worksheets[1] // RO Tab Input and Output
  const ws2 = workbook.worksheets[2] // 10 Year Score Input and Output

  if (!ws0 || !ws1 || !ws2) {
    throw new Error('Workbook must have at least 3 worksheets')
  }

  // Extract company name from A1
  const companyName = String(ws0.getCell('A1').value || '')

  // ──────────────────────────────────────────
  // 1. Extract participant data (ws0, rows 9+)
  // ──────────────────────────────────────────
  const participants = extractParticipants(ws0)

  // ──────────────────────────────────────────
  // 2. Extract settings from ws1
  // ──────────────────────────────────────────
  const provisions = extractProvisions(ws1)
  const allocations = extractAllocations(ws1)
  const distributions = extractDistributions(ws1)
  const funding = extractFunding(ws1)
  const valuationInputs = extractValuationInputs(ws1)
  const beginningPrices = extractBeginningPrices(ws1)

  // ──────────────────────────────────────────
  // 3. Run TypeScript Formula Engine (replaces Excel formula computation)
  // ──────────────────────────────────────────
  // Convert extracted data into formula engine inputs
  const engineParticipants: ParticipantInput[] = participants.map(p => ({
    row_number: p.row_number,
    name: p.name,
    birth_date: p.birth_date,
    hire_date: p.hire_date,
    esop_date: p.esop_date,
    term_date: p.term_date,
    reason: p.reason,
    vesting_pct: p.vesting_pct,
    plan_comp: p.plan_comp,
    total_cash: p.total_cash,
    shares: p.shares || [],
    diversifications: p.diversifications || [],
    gender: p.gender,
    nonvested: p.nonvested,
    oia_tranche: p.oia_tranche || 0,
    stock_tranche: p.stock_tranche || 0,
    divers: p.divers || 0,
    comp_years: p.comp_years || 0,
  }))

  // Build share prices from beginning prices (compound growth for 11 years)
  const basePrice = valuationInputs.company_esop_value / (valuationInputs.total_esop_shares || 1)
  const priceGrowthRates = [
    beginningPrices.share_price_one, beginningPrices.share_price_two,
    beginningPrices.share_price_three, beginningPrices.share_price_four,
    beginningPrices.share_price_five,
    beginningPrices.share_price_ten, beginningPrices.share_price_ten,
    beginningPrices.share_price_ten, beginningPrices.share_price_ten,
    beginningPrices.share_price_ten, beginningPrices.share_price_ten,
  ]
  const sharePrices: number[] = [basePrice]
  for (let i = 0; i < 10; i++) {
    sharePrices.push(sharePrices[i]! * (1 + (priceGrowthRates[i] || 0.05)))
  }

  const engineSettings: PlanSettings = {
    compensationLimit: provisions.compensation_limit,
    compensationLimitIncrease: provisions.compensation_limit_increase,
    periodYears: provisions.period_years,
    distributionYears: provisions.distribution_years,
    planRetirement: provisions.plan_retirement,
    serviceRetirement: provisions.service_retirement,
    compGrowthRates: [provisions.compensation_one_year, provisions.compensation_five_year, provisions.compensation_ten_year],
    turnoverTable: provisions.turnover_five_year || 'T-1',
    vestingPeriod: allocations.vesting_period,
    lumpSumLimit: allocations.lump_sum_distribution_limit,
    serviceHours: allocations.service_hours,
    oiaAnnualReturn: allocations.oia_annual_return,
    annualESOPContribution: allocations.annual_esop_contribution,
    segregation: allocations.segregation,
    planSize: allocations.plan_size,
    fundingMechanism: funding.funding_mechanism,
    planActiveFrozen: funding.plan_active_frozen,
    inServiceAge: distributions.in_service_distrib_1_age,
    inServiceAmount: distributions.in_service_distrib_1_amount,
    diversYears: [
      distributions.divers_year_one, distributions.divers_year_two,
      distributions.divers_year_three, distributions.divers_year_four,
      distributions.divers_year_five, distributions.divers_year_final,
    ],
    esopFormationDate: distributions.esop_formation_date,
    scCorporation: distributions.sc_corporation,
    ebitda: valuationInputs.ebitda,
    capRate: valuationInputs.cap_rate,
    ebitdaGrowthRate: valuationInputs.ebitda_growth_rate,
    totalESOPShares: valuationInputs.total_esop_shares,
    totalSharesOutstanding: valuationInputs.total_shares_outstanding,
    distributionPeriod: allocations.distribution_years || 5,
    maxDistributionYears: provisions.period_years || 5,
    taxBenefitAmount: funding.s_corp_distributions || 0,
    diversificationThreshold: allocations.lump_sum_distribution_limit || 7000,
    retirementAge: distributions.in_service_distrib_1_age || 55,
    deathBenefitBase: distributions.in_service_distrib_1_amount || 0,
  }

  const planYearEnd = funding.plan_year_end ? new Date(funding.plan_year_end) : new Date()
  const engineOutput = runFormulaEngine(engineParticipants, engineSettings, planYearEnd, sharePrices)

  // Map engine output to database format
  // Map engine output property names to local variables
  const repurchaseData = engineOutput.repurchaseObligations ?? []
  const populationData = engineOutput.populationAnalysis ?? []
  const shareTurnoverData = engineOutput.shareTurnover ?? []
  const valuationProjections = engineOutput.valuationProjections ?? []
  const successScores = engineOutput.successScores ?? []

  // Extract pre-computed aging data from Excel (these are display-only, not formula-dependent)
  const avgAgeTenureActive = extractAgeTenureActive(ws1)
  const avgAgeTenureTerminated = extractAgeTenureBalance(ws1)

  // ──────────────────────────────────────────
  // 4. Upsert everything to Supabase
  // ──────────────────────────────────────────

  // Update profile
  await supabase.from('profiles').update({
    company_name: companyName,
    last_updated_at: new Date().toISOString(),
    inc_rate: 0,
  }).eq('id', userId)

  // Delete existing data for this user (fresh import)
  const tables = ['input_data', 'plan_provisions', 'allocations', 'distributions',
    'funding', 'valuation_inputs', 'beginning_share_prices',
    'valuation_projections', 'repurchase_obligations', 'share_turnover_schedules',
    'population_analyses', 'success_scores', 'average_age_tenure_active',
    'average_age_tenure_terminated']
  for (const table of tables) {
    await supabase.from(table).delete().eq('user_id', userId)
  }

  // Insert participant data (batch in chunks of 100)
  if (participants.length > 0) {
    for (let i = 0; i < participants.length; i += 100) {
      const chunk = participants.slice(i, i + 100).map(p => ({ ...p, user_id: userId }))
      await supabase.from('input_data').insert(chunk)
    }
  }

  // Insert settings
  await supabase.from('plan_provisions').insert({ ...provisions, user_id: userId })
  await supabase.from('allocations').insert({ ...allocations, user_id: userId })
  await supabase.from('distributions').insert({ ...distributions, user_id: userId })
  await supabase.from('funding').insert({ ...funding, user_id: userId })
  await supabase.from('valuation_inputs').insert({ ...valuationInputs, user_id: userId })
  await supabase.from('beginning_share_prices').insert({ ...beginningPrices, user_id: userId })

  // Insert analytical data
  if (repurchaseData.length > 0) {
    await supabase.from('repurchase_obligations').insert(repurchaseData.map(r => ({ ...r, user_id: userId })))
  }
  if (populationData.length > 0) {
    await supabase.from('population_analyses').insert(populationData.map(r => ({ ...r, user_id: userId })))
  }
  if (shareTurnoverData.length > 0) {
    await supabase.from('share_turnover_schedules').insert(shareTurnoverData.map(r => ({ ...r, user_id: userId })))
  }
  if (avgAgeTenureActive.length > 0) {
    await supabase.from('average_age_tenure_active').insert(avgAgeTenureActive.map(r => ({ ...r, user_id: userId })))
  }
  if (avgAgeTenureTerminated.length > 0) {
    await supabase.from('average_age_tenure_terminated').insert(avgAgeTenureTerminated.map(r => ({ ...r, user_id: userId })))
  }
  if (valuationProjections.length > 0) {
    await supabase.from('valuation_projections').insert(valuationProjections.map(r => ({ ...r, user_id: userId })))
  }
  if (successScores.length > 0) {
    await supabase.from('success_scores').insert(successScores.map(r => ({ ...r, user_id: userId })))
  }

  return {
    participantCount: participants.length,
    companyName,
  }
}

// ══════════════════════════════════════════════════════
// Helper extraction functions
// ══════════════════════════════════════════════════════

function cellVal(ws: ExcelJS.Worksheet, cell: string): string {
  const v = ws.getCell(cell).value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'object' && 'result' in v) return String((v as any).result ?? '')
  return String(v)
}

function cellNum(ws: ExcelJS.Worksheet, cell: string): number {
  const v = ws.getCell(cell).value
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in v) return Number((v as any).result) || 0
  return Number(v) || 0
}

function cellDate(ws: ExcelJS.Worksheet, cell: string): string | null {
  const v = ws.getCell(cell).value
  if (!v) return null
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'number') {
    // OLE Automation date
    const d = new Date((v - 25569) * 86400 * 1000)
    return d.toISOString().split('T')[0]
  }
  const parsed = new Date(String(v))
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0]
}

function extractParticipants(ws: ExcelJS.Worksheet) {
  const participants: any[] = []
  const shareCols = ['V','X','Z','AB','AD','AF','AH','AJ','AL','AN']
  const diverCols = ['W','Y','AA','AC','AE','AG','AI','AK','AM','AO']

  for (let row = 9; row <= 9393; row++) {
    const name = cellVal(ws, `C${row}`)
    if (!name || name.trim() === '') break

    const shares = shareCols.map(c => cellNum(ws, `${c}${row}`))
    const diversifications = diverCols.map(c => cellNum(ws, `${c}${row}`))

    participants.push({
      row_number: row - 8,
      ss_num: cellVal(ws, `A${row}`),
      ss_seq: cellVal(ws, `B${row}`),
      name,
      loc_no: cellVal(ws, `D${row}`),
      div_no: cellVal(ws, `E${row}`),
      birth_date: cellDate(ws, `F${row}`),
      hire_date: cellDate(ws, `G${row}`),
      esop_date: cellDate(ws, `H${row}`),
      vesting_pct: cellNum(ws, `I${row}`),
      comp_years: cellNum(ws, `J${row}`),
      gender: cellVal(ws, `K${row}`),
      plan_comp: cellNum(ws, `L${row}`),
      emp_group: cellNum(ws, `M${row}`),
      divers: cellNum(ws, `N${row}`),
      sra: cellVal(ws, `O${row}`),
      term_date: cellDate(ws, `P${row}`),
      reason: cellVal(ws, `Q${row}`),
      nonvested: cellVal(ws, `R${row}`),
      oia_tranche: cellNum(ws, `S${row}`),
      total_cash: cellNum(ws, `T${row}`),
      stock_tranche: cellNum(ws, `U${row}`),
      shares,
      diversifications,
      p_diver_years: [],
      p_diver_shares: [],
    })
  }
  return participants
}

function extractProvisions(ws: ExcelJS.Worksheet) {
  return {
    compensation_limit: cellNum(ws, 'B5'),
    compensation_limit_increase: cellNum(ws, 'B6'),
    period_years: cellNum(ws, 'B8'),
    distribution_years: cellNum(ws, 'B9'),
    plan_retirement: cellNum(ws, 'B11'),
    service_retirement: cellNum(ws, 'B13'),
    compensation_one_year: cellNum(ws, 'B14'),
    compensation_five_year: cellNum(ws, 'B15'),
    compensation_ten_year: cellNum(ws, 'B16'),
    turnover_five_year: cellVal(ws, 'B17'),
    turnover_ten_year: cellVal(ws, 'B18'),
  }
}

function extractAllocations(ws: ExcelJS.Worksheet) {
  return {
    plan_size: cellVal(ws, 'H5'),
    service_hours: cellNum(ws, 'H6'),
    lump_sum_distribution_limit: cellNum(ws, 'H7'),
    distribution_years: cellNum(ws, 'H8'),
    end_requirement: cellVal(ws, 'H9'),
    one_requirement: cellVal(ws, 'H10'),
    internal_loan_1: cellNum(ws, 'H11'),
    internal_loan_1_date: cellDate(ws, 'H12'),
    internal_loan_2: cellNum(ws, 'H13'),
    internal_loan_2_date: cellDate(ws, 'H14'),
    internal_loan_3: cellNum(ws, 'H15'),
    internal_loan_3_date: cellDate(ws, 'H16'),
    vesting_period: cellNum(ws, 'H17'),
    internal_loan_basis: cellNum(ws, 'H18'),
    oia_annual_return: cellNum(ws, 'H19'),
    annual_esop_contribution: cellNum(ws, 'H20'),
    segregation: cellVal(ws, 'H21'),
  }
}

function extractDistributions(ws: ExcelJS.Worksheet) {
  return {
    in_service_distrib_1_age: cellNum(ws, 'L4'),
    in_service_distrib_1_amount: cellNum(ws, 'L5'),
    in_service_distrib_2_frequency: cellNum(ws, 'L6'),
    in_service_distrib_2_amount: cellNum(ws, 'L7'),
    esop_formation_date: cellVal(ws, 'L9'),
    divers_year_one: cellNum(ws, 'L15'),
    divers_year_two: cellNum(ws, 'L16'),
    divers_year_three: cellNum(ws, 'L17'),
    divers_year_four: cellNum(ws, 'L18'),
    divers_year_five: cellNum(ws, 'L19'),
    divers_year_final: cellNum(ws, 'L20'),
    sc_corporation: cellVal(ws, 'L22'),
  }
}

function extractFunding(ws: ExcelJS.Worksheet) {
  return {
    stub_period: cellNum(ws, 'N7'),
    funding_mechanism: cellVal(ws, 'N9'),
    s_corp_distributions: cellNum(ws, 'N11'),
    plan_active_frozen: cellVal(ws, 'N17'),
    plan_year_end: cellDate(ws, 'N19'),
  }
}

function extractValuationInputs(ws: ExcelJS.Worksheet) {
  return {
    company_esop_value: cellNum(ws, 'R2'),
    total_shares_outstanding: cellNum(ws, 'R3'),
    total_esop_shares: cellNum(ws, 'R4'),
    ebitda: cellNum(ws, 'R5'),
    cap_rate: cellNum(ws, 'R6'),
    dloc: cellNum(ws, 'R7'),
    dlom: cellNum(ws, 'R8'),
    lt_debt: cellNum(ws, 'R9'),
    working_capital: cellNum(ws, 'R10'),
    excess_cash_assets: cellNum(ws, 'R11'),
    ebitda_growth_rate: cellNum(ws, 'R12'),
    stage_transaction_year_two: cellVal(ws, 'R13') || null,
    annual_stock_allocation_two: cellNum(ws, 'R14'),
    stage_transaction_year_three: cellVal(ws, 'R15') || null,
    annual_stock_allocation_three: cellNum(ws, 'R16'),
    total_share_second_stage: cellNum(ws, 'R17'),
    total_share_third_stage: cellNum(ws, 'R18'),
  }
}

function extractBeginningPrices(ws: ExcelJS.Worksheet) {
  return {
    share_price_one: cellNum(ws, 'T5'),
    share_price_two: cellNum(ws, 'T6'),
    share_price_three: cellNum(ws, 'T7'),
    share_price_four: cellNum(ws, 'T8'),
    share_price_five: cellNum(ws, 'T9'),
    share_price_ten: cellNum(ws, 'T10'),
  }
}

// Repurchase Obligation: ws1 rows 32-42, cols B-M (11 rows)
function extractRepurchase(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 32; row <= 42; row++) {
    const year = cellVal(ws, `B${row}`)
    if (!year) continue
    data.push({
      year,
      calendar_year_for_payout: cellVal(ws, `C${row}`),
      share_price: cellNum(ws, `D${row}`),
      esop_shares_allocated: cellNum(ws, `E${row}`),
      shares_turned: cellNum(ws, `F${row}`),
      oia_balance: cellNum(ws, `G${row}`),
      esop_shares_redeemed: cellNum(ws, `H${row}`),
      diversification: cellNum(ws, `I${row}`),
      in_service_distributions: cellNum(ws, `J${row}`),
      retirement_death_disability: cellNum(ws, `K${row}`),
      turnover: cellNum(ws, `L${row}`),
      total_repurchase_obligation: cellNum(ws, `M${row}`),
      npv: 0,
    })
  }
  return data
}

// Population Analysis: ws1 rows 32-42, cols O-Y
function extractPopulation(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 32; row <= 42; row++) {
    const year = cellVal(ws, `O${row}`)
    if (!year) continue
    data.push({
      year,
      active_participants: cellNum(ws, `P${row}`),
      covered_compensation: cellNum(ws, `Q${row}`),
      avg_cash_compensation: cellNum(ws, `R${row}`),
      avg_esop_compensation: cellNum(ws, `S${row}`),
      avg_total_compensation: cellNum(ws, `T${row}`),
      stock_allocations: cellNum(ws, `U${row}`),
      cash_contributions: cellNum(ws, `V${row}`),
      fringe: cellNum(ws, `W${row}`),
      effective_benefit_rate: cellNum(ws, `X${row}`),
      share_turn: cellNum(ws, `Y${row}`),
    })
  }
  return data
}

// Share Turnover: ws1 rows 49-59, cols G-M
function extractShareTurnover(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 49; row <= 59; row++) {
    const year = cellVal(ws, `G${row}`)
    if (!year) continue
    data.push({
      year,
      calendar_year_for_payout: cellVal(ws, `H${row}`),
      diversification: cellNum(ws, `I${row}`),
      in_service_distributions: cellNum(ws, `J${row}`),
      retirement_death_disability: cellNum(ws, `K${row}`),
      turnover: cellNum(ws, `L${row}`),
      total_shares: cellNum(ws, `M${row}`),
    })
  }
  return data
}

// Average Age Tenure Active: ws1 rows 49-59, cols O-U
function extractAgeTenureActive(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 49; row <= 59; row++) {
    const year = cellVal(ws, `O${row}`)
    if (!year) continue
    data.push({
      year,
      average_age: cellVal(ws, `P${row}`),
      average_tenure: cellVal(ws, `Q${row}`),
      covered_compensation: cellVal(ws, `R${row}`),
      change_pct: cellVal(ws, `S${row}`),
      average_account_balance: cellVal(ws, `T${row}`),
      balance_pct_change: cellVal(ws, `U${row}`),
      avg_value: '',
    })
  }
  return data
}

// Average Age Tenure Terminated: ws1 rows 71-81, cols O-V
function extractAgeTenureBalance(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 71; row <= 81; row++) {
    const year = cellVal(ws, `O${row}`)
    if (!year) continue
    data.push({
      year,
      avg_age_top_ten: cellVal(ws, `P${row}`),
      avg_balance_top_ten: cellVal(ws, `Q${row}`),
      avg_age_bottom_ten: cellVal(ws, `R${row}`),
      avg_balance_bottom_ten: cellVal(ws, `S${row}`),
      terminated_avg_age: cellVal(ws, `T${row}`),
      terminated_avg_tenure: cellVal(ws, `U${row}`),
      terminated_avg_balance: cellVal(ws, `V${row}`),
    })
  }
  return data
}

// Valuation Projections: ws2 rows 49-59, cols C-K
function extractValuationProjections(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 49; row <= 59; row++) {
    const year = cellVal(ws, `C${row}`)
    if (!year) continue
    data.push({
      year,
      esop_valuation: cellNum(ws, `D${row}`),
      esop_shares: cellNum(ws, `E${row}`),
      pct_esop_shares: cellNum(ws, `F${row}`),
      other_shares: cellNum(ws, `G${row}`),
      pct_other_shares: cellNum(ws, `H${row}`),
      total_shares: cellNum(ws, `I${row}`),
      price_per_share: cellNum(ws, `J${row}`),
      share_price_change: cellNum(ws, `K${row}`),
    })
  }
  return data
}

// Success Scores: ws2 rows 27-37, cols C-J
function extractSuccessScores(ws: ExcelJS.Worksheet) {
  const data: any[] = []
  for (let row = 27; row <= 37; row++) {
    const year = cellVal(ws, `C${row}`)
    if (!year) continue
    data.push({
      year_for_payout: year,
      repurchase_obligation: cellNum(ws, `D${row}`),
      cash_source: cellNum(ws, `E${row}`),
      surplus_or_deficit: cellNum(ws, `F${row}`),
      ro_cash_burn: cellNum(ws, `G${row}`),
      esop_success_score: cellNum(ws, `H${row}`),
      health_check: cellNum(ws, `I${row}`),
      key_takeaway: cellVal(ws, `J${row}`) || null,
    })
  }
  return data
}
