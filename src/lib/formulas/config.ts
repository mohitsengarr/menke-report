/**
 * Formula Engine Configuration Registry
 * =====================================
 *
 * This is the single source of truth for every tunable parameter that
 * drives the ESOP formula engine. Each entry defines the default value,
 * description, category, and type so it can be rendered in the admin
 * Formula Manager edit page and overridden per user.
 *
 * At runtime the engine calls `resolveFormulaConfig(userOverrides)` to
 * merge database overrides with these defaults. If no override exists
 * for a key, the default value is used.
 *
 * Categories:
 *   - vesting        : Vesting schedule thresholds and graded steps
 *   - compensation   : IRS comp caps and projected salary growth rates
 *   - age            : Age thresholds (RMD, retirement, diversification)
 *   - distribution   : Distribution schedules and eligibility rules
 *   - valuation      : NPV/discount/cap-rate inputs for valuation
 *   - success_score  : Success score & health check thresholds
 *   - plan_defaults  : Plan-level defaults used across the engine
 */

export type FormulaConfigType = 'number' | 'percentage' | 'integer' | 'text' | 'json'

export interface FormulaConfigDef {
  /** Unique snake_case key */
  key: string
  /** Human-readable name */
  label: string
  /** One-sentence plain-English description */
  description: string
  /** Where this parameter is used in the engine */
  usedIn: string
  /** Logical grouping */
  category: 'vesting' | 'compensation' | 'age' | 'distribution' | 'valuation' | 'success_score' | 'plan_defaults'
  /** Data type for UI rendering */
  type: FormulaConfigType
  /** Default value (code-level default) */
  default: number | string | unknown[]
  /** Optional min bound for numeric values */
  min?: number
  /** Optional max bound for numeric values */
  max?: number
  /** Optional display unit (years, %, $, etc) */
  unit?: string
}

/** Full registry of tunable parameters. Order matters — preserves UI ordering. */
export const FORMULA_CONFIG_REGISTRY: FormulaConfigDef[] = [
  // ═══════════════════════════════════════════════════════════════
  // Vesting Schedules
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'vesting.1yr_cliff_threshold',
    label: '1-Year Cliff Threshold',
    description: 'Years of service required before 1-year cliff participants become 100% vested.',
    usedIn: 'calcVestingPct — applies when vestingPeriod = 1',
    category: 'vesting',
    type: 'integer',
    default: 1,
    min: 0,
    max: 10,
    unit: 'years',
  },
  {
    key: 'vesting.3yr_cliff_threshold',
    label: '3-Year Cliff Threshold',
    description: 'Years of service required before 3-year cliff participants become 100% vested.',
    usedIn: 'calcVestingPct — applies when vestingPeriod = 3',
    category: 'vesting',
    type: 'integer',
    default: 3,
    min: 0,
    max: 10,
    unit: 'years',
  },
  {
    key: 'vesting.6yr_graded_start',
    label: '6-Year Graded — Start Year',
    description: 'First year of service at which 6-year graded vesting begins (below this = 0%).',
    usedIn: 'calcVestingPct — applies when vestingPeriod = 6',
    category: 'vesting',
    type: 'integer',
    default: 2,
    min: 1,
    max: 6,
    unit: 'years',
  },
  {
    key: 'vesting.6yr_graded_step',
    label: '6-Year Graded — Annual Step',
    description: 'Vesting percentage added each year during the graded schedule (20% per year → 100% at year 6).',
    usedIn: 'calcVestingPct — applies when vestingPeriod = 6',
    category: 'vesting',
    type: 'percentage',
    default: 0.20,
    min: 0,
    max: 1,
    unit: '%',
  },
  {
    key: 'vesting.6yr_graded_full_year',
    label: '6-Year Graded — 100% Year',
    description: 'Year of service at which graded vesting reaches 100%.',
    usedIn: 'calcVestingPct — applies when vestingPeriod = 6',
    category: 'vesting',
    type: 'integer',
    default: 6,
    min: 3,
    max: 10,
    unit: 'years',
  },

  // ═══════════════════════════════════════════════════════════════
  // Compensation
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'comp.401a17_limit',
    label: 'IRS 401(a)(17) Compensation Limit',
    description: 'Maximum annual compensation considered for plan contributions (IRS annual limit).',
    usedIn: 'calcProjectedComp — caps compensation at this level',
    category: 'compensation',
    type: 'number',
    default: 330000,
    min: 100000,
    max: 1000000,
    unit: '$',
  },
  {
    key: 'comp.401a17_annual_increase',
    label: 'Compensation Limit Annual Increase',
    description: 'Inflation-adjustment rate applied to the IRS comp limit each projection year.',
    usedIn: 'calcProjectedComp — grows the comp limit year over year',
    category: 'compensation',
    type: 'percentage',
    default: 0.02,
    min: 0,
    max: 0.10,
    unit: '%',
  },
  {
    key: 'comp.growth_rate_year_0_1',
    label: 'Comp Growth Rate — Years 0-1',
    description: 'Default projected salary growth rate applied in the first two projection years.',
    usedIn: 'calcProjectedComp — growth rate tier 1',
    category: 'compensation',
    type: 'percentage',
    default: 0.05,
    min: 0,
    max: 0.25,
    unit: '%',
  },
  {
    key: 'comp.growth_rate_year_2_5',
    label: 'Comp Growth Rate — Years 2-5',
    description: 'Default projected salary growth rate applied from years 2 through 5.',
    usedIn: 'calcProjectedComp — growth rate tier 2',
    category: 'compensation',
    type: 'percentage',
    default: 0.04,
    min: 0,
    max: 0.25,
    unit: '%',
  },
  {
    key: 'comp.growth_rate_year_6plus',
    label: 'Comp Growth Rate — Years 6+',
    description: 'Default projected salary growth rate applied from year 6 onward.',
    usedIn: 'calcProjectedComp — growth rate tier 3',
    category: 'compensation',
    type: 'percentage',
    default: 0.03,
    min: 0,
    max: 0.25,
    unit: '%',
  },

  // ═══════════════════════════════════════════════════════════════
  // Age Thresholds
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'age.rmd_start',
    label: 'RMD Start Age',
    description: 'Age at which Required Minimum Distributions begin (IRS 401(a)(9)).',
    usedIn: 'calcRMDShareDist — triggers share RMD when age ≥ this',
    category: 'age',
    type: 'integer',
    default: 72,
    min: 65,
    max: 75,
    unit: 'age',
  },
  {
    key: 'age.diversification_eligibility',
    label: 'Diversification Eligibility Age',
    description: 'Minimum age for diversification election under IRC 401(a)(28).',
    usedIn: 'calcEarlyRetirementDist — age gate',
    category: 'age',
    type: 'integer',
    default: 55,
    min: 50,
    max: 65,
    unit: 'age',
  },
  {
    key: 'age.diversification_service_requirement',
    label: 'Diversification Service Requirement',
    description: 'Minimum years of service required alongside age threshold for diversification.',
    usedIn: 'calcEarlyRetirementDist — service gate',
    category: 'age',
    type: 'integer',
    default: 10,
    min: 5,
    max: 20,
    unit: 'years',
  },
  {
    key: 'age.retirement_default',
    label: 'Normal Retirement Age',
    description: 'Default plan-defined normal retirement age used when no termination date is present.',
    usedIn: 'calcSeparationDate — projects retirement date',
    category: 'age',
    type: 'integer',
    default: 65,
    min: 55,
    max: 75,
    unit: 'age',
  },
  {
    key: 'age.in_service_distribution',
    label: 'In-Service Distribution Age',
    description: 'Minimum age for participants to receive in-service distributions while still employed.',
    usedIn: 'calcInServiceDist — age gate',
    category: 'age',
    type: 'integer',
    default: 59,
    min: 55,
    max: 70,
    unit: 'age',
  },

  // ═══════════════════════════════════════════════════════════════
  // Distribution Rules
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'dist.diversification_years_1_5',
    label: 'Diversification % — Years 1 through 5',
    description: 'Percentage of shares eligible for diversification during each of the first five election years.',
    usedIn: 'calcEarlyRetirementDist — diversYears[0..4]',
    category: 'distribution',
    type: 'percentage',
    default: 0.25,
    min: 0,
    max: 1,
    unit: '%',
  },
  {
    key: 'dist.diversification_year_6',
    label: 'Diversification % — Year 6 (Final)',
    description: 'Percentage of shares eligible for diversification in the final election year (year 6).',
    usedIn: 'calcEarlyRetirementDist — diversYears[5]',
    category: 'distribution',
    type: 'percentage',
    default: 0.50,
    min: 0,
    max: 1,
    unit: '%',
  },
  {
    key: 'dist.distribution_period_default',
    label: 'Default Distribution Period',
    description: 'Default number of installment years for distributing a terminated participant\u2019s vested balance.',
    usedIn: 'calcCashRepurchase — amortization period',
    category: 'distribution',
    type: 'integer',
    default: 5,
    min: 1,
    max: 10,
    unit: 'years',
  },
  {
    key: 'dist.lump_sum_threshold',
    label: 'Lump-Sum Distribution Threshold',
    description: 'Balances at or below this cash value are paid in a single lump sum instead of installments.',
    usedIn: 'calcCashRepurchase — small-balance override',
    category: 'distribution',
    type: 'number',
    default: 5000,
    min: 0,
    max: 100000,
    unit: '$',
  },
  {
    key: 'dist.in_service_amount',
    label: 'In-Service Distribution Amount',
    description: 'Dollar amount distributed annually to participants meeting the in-service age requirement.',
    usedIn: 'calcInServiceDist — fixed dollar draw',
    category: 'distribution',
    type: 'number',
    default: 10000,
    min: 0,
    max: 100000,
    unit: '$',
  },
  {
    key: 'dist.max_distribution_years',
    label: 'Maximum Distribution Years Cap',
    description: 'Absolute cap on the years-since-separation window for turnover distribution calculations.',
    usedIn: 'calcShareRepurchase — post-separation window',
    category: 'distribution',
    type: 'integer',
    default: 10,
    min: 1,
    max: 20,
    unit: 'years',
  },

  // ═══════════════════════════════════════════════════════════════
  // Valuation Inputs
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'val.sarason_discount_rate',
    label: 'Sarason Discount Rate',
    description: 'Discount rate used by the Sarason present-value annuity factor for installment distributions.',
    usedIn: 'lookupSarason — PV annuity factor',
    category: 'valuation',
    type: 'percentage',
    default: 0.05,
    min: 0.01,
    max: 0.15,
    unit: '%',
  },
  {
    key: 'val.npv_discount_rate',
    label: 'NPV Discount Rate',
    description: 'Discount rate used for Net Present Value calculation of repurchase obligations across years.',
    usedIn: 'buildRepurchaseObligations — NPV factor',
    category: 'valuation',
    type: 'percentage',
    default: 0.05,
    min: 0.01,
    max: 0.20,
    unit: '%',
  },
  {
    key: 'val.cap_rate_default',
    label: 'Capitalization Rate Default',
    description: 'Default cap rate applied to EBITDA for enterprise value derivation when none is configured per plan.',
    usedIn: 'buildValuationProjections — enterprise value',
    category: 'valuation',
    type: 'percentage',
    default: 0.15,
    min: 0.05,
    max: 0.50,
    unit: '%',
  },
  {
    key: 'val.ebitda_growth_default',
    label: 'EBITDA Growth Rate Default',
    description: 'Default EBITDA annual growth rate applied to project forward enterprise value.',
    usedIn: 'buildValuationProjections / buildSuccessScores',
    category: 'valuation',
    type: 'percentage',
    default: 0.03,
    min: 0,
    max: 0.20,
    unit: '%',
  },

  // ═══════════════════════════════════════════════════════════════
  // Success Score Thresholds
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'score.threshold_excellent',
    label: 'Success Score — Excellent Threshold',
    description: 'Cash-burn ratio below which the ESOP success score is rated excellent.',
    usedIn: 'buildSuccessScores — score tiering',
    category: 'success_score',
    type: 'percentage',
    default: 0.25,
    min: 0,
    max: 1,
    unit: '%',
  },
  {
    key: 'score.threshold_good',
    label: 'Success Score — Good Threshold',
    description: 'Cash-burn ratio ceiling for a good score.',
    usedIn: 'buildSuccessScores — score tiering',
    category: 'success_score',
    type: 'percentage',
    default: 0.50,
    min: 0,
    max: 1,
    unit: '%',
  },
  {
    key: 'score.threshold_caution',
    label: 'Success Score — Caution Threshold',
    description: 'Cash-burn ratio ceiling at which plan enters caution.',
    usedIn: 'buildSuccessScores — score tiering',
    category: 'success_score',
    type: 'percentage',
    default: 0.75,
    min: 0,
    max: 1.5,
    unit: '%',
  },
  {
    key: 'score.threshold_concern',
    label: 'Success Score — Concern Threshold',
    description: 'Cash-burn ratio at which plan is considered to be under concern.',
    usedIn: 'buildSuccessScores — score tiering',
    category: 'success_score',
    type: 'percentage',
    default: 1.00,
    min: 0,
    max: 2,
    unit: '%',
  },
  {
    key: 'score.threshold_deficit',
    label: 'Success Score — Deficit Threshold',
    description: 'Cash-burn ratio above which plan is in deficit.',
    usedIn: 'buildSuccessScores — score tiering',
    category: 'success_score',
    type: 'percentage',
    default: 1.50,
    min: 0.5,
    max: 3,
    unit: '%',
  },
  {
    key: 'score.value_excellent',
    label: 'Success Score — Excellent Value',
    description: 'Numeric score assigned when cash burn is below excellent threshold.',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.95,
    min: 0.8,
    max: 1,
    unit: '%',
  },
  {
    key: 'score.value_good',
    label: 'Success Score — Good Value',
    description: 'Numeric score assigned when cash burn is below good threshold.',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.85,
    min: 0.6,
    max: 0.95,
    unit: '%',
  },
  {
    key: 'score.value_caution',
    label: 'Success Score — Caution Value',
    description: 'Numeric score assigned when cash burn is below caution threshold.',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.70,
    min: 0.4,
    max: 0.9,
    unit: '%',
  },
  {
    key: 'score.value_concern',
    label: 'Success Score — Concern Value',
    description: 'Numeric score assigned when cash burn is below concern threshold.',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.55,
    min: 0.3,
    max: 0.8,
    unit: '%',
  },
  {
    key: 'score.value_deficit',
    label: 'Success Score — Deficit Value',
    description: 'Numeric score assigned when cash burn is below deficit threshold.',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.35,
    min: 0.1,
    max: 0.7,
    unit: '%',
  },
  {
    key: 'score.value_critical',
    label: 'Success Score — Critical Value',
    description: 'Numeric score assigned when cash burn exceeds deficit threshold (worst case).',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.15,
    min: 0,
    max: 0.5,
    unit: '%',
  },
  {
    key: 'score.value_ideal',
    label: 'Success Score — Ideal Value',
    description: 'Numeric score assigned when there is no cash burn at all (no obligations).',
    usedIn: 'buildSuccessScores — score value',
    category: 'success_score',
    type: 'percentage',
    default: 0.99,
    min: 0.9,
    max: 1,
    unit: '%',
  },
  {
    key: 'score.health_yellow_pct',
    label: 'Health Check — Yellow Band %',
    description: 'Deficit-as-%-of-cash-source threshold between yellow (caution) and red (at risk).',
    usedIn: 'buildSuccessScores — health value',
    category: 'success_score',
    type: 'percentage',
    default: 0.25,
    min: 0,
    max: 1,
    unit: '%',
  },
  {
    key: 'score.health_value_green',
    label: 'Health Check — Green Value',
    description: 'Health numeric value when plan has a surplus (green zone).',
    usedIn: 'buildSuccessScores — health value',
    category: 'success_score',
    type: 'percentage',
    default: 1.0,
    min: 0.8,
    max: 1,
    unit: '%',
  },
  {
    key: 'score.health_value_yellow',
    label: 'Health Check — Yellow Value',
    description: 'Health numeric value when plan has a moderate deficit (yellow zone).',
    usedIn: 'buildSuccessScores — health value',
    category: 'success_score',
    type: 'percentage',
    default: 0.6,
    min: 0.3,
    max: 0.9,
    unit: '%',
  },
  {
    key: 'score.health_value_red',
    label: 'Health Check — Red Value',
    description: 'Health numeric value when plan has a major deficit (red zone).',
    usedIn: 'buildSuccessScores — health value',
    category: 'success_score',
    type: 'percentage',
    default: 0.2,
    min: 0,
    max: 0.5,
    unit: '%',
  },

  // ═══════════════════════════════════════════════════════════════
  // Plan Defaults
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'plan.oia_annual_return',
    label: 'OIA Annual Return Default',
    description: 'Default annual return rate used for Other Investment Accounts (OIA) when not configured per plan.',
    usedIn: 'calcOIAIncome — default return',
    category: 'plan_defaults',
    type: 'percentage',
    default: 0.06,
    min: 0,
    max: 0.20,
    unit: '%',
  },
  {
    key: 'plan.projection_years',
    label: 'Projection Horizon',
    description: 'Number of years projected by the engine (Year 0 through Year N-1).',
    usedIn: 'runFormulaEngine — master loop bounds',
    category: 'plan_defaults',
    type: 'integer',
    default: 11,
    min: 5,
    max: 25,
    unit: 'years',
  },
  {
    key: 'plan.default_turnover_table',
    label: 'Default Turnover Table',
    description: 'Default turnover table identifier (T-1 through T-11, lowest-to-highest turnover).',
    usedIn: 'calcShareRepurchase — when plan has no table configured',
    category: 'plan_defaults',
    type: 'text',
    default: 'T-5',
  },
]

export const CONFIG_CATEGORIES = [
  { id: 'vesting', label: 'Vesting Schedules', color: 'blue' },
  { id: 'compensation', label: 'Compensation', color: 'green' },
  { id: 'age', label: 'Age Thresholds', color: 'purple' },
  { id: 'distribution', label: 'Distribution Rules', color: 'orange' },
  { id: 'valuation', label: 'Valuation Inputs', color: 'red' },
  { id: 'success_score', label: 'Success Score & Health', color: 'yellow' },
  { id: 'plan_defaults', label: 'Plan Defaults', color: 'slate' },
] as const

// ═══════════════════════════════════════════════════════════════
// Resolver
// ═══════════════════════════════════════════════════════════════

export interface FormulaConfigOverride {
  config_key: string
  value_number: number | null
  value_text: string | null
  value_json: unknown
}

/** Resolved config map (key → value). */
export type ResolvedConfig = Record<string, number | string | unknown[]>

/**
 * Merge user-specific overrides from the database with the registry defaults
 * to produce a resolved configuration map the engine can consume directly.
 */
export function resolveFormulaConfig(
  overrides: FormulaConfigOverride[] = []
): ResolvedConfig {
  const out: ResolvedConfig = {}
  // Seed with defaults
  for (const def of FORMULA_CONFIG_REGISTRY) {
    out[def.key] = def.default as number | string | unknown[]
  }
  // Apply overrides (typed by registry)
  const byKey = new Map(FORMULA_CONFIG_REGISTRY.map(d => [d.key, d]))
  for (const o of overrides) {
    const def = byKey.get(o.config_key)
    if (!def) continue
    if (def.type === 'number' || def.type === 'percentage' || def.type === 'integer') {
      if (o.value_number !== null && o.value_number !== undefined) {
        out[def.key] = Number(o.value_number)
      }
    } else if (def.type === 'text') {
      if (o.value_text !== null && o.value_text !== undefined) {
        out[def.key] = o.value_text
      }
    } else if (def.type === 'json') {
      if (o.value_json !== null && o.value_json !== undefined) {
        out[def.key] = o.value_json as unknown[]
      }
    }
  }
  return out
}

/**
 * Get the registry definition for a key (throws on unknown).
 * Useful for validation in API routes.
 */
export function getConfigDef(key: string): FormulaConfigDef {
  const def = FORMULA_CONFIG_REGISTRY.find(d => d.key === key)
  if (!def) throw new Error(`Unknown formula config key: ${key}`)
  return def
}

/** Validate a numeric override is within [min, max] bounds if defined. */
export function validateConfigValue(
  def: FormulaConfigDef,
  value: number | string | unknown
): { ok: true } | { ok: false; error: string } {
  if (def.type === 'number' || def.type === 'percentage' || def.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, error: `${def.label} must be a number` }
    }
    if (def.type === 'integer' && !Number.isInteger(value)) {
      return { ok: false, error: `${def.label} must be an integer` }
    }
    if (def.min !== undefined && value < def.min) {
      return { ok: false, error: `${def.label} must be >= ${def.min}` }
    }
    if (def.max !== undefined && value > def.max) {
      return { ok: false, error: `${def.label} must be <= ${def.max}` }
    }
  } else if (def.type === 'text') {
    if (typeof value !== 'string' || value.length === 0) {
      return { ok: false, error: `${def.label} must be a non-empty string` }
    }
    if (value.length > 100) {
      return { ok: false, error: `${def.label} must be 100 characters or fewer` }
    }
  }
  return { ok: true }
}

/**
 * Build a default compGrowthRates tuple from resolved config (engine uses array form).
 */
export function getCompGrowthRates(cfg: ResolvedConfig): [number, number, number] {
  return [
    Number(cfg['comp.growth_rate_year_0_1']),
    Number(cfg['comp.growth_rate_year_2_5']),
    Number(cfg['comp.growth_rate_year_6plus']),
  ]
}

/**
 * Build a default diversYears tuple (6 elements) from resolved config.
 */
export function getDiversYears(cfg: ResolvedConfig): number[] {
  const yr1_5 = Number(cfg['dist.diversification_years_1_5'])
  const yr6 = Number(cfg['dist.diversification_year_6'])
  return [yr1_5, yr1_5, yr1_5, yr1_5, yr1_5, yr6]
}
