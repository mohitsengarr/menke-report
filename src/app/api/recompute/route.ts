import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runFormulaEngine, type ParticipantInput, type PlanSettings } from '@/lib/formulas/engine'

/**
 * POST /api/recompute
 *
 * Re-runs the formula engine against the current user's stored input_data
 * and settings, deleting and re-inserting every analytical table.
 *
 * Fixes SEN-211 (stale analytical data after settings change) and
 * SEN-209 (missing legacy /index/SyncData action).
 *
 * Guarantees: idempotent — running it twice in a row produces the same
 * result. Honors formula_config overrides and the user's stored
 * population projection rate (profiles.inc_rate).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  const userId = user.id

  // Pull everything in parallel
  const [
    profileRes, inputRes, provisionsRes, allocationsRes, distributionsRes,
    fundingRes, valuationRes, sharePricesRes, configOverridesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('inc_rate').eq('id', userId).single(),
    supabase.from('input_data').select('*').eq('user_id', userId).order('row_number'),
    supabase.from('plan_provisions').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('allocations').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('distributions').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('funding').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('valuation_inputs').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('beginning_share_prices').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('formula_configs').select('config_key, value_number, value_text, value_json').eq('user_id', userId),
  ])

  const participants = inputRes.data ?? []
  if (participants.length === 0) {
    return NextResponse.json({
      success: false,
      message: 'No participant data found. Upload an Excel file first.',
    }, { status: 400 })
  }
  const provisions = provisionsRes.data
  const allocations = allocationsRes.data
  const distributions = distributionsRes.data
  const funding = fundingRes.data
  const valuationInputs = valuationRes.data
  const beginningPrices = sharePricesRes.data

  if (!provisions || !allocations || !distributions || !funding || !valuationInputs || !beginningPrices) {
    return NextResponse.json({
      success: false,
      message: 'Plan settings incomplete. Open /settings to fill in the required tabs.',
    }, { status: 400 })
  }

  // Apply population change to projected active count: scale input_data up/down
  // via per-participant comp scaling (lightweight approximation of head-count scaling)
  const incRate = Number(profileRes.data?.inc_rate ?? 0) / 100

  // Build engine participant array
  const engineParticipants: ParticipantInput[] = participants.map((p: any) => ({
    row_number: p.row_number,
    name: p.name,
    birth_date: p.birth_date,
    hire_date: p.hire_date,
    esop_date: p.esop_date,
    term_date: p.term_date,
    reason: p.reason,
    vesting_pct: p.vesting_pct,
    plan_comp: p.plan_comp * (1 + incRate),
    total_cash: p.total_cash,
    shares: p.shares ?? [],
    diversifications: p.diversifications ?? [],
    gender: p.gender,
    nonvested: p.nonvested,
    oia_tranche: p.oia_tranche ?? 0,
    stock_tranche: p.stock_tranche ?? 0,
    divers: p.divers ?? 0,
    comp_years: p.comp_years ?? 0,
  }))

  // Build share prices
  const basePrice = (valuationInputs.company_esop_value ?? 0) / (valuationInputs.total_esop_shares || 1)
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
    diversificationThreshold: 55,
    retirementAge: provisions.plan_retirement || 65,
    deathBenefitBase: distributions.in_service_distrib_1_amount || 0,
  }

  const planYearEnd = funding.plan_year_end ? new Date(funding.plan_year_end) : new Date()

  const engineOutput = runFormulaEngine(
    engineParticipants,
    engineSettings,
    planYearEnd,
    sharePrices,
    (configOverridesRes.data ?? []) as any
  )

  // Wipe and re-insert analytical tables
  const analyticalTables = [
    'valuation_projections', 'repurchase_obligations', 'share_turnover_schedules',
    'population_analyses', 'success_scores',
  ]
  for (const t of analyticalTables) {
    await supabase.from(t).delete().eq('user_id', userId)
  }

  const toDb = (o: any) => Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()), v])
  )

  const vp = engineOutput.valuationProjections.map(r => ({ user_id: userId, ...toDb(r) }))
  const ro = engineOutput.repurchaseObligations.map(r => ({ user_id: userId, ...toDb(r) }))
  const st = engineOutput.shareTurnover.map(r => ({ user_id: userId, ...toDb(r) }))
  const pa = engineOutput.populationAnalysis.map(r => ({ user_id: userId, ...toDb(r) }))
  const ss = engineOutput.successScores.map(r => ({ user_id: userId, ...toDb(r) }))

  const [{ error: vpErr }, { error: roErr }, { error: stErr }, { error: paErr }, { error: ssErr }] = await Promise.all([
    supabase.from('valuation_projections').insert(vp),
    supabase.from('repurchase_obligations').insert(ro),
    supabase.from('share_turnover_schedules').insert(st),
    supabase.from('population_analyses').insert(pa),
    supabase.from('success_scores').insert(ss),
  ])

  const errors = [vpErr, roErr, stErr, paErr, ssErr].filter(Boolean)
  if (errors.length > 0) {
    return NextResponse.json({
      success: false,
      message: `Recompute partially failed: ${errors[0]!.message}`,
      errors: errors.map(e => e!.message),
    }, { status: 500 })
  }

  await supabase.from('profiles')
    .update({ last_updated_at: new Date().toISOString() })
    .eq('id', userId)

  return NextResponse.json({
    success: true,
    message: `Recomputed analytics for ${participants.length} participants across 11 projection years.`,
    participantCount: participants.length,
    incRate: Number(profileRes.data?.inc_rate ?? 0),
  })
}
