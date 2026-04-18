/**
 * MenkeReport ESOP Formula Engine
 * ================================
 * Replaces all 958 Excel formulas with native TypeScript calculations.
 *
 * Input:  raw participant data + 6 plan settings objects + share prices
 * Output: 7 analytical tables (valuation, repurchase, share turnover,
 *         population analysis, success scores, age/tenure summaries)
 *
 * Column references (e.g. "BJ", "CH") correspond to the original Excel
 * workbook columns for traceability during validation.
 */

import {
  lookupSarason,
  lookupMortality,
  lookupRMDLifeExpectancy,
  lookupTurnover,
} from './actuarial-tables'
import {
  resolveFormulaConfig,
  type ResolvedConfig,
  type FormulaConfigOverride,
} from './config'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ParticipantInput {
  row_number: number
  name: string | null
  birth_date: string | null
  hire_date: string | null
  esop_date: string | null
  term_date: string | null
  reason: string | null
  vesting_pct: number
  plan_comp: number
  total_cash: number
  shares: number[]           // 10 years of share allocations
  diversifications: number[] // 10 years of diversification amounts
  gender: string | null
  nonvested: string | null
  oia_tranche: number
  stock_tranche: number
  divers: number
  comp_years: number
}

export interface PlanSettings {
  // Plan Provisions
  compensationLimit: number
  compensationLimitIncrease: number
  periodYears: number
  distributionYears: number
  planRetirement: number
  serviceRetirement: number
  compGrowthRates: number[]   // [year0, year1-4, year5+]
  turnoverTable: string       // "T-1" through "T-11"

  // Allocations
  vestingPeriod: number       // 1, 3, or 6
  lumpSumLimit: number
  serviceHours: number
  oiaAnnualReturn: number
  annualESOPContribution: number
  segregation: string
  planSize: string
  fundingMechanism: string    // "Redeem" or "OIA"
  planActiveFrozen: string    // "Active" or "FROZEN"

  // Distributions
  inServiceAge: number
  inServiceAmount: number
  diversYears: number[]       // [yr1, yr2, yr3, yr4, yr5, final]
  esopFormationDate: string
  scCorporation: string

  // Valuation
  ebitda: number
  capRate: number
  ebitdaGrowthRate: number
  totalESOPShares: number
  totalSharesOutstanding: number

  // Other
  distributionPeriod: number
  maxDistributionYears: number
  taxBenefitAmount: number
  diversificationThreshold: number
  retirementAge: number
  deathBenefitBase: number
}

/** Per-year per-participant calculated fields */
interface YearlyParticipantData {
  year: number
  age: number
  yearsOfService: number
  isActiveInYear: boolean
  vestingPct: number
  projectedComp: number

  // Distribution drivers (shares flowing out)
  cashRepurchase: number          // CH: amortized cash payout for termed participants
  shareRepurchase: number         // CL: net shares repurchased due to turnover
  vestingAdjustment: number       // CK: shares forfeited by unvested terminees
  earlyRetirementDist: number     // CM: diversification-eligible distribution
  deathBenefitDist: number        // CN: mortality-adjusted share outflow
  rmdShareDist: number            // CO: IRS Required Minimum Distribution
  catchAllDist: number            // CP: in-service distribution catch-all
  totalShareDist: number          // sum of all share outflows

  // Allocation (shares flowing in)
  newAllocation: number           // CQ: pro-rata share allocation from contribution

  // Balances
  beginningShares: number
  endOfYearShares: number         // CR: beginning + allocations - distributions
  cumulativeDistributions: number

  // Account value components
  oiaIncome: number               // CS: Other Investment Account return
  cashRMD: number                 // CT: cash portion of RMD
  contributionRealloc: number     // CU: contribution reallocation
  taxBenefit: number              // CV: S-Corp tax benefit pass-through

  // Totals
  totalAccountValue: number       // CX: share value + OIA + cash + tax benefits
  shareValue: number              // CW: shares * price
  repurchaseObligation: number    // CZ: account value * vesting %
}

/** Fully computed participant record */
interface ParticipantComputed {
  rowNumber: number
  name: string
  birthDate: Date | null
  hireDate: Date | null

  // Separation
  separationDate: Date | null
  separationReason: string
  ageAtSeparation: number
  yearsOfServiceAtSep: number

  // Status flags
  isActive: boolean
  isTerminated: boolean
  isRetirementEligible: boolean

  // Base values
  totalShares: number
  vestingPeriod: number
  ownershipPct: number
  annualizedComp: number

  // 11 years of projections (Year 0 through Year 10)
  yearlyData: YearlyParticipantData[]
}

// ───────────────────────────────────────────
// Aggregate output types (7 analytical tables)
// ───────────────────────────────────────────

export interface ValuationProjectionRow {
  year: string
  esopValuation: number
  esopShares: number
  pctEsopShares: number
  otherShares: number
  pctOtherShares: number
  totalShares: number
  pricePerShare: number
  sharePriceChange: number
}

export interface RepurchaseObligationRow {
  year: string
  calendarYearForPayout: string
  sharePrice: number
  esopSharesAllocated: number
  sharesTurned: number
  oiaBalance: number
  esopSharesRedeemed: number
  diversification: number
  inServiceDistributions: number
  retirementDeathDisability: number
  turnover: number
  totalRepurchaseObligation: number
  npv: number
}

export interface ShareTurnoverRow {
  year: string
  calendarYearForPayout: string
  diversification: number
  inServiceDistributions: number
  retirementDeathDisability: number
  turnover: number
  totalShares: number
}

export interface PopulationAnalysisRow {
  year: string
  activeParticipants: number
  coveredCompensation: number
  avgCashCompensation: number
  avgEsopCompensation: number
  avgTotalCompensation: number
  stockAllocations: number
  cashContributions: number
  fringe: number
  effectiveBenefitRate: number
  shareTurn: number
}

export interface SuccessScoreRow {
  yearForPayout: string
  repurchaseObligation: number
  cashSource: number
  surplusOrDeficit: number
  roCashBurn: number
  esopSuccessScore: number
  healthCheck: number
  keyTakeaway: string | null
}

export interface AgeTenureRow {
  category: string
  count: number
  avgAge: number
  avgTenure: number
  avgBalance: number
}

/** SEN-222: Year-by-year active population summary (legacy AverageAgeTenure.cshtml) */
export interface AgeTenureActiveByYearRow {
  year: string
  averageAge: number
  averageTenure: number
  coveredCompensation: number
  compensationPctChange: number   // YoY % change in coveredCompensation
  averageVestedBalance: number
  balancePctChange: number        // YoY % change in averageVestedBalance
}

/** SEN-222: Year-by-year terminated-population balance splits (legacy AverageAgeTenureBalance.cshtml) */
export interface AgeTenureTerminatedByYearRow {
  year: string
  avgAgeTop10pct: number
  avgBalanceTop10pct: number
  avgAgeBottom10pct: number
  avgBalanceBottom10pct: number
  avgAgeTerminated: number
  avgTenureTerminated: number
  avgBalanceTerminated: number
}

export interface FormulaEngineOutput {
  valuationProjections: ValuationProjectionRow[]
  repurchaseObligations: RepurchaseObligationRow[]
  shareTurnover: ShareTurnoverRow[]
  populationAnalysis: PopulationAnalysisRow[]
  successScores: SuccessScoreRow[]
  /** Legacy service-tenure-bucket view (preserved for backward compat) */
  ageTenureActive: AgeTenureRow[]
  ageTenureTerminated: AgeTenureRow[]
  /** SEN-222: Legacy year-by-year view matching /AverageAgeTenure and /AverageAgeTenureBalance */
  ageTenureActiveByYear: AgeTenureActiveByYearRow[]
  ageTenureTerminatedByYear: AgeTenureTerminatedByYearRow[]
  participantDetails: ParticipantComputed[]
}

// ═══════════════════════════════════════════════════════════════
// Date Helpers
// ═══════════════════════════════════════════════════════════════

export function parseDate(d: string | null): Date | null {
  if (!d) return null
  const parsed = new Date(d)
  return isNaN(parsed.getTime()) ? null : parsed
}

/** Fractional years between two dates */
export function yearsBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime()
  return ms / (365.25 * 24 * 60 * 60 * 1000)
}

/** Age at a reference date */
export function ageAt(birthDate: Date, refDate: Date): number {
  return Math.floor(yearsBetween(birthDate, refDate))
}

/** Add N years to a date */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

/** Beginning-of-year date for a projection year offset */
export function yearDate(baseDate: Date, yearOffset: number): Date {
  return addYears(baseDate, yearOffset)
}

// ═══════════════════════════════════════════════════════════════
// Core Per-Participant Formulas
// ═══════════════════════════════════════════════════════════════

/**
 * Separation date (Excel col BS):
 * - If terminated, use term_date.
 * - Otherwise, project normal retirement date (DOB + retirement age).
 */
export function calcSeparationDate(
  birthDate: Date | null,
  termDate: Date | null,
  retirementAge: number
): Date | null {
  if (termDate) return termDate
  if (!birthDate) return null
  return addYears(birthDate, retirementAge)
}

/**
 * Vesting percentage (Excel col DN):
 * Depends on vesting schedule (1-year cliff, 3-year cliff, 6-year graded).
 */
export function calcVestingPct(
  vestingPeriod: number,
  yearsOfService: number,
  config?: ResolvedConfig
): number {
  if (yearsOfService < 0) return 0
  const oneYr = Number(config?.['vesting.1yr_cliff_threshold'] ?? 1)
  const threeYr = Number(config?.['vesting.3yr_cliff_threshold'] ?? 3)
  const gradedStart = Number(config?.['vesting.6yr_graded_start'] ?? 2)
  const gradedStep = Number(config?.['vesting.6yr_graded_step'] ?? 0.20)
  const gradedFullYear = Number(config?.['vesting.6yr_graded_full_year'] ?? 6)

  if (vestingPeriod === 1) return yearsOfService >= oneYr ? 1.0 : 0
  if (vestingPeriod === 3) return yearsOfService >= threeYr ? 1.0 : 0
  // Graded vesting: zero until gradedStart; +gradedStep per year; 100% at gradedFullYear.
  if (yearsOfService < gradedStart) return 0
  if (yearsOfService >= gradedFullYear) return 1.0
  const pct = (Math.floor(yearsOfService) - gradedStart + 1) * gradedStep
  return Math.min(1.0, Math.max(0, pct))
}

/**
 * Projected compensation (Excel col BL):
 * Grows the participant's plan_comp by the applicable growth rate per year.
 * Capped at IRS Section 401(a)(17) compensation limit.
 */
export function calcProjectedComp(
  basePlanComp: number,
  yearOffset: number,
  compGrowthRates: number[],
  compLimit: number,
  compLimitIncrease: number
): number {
  if (basePlanComp <= 0) return 0
  let comp = basePlanComp
  for (let y = 1; y <= yearOffset; y++) {
    const rate = y <= 1 ? compGrowthRates[0]!
      : y <= 5 ? compGrowthRates[1]!
      : compGrowthRates[2]!
    comp *= (1 + rate)
  }
  // Apply inflation-adjusted compensation limit
  const adjustedLimit = compLimit * Math.pow(1 + compLimitIncrease, yearOffset)
  return Math.min(comp, adjustedLimit)
}

/**
 * Cash repurchase for terminated participants (Excel col CH):
 * Amortized installment payout over the distribution period using Sarason factor.
 * Only applies after separation, during the distribution window.
 */
export function calcCashRepurchase(
  isTerminated: boolean,
  yearsSinceSeparation: number,
  distributionPeriod: number,
  totalAccountValue: number,
  vestingPct: number,
  lumpSumLimit: number
): number {
  if (!isTerminated || yearsSinceSeparation < 1) return 0
  if (yearsSinceSeparation > distributionPeriod) return 0

  const vestedValue = totalAccountValue * vestingPct

  // Small balances get lump-sum distribution
  if (vestedValue <= lumpSumLimit && yearsSinceSeparation === 1) {
    return -vestedValue
  }

  // Amortize over remaining installment periods
  const remainingYears = distributionPeriod - yearsSinceSeparation + 1
  const sarasonFactor = lookupSarason(remainingYears)
  return -(vestedValue / sarasonFactor)
}

/**
 * Share repurchase from turnover (Excel cols CJ-CL):
 * Active participants have a probability of terminating each year based on
 * age-graded turnover tables. The expected share outflow = shares * turnover rate.
 * Unvested portions are forfeited (vesting adjustment).
 */
export function calcShareRepurchase(
  isActive: boolean,
  age: number,
  shares: number,
  vestingPct: number,
  turnoverTable: string
): { shareRepurchase: number; vestingAdjustment: number } {
  if (!isActive || shares <= 0) return { shareRepurchase: 0, vestingAdjustment: 0 }
  const turnoverRate = lookupTurnover(turnoverTable, age)
  const sharesLeaving = shares * turnoverRate
  const vestedLeaving = sharesLeaving * vestingPct
  const unvestedForfeited = sharesLeaving * (1 - vestingPct)
  return {
    shareRepurchase: -vestedLeaving,
    vestingAdjustment: -unvestedForfeited,
  }
}

/**
 * Early retirement / diversification distribution (Excel col CM):
 * Participants who reach the diversification threshold (age 55 + 10 years service)
 * can elect to diversify a percentage of their ESOP shares.
 * The percentages follow a statutory schedule over diversification years.
 */
export function calcEarlyRetirementDist(
  isActive: boolean,
  age: number,
  yearsOfService: number,
  shares: number,
  diversYears: number[],
  diversThreshold: number,
  yearInDiversWindow: number,
  config?: ResolvedConfig
): number {
  const serviceReq = Number(config?.['age.diversification_service_requirement'] ?? 10)
  if (!isActive) return 0
  if (age < diversThreshold || yearsOfService < serviceReq) return 0
  if (yearInDiversWindow < 0 || yearInDiversWindow >= diversYears.length) return 0
  const pct = diversYears[yearInDiversWindow]!
  return -(shares * pct)
}

/**
 * Death benefit distribution (Excel col CN):
 * Expected share outflow from participant mortality.
 * = shares * mortality_rate for that age/gender
 */
export function calcDeathBenefitDist(
  isActive: boolean,
  age: number,
  gender: string | null,
  shares: number
): number {
  if (!isActive || shares <= 0) return 0
  const mortalityRate = lookupMortality(age, gender)
  return -(shares * mortalityRate)
}

/**
 * Required Minimum Distribution (Excel col CO):
 * Once a participant reaches age 72, they must take distributions
 * based on the IRS Uniform Lifetime Table divisor.
 */
export function calcRMDShareDist(
  age: number,
  shareBalance: number,
  config?: ResolvedConfig
): number {
  const rmdStart = Number(config?.['age.rmd_start'] ?? 72)
  if (age < rmdStart || shareBalance <= 0) return 0
  const lifeExp = lookupRMDLifeExpectancy(age, rmdStart)
  if (lifeExp <= 0) return 0
  return -(shareBalance / lifeExp)
}

/**
 * In-service catch-all distribution (Excel col CP):
 * Participants over the in-service age threshold receive a fixed
 * distribution amount (as share equivalent).
 */
export function calcInServiceDist(
  isActive: boolean,
  age: number,
  inServiceAge: number,
  inServiceAmount: number,
  sharePrice: number
): number {
  if (!isActive || age < inServiceAge || sharePrice <= 0) return 0
  return -(inServiceAmount / sharePrice)
}

/**
 * New share allocation (Excel col CQ):
 * Pro-rata allocation based on participant's comp / total covered comp.
 * Only for active participants when the plan is not frozen.
 */
export function calcNewAllocation(
  isActive: boolean,
  projectedComp: number,
  totalCoveredComp: number,
  annualContribution: number,
  sharePrice: number,
  planFrozen: boolean
): number {
  if (!isActive || planFrozen || sharePrice <= 0) return 0
  if (totalCoveredComp <= 0 || projectedComp <= 0) return 0
  const compRatio = projectedComp / totalCoveredComp
  const dollarAllocation = annualContribution * compRatio
  return dollarAllocation / sharePrice
}

/**
 * OIA (Other Investments Account) income (Excel col CS):
 * Annual return on the participant's OIA balance.
 */
export function calcOIAIncome(oiaBalance: number, annualReturn: number): number {
  return oiaBalance * annualReturn
}

// ═══════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════

/**
 * Run the complete ESOP formula engine.
 *
 * Processes all participants across 11 projection years (Year 0 - Year 10),
 * then aggregates into the 7 analytical output tables.
 */
export function runFormulaEngine(
  participants: ParticipantInput[],
  settings: PlanSettings,
  valuationDate: Date,
  sharePrices: number[],
  configOverrides: FormulaConfigOverride[] = []
): FormulaEngineOutput {
  const config = resolveFormulaConfig(configOverrides)
  const YEARS = Number(config['plan.projection_years']) // Year 0 through Year N-1
  const isPlanFrozen = settings.planActiveFrozen === 'FROZEN'

  // ─── Phase 1: Compute per-participant projections ───

  const computed: ParticipantComputed[] = participants.map(p =>
    computeParticipant(p, settings, valuationDate, sharePrices, YEARS, isPlanFrozen, config)
  )

  // For allocation, we need total covered comp per year (sum of active participants).
  // First pass: calculate comp without allocation. Second pass: fill in allocations.
  for (let yr = 0; yr < YEARS; yr++) {
    const totalCoveredComp = computed.reduce((sum, pc) => {
      const yd = pc.yearlyData[yr]!
      return sum + (yd.isActiveInYear ? yd.projectedComp : 0)
    }, 0)

    const price = sharePrices[yr] ?? sharePrices[sharePrices.length - 1]!

    for (const pc of computed) {
      const yd = pc.yearlyData[yr]!
      yd.newAllocation = calcNewAllocation(
        yd.isActiveInYear,
        yd.projectedComp,
        totalCoveredComp,
        settings.annualESOPContribution,
        price,
        isPlanFrozen
      )
      // Recompute end-of-year shares with allocation included
      yd.endOfYearShares = yd.beginningShares
        + yd.newAllocation
        + yd.totalShareDist // totalShareDist is negative (outflow)

      // Recompute account value with final share count
      yd.shareValue = yd.endOfYearShares * price
      yd.totalAccountValue = yd.shareValue + yd.oiaIncome + yd.cashRMD
        + yd.contributionRealloc + yd.taxBenefit
      yd.repurchaseObligation = yd.totalAccountValue * yd.vestingPct
    }

    // Propagate end-of-year shares forward as next year's beginning shares
    if (yr < YEARS - 1) {
      for (const pc of computed) {
        pc.yearlyData[yr + 1]!.beginningShares = pc.yearlyData[yr]!.endOfYearShares
      }
    }
  }

  // ─── Phase 2: Aggregate into analytical tables ───

  const valuationProjections = buildValuationProjections(
    computed, settings, valuationDate, sharePrices, YEARS
  )
  const repurchaseObligations = buildRepurchaseObligations(
    computed, settings, valuationDate, sharePrices, YEARS, config
  )
  const shareTurnover = buildShareTurnover(
    computed, valuationDate, sharePrices, YEARS
  )
  const populationAnalysis = buildPopulationAnalysis(
    computed, settings, valuationDate, sharePrices, YEARS
  )
  const successScores = buildSuccessScores(
    repurchaseObligations, settings, config
  )
  const ageTenureActive = buildAgeTenureSummary(computed, true)
  const ageTenureTerminated = buildAgeTenureSummary(computed, false)
  // SEN-222: legacy year-by-year views
  const ageTenureActiveByYear = buildAgeTenureActiveByYear(computed, YEARS)
  const ageTenureTerminatedByYear = buildAgeTenureTerminatedByYear(computed, YEARS)

  return {
    valuationProjections,
    repurchaseObligations,
    shareTurnover,
    populationAnalysis,
    successScores,
    ageTenureActive,
    ageTenureTerminated,
    ageTenureActiveByYear,
    ageTenureTerminatedByYear,
    participantDetails: computed,
  }
}

// ═══════════════════════════════════════════════════════════════
// Per-Participant Computation (Phase 1)
// ═══════════════════════════════════════════════════════════════

function computeParticipant(
  p: ParticipantInput,
  s: PlanSettings,
  valuationDate: Date,
  sharePrices: number[],
  numYears: number,
  isPlanFrozen: boolean,
  config: ResolvedConfig
): ParticipantComputed {
  const birthDate = parseDate(p.birth_date)
  const hireDate = parseDate(p.hire_date)
  const termDate = parseDate(p.term_date)
  const esopDate = parseDate(p.esop_date)

  const separationDate = calcSeparationDate(birthDate, termDate, s.retirementAge)
  const isTerminated = termDate !== null
  const isActive = !isTerminated

  const ageAtSep = (birthDate && separationDate)
    ? ageAt(birthDate, separationDate) : 0
  const yearsOfServiceAtSep = (hireDate && separationDate)
    ? yearsBetween(hireDate, separationDate) : 0

  const isRetirementEligible = (birthDate !== null) &&
    ageAt(birthDate, valuationDate) >= s.planRetirement

  // Total shares from all allocation tranches
  const totalShares = p.shares.reduce((a, b) => a + b, 0) + p.stock_tranche
  const ownershipPct = s.totalESOPShares > 0
    ? totalShares / s.totalESOPShares : 0

  // ─── Build yearly projections ───

  const yearlyData: YearlyParticipantData[] = []
  let carryShares = totalShares
  let cumulativeDist = 0

  for (let yr = 0; yr < numYears; yr++) {
    const refDate = yearDate(valuationDate, yr)
    const currentAge = birthDate ? ageAt(birthDate, refDate) : 0
    const yos = hireDate ? yearsBetween(hireDate, refDate) : p.comp_years + yr
    const yearsSinceSep = separationDate
      ? yearsBetween(separationDate, refDate) : -1

    // Determine active status for this projection year
    const activeThisYear = isActive && (!separationDate || refDate < separationDate)

    const vestPct = calcVestingPct(s.vestingPeriod, yos, config)
    const price = sharePrices[yr] ?? sharePrices[sharePrices.length - 1]!

    // Projected compensation
    const projComp = activeThisYear
      ? calcProjectedComp(
          p.plan_comp, yr, s.compGrowthRates,
          s.compensationLimit, s.compensationLimitIncrease
        )
      : 0

    // Cash repurchase for terminated participants
    const cashRepurchase = calcCashRepurchase(
      isTerminated, yearsSinceSep, s.distributionPeriod,
      carryShares * price, vestPct, s.lumpSumLimit
    )

    // Share repurchase from turnover probability
    const { shareRepurchase, vestingAdjustment } = calcShareRepurchase(
      activeThisYear, currentAge, carryShares, vestPct, s.turnoverTable
    )

    // Diversification window: years since participant hit age 55 + 10 yrs service
    const diversEligAge = s.diversificationThreshold
    const diversStartYear = (birthDate && hireDate)
      ? Math.max(
          Math.ceil(diversEligAge - ageAt(birthDate, valuationDate)),
          Math.ceil(10 - yearsBetween(hireDate, valuationDate))
        )
      : -1
    const yearInDiversWindow = yr - Math.max(diversStartYear, 0)

    const earlyRetirementDist = calcEarlyRetirementDist(
      activeThisYear, currentAge, yos, carryShares,
      s.diversYears, diversEligAge, yearInDiversWindow, config
    )

    // Death benefit
    const deathBenefitDist = calcDeathBenefitDist(
      activeThisYear, currentAge, p.gender, carryShares
    )

    // RMD for age 72+
    const rmdShareDist = calcRMDShareDist(currentAge, carryShares, config)

    // In-service catch-all
    const catchAllDist = calcInServiceDist(
      activeThisYear, currentAge, s.inServiceAge,
      s.inServiceAmount, price
    )

    // Total share distribution (all outflows are negative)
    const totalShareDist = shareRepurchase + vestingAdjustment
      + earlyRetirementDist + deathBenefitDist + rmdShareDist + catchAllDist

    // New allocation placeholder (filled in Phase 1 second pass)
    const newAllocation = 0

    // End-of-year shares (preliminary, updated in second pass)
    const endShares = Math.max(0, carryShares + totalShareDist)

    // OIA income
    const oiaBalance = p.oia_tranche * Math.pow(1 + s.oiaAnnualReturn, yr)
    const oiaIncome = calcOIAIncome(oiaBalance, s.oiaAnnualReturn)

    // Cash RMD (the dollar amount of RMD beyond share distribution)
    const cashRMD = rmdShareDist !== 0 ? Math.abs(rmdShareDist) * price : 0

    // Contribution reallocation: for Redeem plans, forfeitures get reallocated
    const contributionRealloc = s.fundingMechanism === 'Redeem' && activeThisYear
      ? Math.abs(vestingAdjustment) * price
      : 0

    // S-Corp tax benefit pass-through
    const taxBenefit = (s.scCorporation === 'Yes' && activeThisYear)
      ? s.taxBenefitAmount * ownershipPct
      : 0

    // Account value
    const shareValue = endShares * price
    const totalAccountValue = shareValue + oiaIncome + cashRMD
      + contributionRealloc + taxBenefit

    // Repurchase obligation = account value * vesting %
    const repurchaseObligation = totalAccountValue * vestPct

    cumulativeDist += Math.abs(totalShareDist)

    yearlyData.push({
      year: yr,
      age: currentAge,
      yearsOfService: yos,
      isActiveInYear: activeThisYear,
      vestingPct: vestPct,
      projectedComp: projComp,
      cashRepurchase,
      shareRepurchase,
      vestingAdjustment,
      earlyRetirementDist,
      deathBenefitDist,
      rmdShareDist,
      catchAllDist,
      totalShareDist,
      newAllocation,
      beginningShares: carryShares,
      endOfYearShares: endShares,
      cumulativeDistributions: cumulativeDist,
      oiaIncome,
      cashRMD,
      contributionRealloc,
      taxBenefit,
      shareValue,
      totalAccountValue,
      repurchaseObligation,
    })

    carryShares = endShares
  }

  return {
    rowNumber: p.row_number,
    name: p.name || '',
    birthDate,
    hireDate,
    separationDate,
    separationReason: p.reason || (isActive ? 'Active' : 'Unknown'),
    ageAtSeparation: ageAtSep,
    yearsOfServiceAtSep,
    isActive,
    isTerminated,
    isRetirementEligible,
    totalShares,
    vestingPeriod: s.vestingPeriod,
    ownershipPct,
    annualizedComp: p.plan_comp,
    yearlyData,
  }
}

// ═══════════════════════════════════════════════════════════════
// Aggregation Functions (Phase 2)
// ═══════════════════════════════════════════════════════════════

/**
 * Valuation Projections table:
 * ESOP value, share counts, price per share, and price change by year.
 */
function buildValuationProjections(
  computed: ParticipantComputed[],
  settings: PlanSettings,
  valuationDate: Date,
  sharePrices: number[],
  numYears: number
): ValuationProjectionRow[] {
  const rows: ValuationProjectionRow[] = []
  let prevPrice = 0

  for (let yr = 0; yr < numYears; yr++) {
    const price = sharePrices[yr] ?? sharePrices[sharePrices.length - 1]!
    const refDate = yearDate(valuationDate, yr)
    const yearLabel = `Year ${yr}`

    // ESOP shares = sum of all participants' end-of-year shares
    const esopShares = computed.reduce(
      (sum, pc) => sum + pc.yearlyData[yr]!.endOfYearShares, 0
    )

    // Projected EBITDA growth drives enterprise value
    const projectedEbitda = settings.ebitda * Math.pow(1 + settings.ebitdaGrowthRate, yr)
    const enterpriseValue = settings.capRate > 0
      ? projectedEbitda / settings.capRate : 0
    const esopValuation = price * esopShares

    const totalShares = settings.totalSharesOutstanding
    const otherShares = totalShares - esopShares
    const pctEsop = totalShares > 0 ? esopShares / totalShares : 0
    const pctOther = totalShares > 0 ? otherShares / totalShares : 0

    const priceChange = prevPrice > 0 ? (price - prevPrice) / prevPrice : 0
    prevPrice = price

    rows.push({
      year: yearLabel,
      esopValuation,
      esopShares: Math.round(esopShares),
      pctEsopShares: pctEsop,
      otherShares: Math.round(otherShares),
      pctOtherShares: pctOther,
      totalShares: Math.round(totalShares),
      pricePerShare: price,
      sharePriceChange: priceChange,
    })
  }
  return rows
}

/**
 * Repurchase Obligations table:
 * Breaks down the total RO by driver (diversification, turnover, retirement, etc.)
 * and computes NPV of future obligations.
 */
function buildRepurchaseObligations(
  computed: ParticipantComputed[],
  settings: PlanSettings,
  valuationDate: Date,
  sharePrices: number[],
  numYears: number,
  config?: ResolvedConfig
): RepurchaseObligationRow[] {
  const rows: RepurchaseObligationRow[] = []
  const discountRate = Number(config?.['val.npv_discount_rate'] ?? 0.05)

  for (let yr = 0; yr < numYears; yr++) {
    const price = sharePrices[yr] ?? sharePrices[sharePrices.length - 1]!
    const refDate = yearDate(valuationDate, yr)
    const calYear = refDate.getFullYear()

    // Aggregate distributions across all participants for this year
    let diversification = 0
    let inServiceDist = 0
    let retDeathDisability = 0
    let turnoverShares = 0
    let sharesAllocated = 0
    let totalOIA = 0
    let esopRedeemed = 0

    for (const pc of computed) {
      const yd = pc.yearlyData[yr]!
      diversification += Math.abs(yd.earlyRetirementDist)
      inServiceDist += Math.abs(yd.catchAllDist) + Math.abs(yd.rmdShareDist)
      retDeathDisability += Math.abs(yd.deathBenefitDist)
      turnoverShares += Math.abs(yd.shareRepurchase)
      sharesAllocated += yd.newAllocation
      totalOIA += yd.oiaIncome
      esopRedeemed += Math.abs(yd.vestingAdjustment)
    }

    const totalSharesTurned = diversification + inServiceDist
      + retDeathDisability + turnoverShares

    // Dollar amounts = shares * price
    const totalRO = (diversification + inServiceDist + retDeathDisability
      + turnoverShares) * price

    // NPV: discount future obligations back to Year 0
    const npvFactor = Math.pow(1 + discountRate, -yr)
    const npv = totalRO * npvFactor

    rows.push({
      year: `Year ${yr}`,
      calendarYearForPayout: String(calYear),
      sharePrice: price,
      esopSharesAllocated: Math.round(sharesAllocated),
      sharesTurned: Math.round(totalSharesTurned),
      oiaBalance: totalOIA,
      esopSharesRedeemed: Math.round(esopRedeemed),
      diversification: diversification * price,
      inServiceDistributions: inServiceDist * price,
      retirementDeathDisability: retDeathDisability * price,
      turnover: turnoverShares * price,
      totalRepurchaseObligation: totalRO,
      npv,
    })
  }
  return rows
}

/**
 * Share Turnover Schedule:
 * Share outflows broken by driver category by year (in share counts).
 */
function buildShareTurnover(
  computed: ParticipantComputed[],
  valuationDate: Date,
  sharePrices: number[],
  numYears: number
): ShareTurnoverRow[] {
  const rows: ShareTurnoverRow[] = []

  for (let yr = 0; yr < numYears; yr++) {
    const refDate = yearDate(valuationDate, yr)
    const calYear = refDate.getFullYear()

    let diversification = 0
    let inServiceDist = 0
    let retDeathDisability = 0
    let turnoverShares = 0

    for (const pc of computed) {
      const yd = pc.yearlyData[yr]!
      diversification += Math.abs(yd.earlyRetirementDist)
      inServiceDist += Math.abs(yd.catchAllDist) + Math.abs(yd.rmdShareDist)
      retDeathDisability += Math.abs(yd.deathBenefitDist)
      turnoverShares += Math.abs(yd.shareRepurchase)
    }

    const total = diversification + inServiceDist + retDeathDisability + turnoverShares

    rows.push({
      year: `Year ${yr}`,
      calendarYearForPayout: String(calYear),
      diversification: Math.round(diversification),
      inServiceDistributions: Math.round(inServiceDist),
      retirementDeathDisability: Math.round(retDeathDisability),
      turnover: Math.round(turnoverShares),
      totalShares: Math.round(total),
    })
  }
  return rows
}

/**
 * Population Analysis:
 * Active-participant demographics, compensation, and benefit rates by year.
 */
function buildPopulationAnalysis(
  computed: ParticipantComputed[],
  settings: PlanSettings,
  valuationDate: Date,
  sharePrices: number[],
  numYears: number
): PopulationAnalysisRow[] {
  const rows: PopulationAnalysisRow[] = []

  for (let yr = 0; yr < numYears; yr++) {
    const price = sharePrices[yr] ?? sharePrices[sharePrices.length - 1]!
    const refDate = yearDate(valuationDate, yr)

    let activeCount = 0
    let totalComp = 0
    let totalCash = 0
    let totalEsopValue = 0
    let totalAllocShares = 0
    let totalShareTurn = 0
    let totalBeginningShares = 0

    for (const pc of computed) {
      const yd = pc.yearlyData[yr]!
      if (!yd.isActiveInYear) continue
      activeCount++
      totalComp += yd.projectedComp
      totalCash += pc.annualizedComp
      totalEsopValue += yd.shareValue
      totalAllocShares += yd.newAllocation
      totalShareTurn += Math.abs(yd.totalShareDist)
      totalBeginningShares += yd.beginningShares
    }

    const avgCashComp = activeCount > 0 ? totalCash / activeCount : 0
    const avgEsopComp = activeCount > 0 ? totalEsopValue / activeCount : 0
    const avgTotalComp = avgCashComp + avgEsopComp

    const stockAllocValue = totalAllocShares * price
    const cashContrib = settings.annualESOPContribution
    const fringe = activeCount > 0 ? stockAllocValue / activeCount : 0
    const effectiveBenefitRate = totalComp > 0
      ? stockAllocValue / totalComp : 0
    // SEN-192: shareTurn is a ratio (shares turned over / starting share pool)
    // not a raw share count. Dashboard formats it as a percentage.
    const shareTurnRatio = totalBeginningShares > 0
      ? totalShareTurn / totalBeginningShares : 0

    rows.push({
      year: `Year ${yr}`,
      activeParticipants: activeCount,
      coveredCompensation: totalComp,
      avgCashCompensation: avgCashComp,
      avgEsopCompensation: avgEsopComp,
      avgTotalCompensation: avgTotalComp,
      stockAllocations: stockAllocValue,
      cashContributions: cashContrib,
      fringe,
      effectiveBenefitRate,
      shareTurn: shareTurnRatio,
    })
  }
  return rows
}

/**
 * Success Scores:
 * Compares repurchase obligations against available cash sources.
 * Produces surplus/deficit, cash burn rate, and a letter-grade health score.
 */
function buildSuccessScores(
  roRows: RepurchaseObligationRow[],
  settings: PlanSettings,
  config?: ResolvedConfig
): SuccessScoreRow[] {
  const thrExcellent = Number(config?.['score.threshold_excellent'] ?? 0.25)
  const thrGood = Number(config?.['score.threshold_good'] ?? 0.50)
  const thrCaution = Number(config?.['score.threshold_caution'] ?? 0.75)
  const thrConcern = Number(config?.['score.threshold_concern'] ?? 1.00)
  const thrDeficit = Number(config?.['score.threshold_deficit'] ?? 1.50)
  const valExcellent = Number(config?.['score.value_excellent'] ?? 0.95)
  const valGood = Number(config?.['score.value_good'] ?? 0.85)
  const valCaution = Number(config?.['score.value_caution'] ?? 0.70)
  const valConcern = Number(config?.['score.value_concern'] ?? 0.55)
  const valDeficit = Number(config?.['score.value_deficit'] ?? 0.35)
  const valCritical = Number(config?.['score.value_critical'] ?? 0.15)
  const valIdeal = Number(config?.['score.value_ideal'] ?? 0.99)
  const healthYellowPct = Number(config?.['score.health_yellow_pct'] ?? 0.25)
  const healthGreen = Number(config?.['score.health_value_green'] ?? 1.0)
  const healthYellow = Number(config?.['score.health_value_yellow'] ?? 0.6)
  const healthRed = Number(config?.['score.health_value_red'] ?? 0.2)

  return roRows.map((ro, idx) => {
    // Cash source: aggregate cash available to fund repurchases this year.
    // Legacy (DbApis.cs) sums: EBITDA×rate, OIA return pool, tax benefit pass-through,
    // and existing cash contributions. We approximate by including:
    //   1. Annual ESOP contribution — handled as rate OR dollar amount depending on scale
    //      (values ≤ 1 treated as rate; > 1 treated as flat dollar amount)
    //   2. OIA income pool (reflected in ro.oiaBalance field)
    //   3. S-Corp tax benefit pass-through
    const projectedEbitda = settings.ebitda * Math.pow(1 + settings.ebitdaGrowthRate, idx)
    const contribSource = settings.annualESOPContribution <= 1
      ? projectedEbitda * settings.annualESOPContribution  // rate
      : settings.annualESOPContribution                     // flat dollar amount
    const oiaIncomePool = ro.oiaBalance ?? 0
    const taxBenefit = (settings.scCorporation === 'S' || settings.scCorporation === 'Yes')
      ? settings.taxBenefitAmount : 0
    const cashSource = contribSource + oiaIncomePool + taxBenefit

    const surplus = cashSource - ro.totalRepurchaseObligation
    const cashBurn = cashSource > 0
      ? ro.totalRepurchaseObligation / cashSource : 0

    // Success score: 0.0 to 1.0 scale (displayed as percentage on dashboard)
    // Based on cash burn ratio — lower burn = higher score
    let score: number
    if (cashBurn <= 0) score = valIdeal
    else if (cashBurn < thrExcellent) score = valExcellent
    else if (cashBurn < thrGood) score = valGood
    else if (cashBurn < thrCaution) score = valCaution
    else if (cashBurn < thrConcern) score = valConcern
    else if (cashBurn < thrDeficit) score = valDeficit
    else score = valCritical

    // Health check: 0.0-1.0 scale (displayed as percentage)
    let health: number
    if (surplus >= 0) health = healthGreen                                   // Green: surplus
    else if (surplus >= -cashSource * healthYellowPct) health = healthYellow // Yellow: slight deficit
    else health = healthRed                                                  // Red: major deficit

    const takeaway = health >= 0.8
      ? 'Sustainable - cash sources exceed obligations'
      : health >= 0.5
        ? 'Caution - obligations approaching cash capacity'
        : 'At risk - obligations exceed available cash sources'

    return {
      yearForPayout: ro.calendarYearForPayout,
      repurchaseObligation: ro.totalRepurchaseObligation,
      cashSource,
      surplusOrDeficit: surplus,
      roCashBurn: cashBurn,
      esopSuccessScore: score,
      healthCheck: health,
      keyTakeaway: takeaway,
    }
  })
}

/**
 * Average Age/Tenure summary:
 * Groups participants (active or terminated) and computes mean demographics.
 */
function buildAgeTenureSummary(
  computed: ParticipantComputed[],
  activeOnly: boolean
): AgeTenureRow[] {
  // Group into buckets: by service years
  const buckets: Record<string, ParticipantComputed[]> = {
    '0-5 years': [],
    '5-10 years': [],
    '10-15 years': [],
    '15-20 years': [],
    '20+ years': [],
    'All': [],
  }

  for (const pc of computed) {
    if (activeOnly && !pc.isActive) continue
    if (!activeOnly && pc.isActive) continue

    const yos = pc.yearsOfServiceAtSep
    if (!pc.yearlyData[0]) continue
    buckets['All']!.push(pc)

    if (yos < 5) buckets['0-5 years']!.push(pc)
    else if (yos < 10) buckets['5-10 years']!.push(pc)
    else if (yos < 15) buckets['10-15 years']!.push(pc)
    else if (yos < 20) buckets['15-20 years']!.push(pc)
    else buckets['20+ years']!.push(pc)
  }

  const rows: AgeTenureRow[] = []
  for (const [category, group] of Object.entries(buckets)) {
    if (group.length === 0) {
      rows.push({ category, count: 0, avgAge: 0, avgTenure: 0, avgBalance: 0 })
      continue
    }
    const avgAge = group.reduce(
      (s, pc) => s + (pc.yearlyData[0]?.age ?? 0), 0
    ) / group.length
    const avgTenure = group.reduce(
      (s, pc) => s + (pc.yearlyData[0]?.yearsOfService ?? 0), 0
    ) / group.length
    const avgBalance = group.reduce(
      (s, pc) => s + (pc.yearlyData[0]?.totalAccountValue ?? 0), 0
    ) / group.length

    rows.push({
      category,
      count: group.length,
      avgAge: Math.round(avgAge * 10) / 10,
      avgTenure: Math.round(avgTenure * 10) / 10,
      avgBalance: Math.round(avgBalance),
    })
  }
  return rows
}

/**
 * SEN-222: Year-by-year active population summary.
 *
 * Mirrors legacy `Views/PopulationAnalysis/AverageAgeTenure.cshtml`:
 * weighted averages of age / tenure / compensation / vested balance
 * across active participants for each projection year, with YoY %
 * change on the two dollar columns.
 */
function buildAgeTenureActiveByYear(
  computed: ParticipantComputed[],
  numYears: number
): AgeTenureActiveByYearRow[] {
  const rows: AgeTenureActiveByYearRow[] = []
  let prevComp = 0
  let prevBalance = 0

  for (let yr = 0; yr < numYears; yr++) {
    let count = 0
    let sumAge = 0
    let sumTenure = 0
    let sumComp = 0
    let sumVested = 0
    for (const pc of computed) {
      const yd = pc.yearlyData[yr]!
      if (!yd.isActiveInYear) continue
      count++
      sumAge += yd.age
      sumTenure += yd.yearsOfService
      sumComp += yd.projectedComp
      sumVested += yd.totalAccountValue * yd.vestingPct
    }
    const avgAge = count > 0 ? sumAge / count : 0
    const avgTenure = count > 0 ? sumTenure / count : 0
    const avgBalance = count > 0 ? sumVested / count : 0
    const compPctChange = prevComp > 0 ? (sumComp - prevComp) / prevComp : 0
    const balPctChange = prevBalance > 0 ? (avgBalance - prevBalance) / prevBalance : 0

    rows.push({
      year: `Year ${yr}`,
      averageAge: Math.round(avgAge * 10) / 10,
      averageTenure: Math.round(avgTenure * 10) / 10,
      coveredCompensation: Math.round(sumComp),
      compensationPctChange: compPctChange,
      averageVestedBalance: Math.round(avgBalance),
      balancePctChange: balPctChange,
    })
    prevComp = sumComp
    prevBalance = avgBalance
  }
  return rows
}

/**
 * SEN-222: Year-by-year terminated-population balance splits.
 *
 * Mirrors legacy `Views/PopulationAnalysis/AverageAgeTenureBalance.cshtml`:
 * for each projection year, rank terminated participants by repurchase
 * obligation (vested account value) and report the top-10% and
 * bottom-10% age/balance plus the full-population terminated averages.
 */
function buildAgeTenureTerminatedByYear(
  computed: ParticipantComputed[],
  numYears: number
): AgeTenureTerminatedByYearRow[] {
  const rows: AgeTenureTerminatedByYearRow[] = []

  for (let yr = 0; yr < numYears; yr++) {
    const termined: Array<{ age: number; tenure: number; balance: number }> = []
    for (const pc of computed) {
      if (!pc.isTerminated) continue
      const yd = pc.yearlyData[yr]!
      termined.push({
        age: yd.age,
        tenure: yd.yearsOfService,
        balance: yd.totalAccountValue * yd.vestingPct,
      })
    }
    // Sort descending by balance
    termined.sort((a, b) => b.balance - a.balance)
    const n = termined.length
    const top10Count = Math.max(1, Math.ceil(n * 0.1))
    const bottom10Count = Math.max(1, Math.ceil(n * 0.1))
    const top10 = termined.slice(0, top10Count)
    const bottom10 = termined.slice(-bottom10Count)

    const avg = (arr: typeof termined, key: 'age' | 'tenure' | 'balance') =>
      arr.length > 0 ? arr.reduce((s, r) => s + r[key], 0) / arr.length : 0

    rows.push({
      year: `Year ${yr}`,
      avgAgeTop10pct: Math.round(avg(top10, 'age') * 10) / 10,
      avgBalanceTop10pct: Math.round(avg(top10, 'balance')),
      avgAgeBottom10pct: Math.round(avg(bottom10, 'age') * 10) / 10,
      avgBalanceBottom10pct: Math.round(avg(bottom10, 'balance')),
      avgAgeTerminated: Math.round(avg(termined, 'age') * 10) / 10,
      avgTenureTerminated: Math.round(avg(termined, 'tenure') * 10) / 10,
      avgBalanceTerminated: Math.round(avg(termined, 'balance')),
    })
  }
  return rows
}
