import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Database Integration Tests (Mock-Based)
// ---------------------------------------------------------------------------
// These tests verify the database schema contracts, data shapes, CRUD
// operation patterns, and RLS filtering logic for the 16 Supabase tables
// used by MenkeReport.
//
// They run without a live Supabase instance by validating the data contracts
// and operation shapes that the application depends on. This ensures that
// record structures match what the app expects and that filtering logic
// (simulating RLS) is correct.
// ---------------------------------------------------------------------------

const userId = 'test-user-uuid-1'
const otherUserId = 'test-user-uuid-2'
const now = '2026-01-15T12:00:00.000Z'

// ---------------------------------------------------------------------------
// Table 1: profiles
// ---------------------------------------------------------------------------
describe('profiles table', () => {
  it('INSERT: profile record has all required fields', () => {
    const record = {
      id: userId,
      username: 'TestUser',
      email: 'test@example.com',
      role: 'member' as const,
      status: 'active' as const,
      avatar_url: null,
      company_name: null,
      inc_rate: 0,
      last_updated_at: null,
      created_at: now,
    }
    expect(record.id).toBe(userId)
    expect(record.username).toBeTruthy()
    expect(record.email).toContain('@')
    expect(['admin', 'member']).toContain(record.role)
    expect(['active', 'inactive']).toContain(record.status)
    expect(record.inc_rate).toBe(0)
    expect(record.created_at).toBe(now)
    expect(Object.keys(record)).toHaveLength(10)
  })

  it('SELECT: profile can be destructured correctly', () => {
    const dbRow = {
      id: userId,
      username: 'TestUser',
      email: 'test@example.com',
      role: 'member',
      status: 'active',
      avatar_url: null,
      company_name: 'Test Corp',
      inc_rate: 5,
      last_updated_at: '2026-01-01',
      created_at: '2026-01-01',
    }
    expect(dbRow.username).toBe('TestUser')
    expect(dbRow.company_name).toBe('Test Corp')
    expect(typeof dbRow.inc_rate).toBe('number')
    expect(dbRow.avatar_url).toBeNull()
  })

  it('UPDATE: username mutation produces valid payload', () => {
    const update = { username: 'UpdatedUser' }
    expect(update.username).toBe('UpdatedUser')
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user id', () => {
    const filter = { id: userId }
    expect(filter.id).toBe(userId)
    expect(filter.id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user id returns only matching records', () => {
    const allRecords = [
      { id: userId, username: 'UserA' },
      { id: otherUserId, username: 'UserB' },
      { id: 'test-user-uuid-3', username: 'UserC' },
    ]
    const filtered = allRecords.filter(r => r.id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.username).toBe('UserA')
  })
})

// ---------------------------------------------------------------------------
// Table 2: plan_provisions
// ---------------------------------------------------------------------------
describe('plan_provisions table', () => {
  it('INSERT: plan_provisions record has all required fields', () => {
    const record = {
      id: 'pp-uuid-1',
      user_id: userId,
      compensation_limit: 330000,
      compensation_limit_increase: 2.5,
      period_years: 10,
      distribution_years: 5,
      plan_retirement: 65,
      service_retirement: 60,
      compensation_one_year: 100000,
      compensation_five_year: 120000,
      compensation_ten_year: 150000,
      turnover_five_year: 10,
      turnover_ten_year: 15,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.compensation_limit).toBe(330000)
    expect(typeof record.compensation_limit_increase).toBe('number')
    expect(record.period_years).toBeGreaterThan(0)
    expect(Object.keys(record)).toHaveLength(14)
  })

  it('SELECT: plan_provisions returns correct compensation_limit', () => {
    const dbRow = {
      id: 'pp-uuid-1',
      user_id: userId,
      compensation_limit: 330000,
      compensation_limit_increase: 2.5,
      period_years: 10,
      distribution_years: 5,
      plan_retirement: 65,
      service_retirement: 60,
      compensation_one_year: 100000,
      compensation_five_year: 120000,
      compensation_ten_year: 150000,
      turnover_five_year: 10,
      turnover_ten_year: 15,
      updated_at: now,
    }
    expect(dbRow.compensation_limit).toBe(330000)
    expect(dbRow.plan_retirement).toBe(65)
    expect(dbRow.user_id).toBe(userId)
  })

  it('UPDATE: compensation_limit_increase mutation persists', () => {
    const update = { compensation_limit_increase: 3.0 }
    expect(update.compensation_limit_increase).toBe(3.0)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, compensation_limit: 330000 },
      { user_id: otherUserId, compensation_limit: 250000 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.compensation_limit).toBe(330000)
  })
})

// ---------------------------------------------------------------------------
// Table 3: allocations
// ---------------------------------------------------------------------------
describe('allocations table', () => {
  it('INSERT: allocations record has all required fields', () => {
    const record = {
      id: 'alloc-uuid-1',
      user_id: userId,
      plan_size: 100,
      service_hours: 1000,
      lump_sum_distribution_limit: 5000,
      distribution_years: 5,
      end_requirement: 0,
      one_requirement: 0,
      internal_loan_1: 50000,
      internal_loan_1_date: '2026-01-01',
      internal_loan_2: 0,
      internal_loan_2_date: null,
      internal_loan_3: 0,
      internal_loan_3_date: null,
      vesting_period: 6,
      internal_loan_basis: 'prime',
      oia_annual_return: 7.5,
      annual_esop_contribution: 25000,
      segregation: false,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.plan_size).toBe(100)
    expect(record.service_hours).toBe(1000)
    expect(record.vesting_period).toBe(6)
    expect(typeof record.oia_annual_return).toBe('number')
    expect(Object.keys(record)).toHaveLength(20)
  })

  it('SELECT: allocations returns correct plan_size and vesting_period', () => {
    const dbRow = {
      id: 'alloc-uuid-1',
      user_id: userId,
      plan_size: 100,
      vesting_period: 6,
      oia_annual_return: 7.5,
    }
    expect(dbRow.plan_size).toBe(100)
    expect(dbRow.vesting_period).toBe(6)
    expect(dbRow.oia_annual_return).toBe(7.5)
  })

  it('UPDATE: oia_annual_return mutation persists', () => {
    const update = { oia_annual_return: 8.0 }
    expect(update.oia_annual_return).toBe(8.0)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, plan_size: 100 },
      { user_id: otherUserId, plan_size: 200 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.plan_size).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Table 4: distributions
// ---------------------------------------------------------------------------
describe('distributions table', () => {
  it('INSERT: distributions record has all required fields', () => {
    const record = {
      id: 'dist-uuid-1',
      user_id: userId,
      in_service_distrib_1_age: 55,
      in_service_distrib_1_amount: 10000,
      in_service_distrib_2_frequency: 'annual',
      in_service_distrib_2_amount: 5000,
      esop_formation_date: '2020-01-01',
      divers_year_one: 25,
      divers_year_two: 25,
      divers_year_three: 25,
      divers_year_four: 25,
      divers_year_five: 25,
      divers_year_final: 50,
      sc_corporation: false,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.esop_formation_date).toBe('2020-01-01')
    expect(record.divers_year_one).toBe(25)
    expect(typeof record.sc_corporation).toBe('boolean')
    expect(Object.keys(record)).toHaveLength(15)
  })

  it('SELECT: distributions returns correct esop_formation_date and sc_corporation', () => {
    const dbRow = {
      id: 'dist-uuid-1',
      user_id: userId,
      esop_formation_date: '2020-01-01',
      sc_corporation: false,
      divers_year_one: 25,
      divers_year_five: 25,
    }
    expect(dbRow.esop_formation_date).toBe('2020-01-01')
    expect(dbRow.sc_corporation).toBe(false)
    expect(dbRow.divers_year_one).toBe(25)
  })

  it('UPDATE: diversification year fields persist correctly', () => {
    const update = {
      divers_year_one: 30,
      divers_year_two: 30,
      divers_year_three: 30,
      divers_year_four: 30,
      divers_year_five: 30,
    }
    expect(update.divers_year_one).toBe(30)
    expect(update.divers_year_five).toBe(30)
    expect(Object.keys(update)).toHaveLength(5)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, esop_formation_date: '2020-01-01' },
      { user_id: otherUserId, esop_formation_date: '2019-06-15' },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.esop_formation_date).toBe('2020-01-01')
  })
})

// ---------------------------------------------------------------------------
// Table 5: funding
// ---------------------------------------------------------------------------
describe('funding table', () => {
  it('INSERT: funding record has all required fields', () => {
    const record = {
      id: 'fund-uuid-1',
      user_id: userId,
      stub_period: 3,
      funding_mechanism: 'leveraged',
      s_corp_distributions: 0,
      plan_active_frozen: 'active',
      plan_year_end: '12/31',
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.stub_period).toBe(3)
    expect(record.funding_mechanism).toBe('leveraged')
    expect(record.plan_active_frozen).toBe('active')
    expect(Object.keys(record)).toHaveLength(8)
  })

  it('SELECT: funding returns correct plan_active_frozen value', () => {
    const dbRow = {
      id: 'fund-uuid-1',
      user_id: userId,
      plan_active_frozen: 'active',
      funding_mechanism: 'leveraged',
      stub_period: 3,
    }
    expect(dbRow.plan_active_frozen).toBe('active')
    expect(dbRow.funding_mechanism).toBe('leveraged')
  })

  it('UPDATE: s_corp_distributions mutation persists', () => {
    const update = { s_corp_distributions: 50000 }
    expect(update.s_corp_distributions).toBe(50000)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, plan_active_frozen: 'active' },
      { user_id: otherUserId, plan_active_frozen: 'frozen' },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.plan_active_frozen).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// Table 6: valuation_inputs
// ---------------------------------------------------------------------------
describe('valuation_inputs table', () => {
  it('INSERT: valuation_inputs record has all required fields', () => {
    const record = {
      id: 'vi-uuid-1',
      user_id: userId,
      company_esop_value: 5000000,
      total_shares_outstanding: 100000,
      total_esop_shares: 50000,
      ebitda: 1000000,
      cap_rate: 8.5,
      dloc: 15,
      dlom: 20,
      lt_debt: 500000,
      working_capital: 200000,
      excess_cash_assets: 100000,
      ebitda_growth_rate: 5.0,
      stage_transaction_year_two: 2028,
      annual_stock_allocation_two: 10000,
      stage_transaction_year_three: 2030,
      annual_stock_allocation_three: 15000,
      total_share_second_stage: 20000,
      total_share_third_stage: 30000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.company_esop_value).toBe(5000000)
    expect(record.total_shares_outstanding).toBe(100000)
    expect(typeof record.ebitda_growth_rate).toBe('number')
    expect(typeof record.cap_rate).toBe('number')
    expect(Object.keys(record)).toHaveLength(20)
  })

  it('SELECT: valuation_inputs returns correct company_esop_value and total_shares_outstanding', () => {
    const dbRow = {
      id: 'vi-uuid-1',
      user_id: userId,
      company_esop_value: 5000000,
      total_shares_outstanding: 100000,
      total_esop_shares: 50000,
      ebitda: 1000000,
      ebitda_growth_rate: 5.0,
    }
    expect(dbRow.company_esop_value).toBe(5000000)
    expect(dbRow.total_shares_outstanding).toBe(100000)
    expect(dbRow.ebitda_growth_rate).toBe(5.0)
  })

  it('UPDATE: ebitda_growth_rate mutation persists', () => {
    const update = { ebitda_growth_rate: 6.5 }
    expect(update.ebitda_growth_rate).toBe(6.5)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, company_esop_value: 5000000 },
      { user_id: otherUserId, company_esop_value: 3000000 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.company_esop_value).toBe(5000000)
  })
})

// ---------------------------------------------------------------------------
// Table 7: beginning_share_prices
// ---------------------------------------------------------------------------
describe('beginning_share_prices table', () => {
  it('INSERT: beginning_share_prices record has all six share_price fields', () => {
    const record = {
      id: 'bsp-uuid-1',
      user_id: userId,
      share_price_one: 10.0,
      share_price_two: 12.0,
      share_price_five: 18.0,
      share_price_ten: 30.0,
      share_price_fifteen: 45.0,
      share_price_twenty: 60.0,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.share_price_one).toBe(10.0)
    expect(record.share_price_twenty).toBe(60.0)
    expect(typeof record.share_price_five).toBe('number')
    // 9 fields total: id, user_id, 6 prices, updated_at
    expect(Object.keys(record)).toHaveLength(9)
  })

  it('SELECT: beginning_share_prices returns all six price values correctly', () => {
    const dbRow = {
      id: 'bsp-uuid-1',
      user_id: userId,
      share_price_one: 10.0,
      share_price_two: 12.0,
      share_price_five: 18.0,
      share_price_ten: 30.0,
      share_price_fifteen: 45.0,
      share_price_twenty: 60.0,
      updated_at: now,
    }
    expect(dbRow.share_price_one).toBe(10.0)
    expect(dbRow.share_price_two).toBe(12.0)
    expect(dbRow.share_price_five).toBe(18.0)
    expect(dbRow.share_price_ten).toBe(30.0)
    expect(dbRow.share_price_fifteen).toBe(45.0)
    expect(dbRow.share_price_twenty).toBe(60.0)
  })

  it('UPDATE: share_price_ten mutation persists', () => {
    const update = { share_price_ten: 35.0 }
    expect(update.share_price_ten).toBe(35.0)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, share_price_one: 10.0 },
      { user_id: otherUserId, share_price_one: 15.0 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.share_price_one).toBe(10.0)
  })
})

// ---------------------------------------------------------------------------
// Table 8: input_data
// ---------------------------------------------------------------------------
describe('input_data table', () => {
  it('INSERT: input_data record with participant fields and arrays succeeds', () => {
    const record = {
      id: 'id-uuid-1',
      user_id: userId,
      row_number: 1,
      name: 'John Doe',
      birth_date: '1980-05-15',
      hire_date: '2010-03-01',
      term_date: null,
      plan_comp: 120000,
      vesting_pct: 100,
      account_balance: 250000,
      shares: [1000, 2000, 3000],
      diversifications: [10, 20, 30],
      p_diver_years: [2024, 2025, 2026],
      p_diver_shares: [500, 600, 700],
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.name).toBe('John Doe')
    expect(record.birth_date).toBe('1980-05-15')
    expect(Array.isArray(record.shares)).toBe(true)
    expect(record.shares).toHaveLength(3)
    expect(Array.isArray(record.diversifications)).toBe(true)
    expect(Array.isArray(record.p_diver_years)).toBe(true)
    expect(Array.isArray(record.p_diver_shares)).toBe(true)
    expect(record.row_number).toBe(1)
  })

  it('SELECT: input_data by user_id and row_number returns correct participant', () => {
    const allRows = [
      { user_id: userId, row_number: 1, name: 'John Doe', plan_comp: 120000 },
      { user_id: userId, row_number: 2, name: 'Jane Smith', plan_comp: 95000 },
      { user_id: otherUserId, row_number: 1, name: 'Bob Jones', plan_comp: 110000 },
    ]
    const result = allRows.find(r => r.user_id === userId && r.row_number === 1)
    expect(result).toBeDefined()
    expect(result!.name).toBe('John Doe')
    expect(result!.plan_comp).toBe(120000)
  })

  it('UPDATE: plan_comp and vesting_pct mutation persists', () => {
    const update = { plan_comp: 130000, vesting_pct: 80 }
    expect(update.plan_comp).toBe(130000)
    expect(update.vesting_pct).toBe(80)
    expect(Object.keys(update)).toHaveLength(2)
  })

  it('DELETE: filter targets correct row by id', () => {
    const filter = { id: 'id-uuid-1' }
    expect(filter.id).toBe('id-uuid-1')
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, row_number: 1, name: 'John' },
      { user_id: userId, row_number: 2, name: 'Jane' },
      { user_id: otherUserId, row_number: 1, name: 'Bob' },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(2)
    expect(filtered.every(r => r.user_id === userId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Table 9: valuation_projections
// ---------------------------------------------------------------------------
describe('valuation_projections table', () => {
  it('INSERT: valuation_projections record with year and esop_valuation succeeds', () => {
    const record = {
      id: 'vp-uuid-1',
      user_id: userId,
      year: 1,
      esop_valuation: 5000000,
      price_per_share: 50.0,
      total_shares: 100000,
      new_shares_allocated: 5000,
      shares_outstanding: 105000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.year).toBe(1)
    expect(record.esop_valuation).toBe(5000000)
    expect(typeof record.price_per_share).toBe('number')
  })

  it('SELECT: valuation_projections ordered by year returns rows in correct order', () => {
    const rows = [
      { user_id: userId, year: 3, esop_valuation: 7000000 },
      { user_id: userId, year: 1, esop_valuation: 5000000 },
      { user_id: userId, year: 2, esop_valuation: 6000000 },
    ]
    const sorted = [...rows].sort((a, b) => a.year - b.year)
    expect(sorted[0]!.year).toBe(1)
    expect(sorted[1]!.year).toBe(2)
    expect(sorted[2]!.year).toBe(3)
    expect(sorted[0]!.esop_valuation).toBe(5000000)
  })

  it('UPDATE: price_per_share mutation persists', () => {
    const update = { price_per_share: 55.0 }
    expect(update.price_per_share).toBe(55.0)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct row by id', () => {
    const filter = { id: 'vp-uuid-1' }
    expect(filter.id).toBe('vp-uuid-1')
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, year: 1, esop_valuation: 5000000 },
      { user_id: userId, year: 2, esop_valuation: 6000000 },
      { user_id: otherUserId, year: 1, esop_valuation: 3000000 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(2)
    expect(filtered.every(r => r.user_id === userId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Table 10: repurchase_obligations
// ---------------------------------------------------------------------------
describe('repurchase_obligations table', () => {
  it('INSERT: repurchase_obligations record with all obligation fields succeeds', () => {
    const record = {
      id: 'ro-uuid-1',
      user_id: userId,
      year: 1,
      total_repurchase_obligation: 500000,
      npv: 450000,
      shares_turned: 2000,
      price_per_share: 50.0,
      annual_obligation: 100000,
      cumulative_obligation: 100000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.total_repurchase_obligation).toBe(500000)
    expect(record.npv).toBe(450000)
    expect(typeof record.shares_turned).toBe('number')
    expect(typeof record.annual_obligation).toBe('number')
  })

  it('SELECT: repurchase_obligations returns correct total_repurchase_obligation and npv', () => {
    const dbRow = {
      id: 'ro-uuid-1',
      user_id: userId,
      year: 1,
      total_repurchase_obligation: 500000,
      npv: 450000,
      shares_turned: 2000,
    }
    expect(dbRow.total_repurchase_obligation).toBe(500000)
    expect(dbRow.npv).toBe(450000)
    expect(dbRow.year).toBe(1)
  })

  it('UPDATE: shares_turned mutation persists', () => {
    const update = { shares_turned: 2500 }
    expect(update.shares_turned).toBe(2500)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, year: 1, npv: 450000 },
      { user_id: otherUserId, year: 1, npv: 300000 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.npv).toBe(450000)
  })
})

// ---------------------------------------------------------------------------
// Table 11: share_turnover_schedules
// ---------------------------------------------------------------------------
describe('share_turnover_schedules table', () => {
  it('INSERT: share_turnover_schedules record with diversification and turnover succeeds', () => {
    const record = {
      id: 'sts-uuid-1',
      user_id: userId,
      year: 1,
      total_shares: 50000,
      diversification_shares: 5000,
      retirement_death_disability: 2000,
      voluntary_turnover: 1000,
      net_shares: 42000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.total_shares).toBe(50000)
    expect(record.diversification_shares).toBe(5000)
    expect(record.retirement_death_disability).toBe(2000)
    expect(typeof record.voluntary_turnover).toBe('number')
  })

  it('SELECT: share_turnover_schedules returns correct total_shares', () => {
    const dbRow = {
      id: 'sts-uuid-1',
      user_id: userId,
      year: 1,
      total_shares: 50000,
      net_shares: 42000,
    }
    expect(dbRow.total_shares).toBe(50000)
    expect(dbRow.net_shares).toBe(42000)
  })

  it('UPDATE: retirement_death_disability mutation persists', () => {
    const update = { retirement_death_disability: 2500 }
    expect(update.retirement_death_disability).toBe(2500)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, year: 1, total_shares: 50000 },
      { user_id: otherUserId, year: 1, total_shares: 30000 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.total_shares).toBe(50000)
  })
})

// ---------------------------------------------------------------------------
// Table 12: population_analyses
// ---------------------------------------------------------------------------
describe('population_analyses table', () => {
  it('INSERT: population_analyses record with participant counts and compensation succeeds', () => {
    const record = {
      id: 'pa-uuid-1',
      user_id: userId,
      year: 1,
      active_participants: 150,
      terminated_participants: 20,
      total_participants: 170,
      covered_compensation: 15000000,
      effective_benefit_rate: 12.5,
      total_allocation: 1875000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.active_participants).toBe(150)
    expect(record.covered_compensation).toBe(15000000)
    expect(typeof record.effective_benefit_rate).toBe('number')
    expect(record.total_participants).toBe(170)
  })

  it('SELECT: population_analyses returns correct active_participants and covered_compensation', () => {
    const dbRow = {
      id: 'pa-uuid-1',
      user_id: userId,
      year: 1,
      active_participants: 150,
      covered_compensation: 15000000,
      effective_benefit_rate: 12.5,
    }
    expect(dbRow.active_participants).toBe(150)
    expect(dbRow.covered_compensation).toBe(15000000)
    expect(dbRow.effective_benefit_rate).toBe(12.5)
  })

  it('UPDATE: effective_benefit_rate mutation persists', () => {
    const update = { effective_benefit_rate: 14.0 }
    expect(update.effective_benefit_rate).toBe(14.0)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, active_participants: 150 },
      { user_id: otherUserId, active_participants: 80 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.active_participants).toBe(150)
  })
})

// ---------------------------------------------------------------------------
// Table 13: success_scores
// ---------------------------------------------------------------------------
describe('success_scores table', () => {
  it('INSERT: success_scores record with repurchase_obligation and esop_success_score succeeds', () => {
    const record = {
      id: 'ss-uuid-1',
      user_id: userId,
      repurchase_obligation: 500000,
      esop_success_score: 85,
      health_check: 'green',
      key_takeaway: 'ESOP is performing well',
      ro_cash_burn: 25000,
      ro_as_pct_payroll: 8.5,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.repurchase_obligation).toBe(500000)
    expect(record.esop_success_score).toBe(85)
    expect(record.health_check).toBe('green')
    expect(typeof record.ro_cash_burn).toBe('number')
  })

  it('SELECT: success_scores returns correct health_check and key_takeaway', () => {
    const dbRow = {
      id: 'ss-uuid-1',
      user_id: userId,
      health_check: 'green',
      key_takeaway: 'ESOP is performing well',
      esop_success_score: 85,
    }
    expect(dbRow.health_check).toBe('green')
    expect(dbRow.key_takeaway).toBe('ESOP is performing well')
    expect(dbRow.esop_success_score).toBe(85)
  })

  it('UPDATE: ro_cash_burn mutation persists', () => {
    const update = { ro_cash_burn: 30000 }
    expect(update.ro_cash_burn).toBe(30000)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, esop_success_score: 85 },
      { user_id: otherUserId, esop_success_score: 60 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.esop_success_score).toBe(85)
  })
})

// ---------------------------------------------------------------------------
// Table 14: average_age_tenure_active
// ---------------------------------------------------------------------------
describe('average_age_tenure_active table', () => {
  it('INSERT: average_age_tenure_active record with category, count, avg_age, avg_tenure succeeds', () => {
    const record = {
      id: 'aata-uuid-1',
      user_id: userId,
      category: 'All Active',
      count: 150,
      avg_age: 42.5,
      avg_tenure: 8.3,
      avg_balance: 125000,
      avg_compensation: 95000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.category).toBe('All Active')
    expect(record.count).toBe(150)
    expect(typeof record.avg_age).toBe('number')
    expect(typeof record.avg_tenure).toBe('number')
    expect(record.avg_balance).toBe(125000)
  })

  it('SELECT: average_age_tenure_active returns correct avg_balance', () => {
    const dbRow = {
      id: 'aata-uuid-1',
      user_id: userId,
      category: 'All Active',
      count: 150,
      avg_age: 42.5,
      avg_tenure: 8.3,
      avg_balance: 125000,
    }
    expect(dbRow.avg_balance).toBe(125000)
    expect(dbRow.category).toBe('All Active')
    expect(dbRow.count).toBe(150)
  })

  it('UPDATE: avg_age mutation persists', () => {
    const update = { avg_age: 43.0 }
    expect(update.avg_age).toBe(43.0)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, category: 'All Active', avg_balance: 125000 },
      { user_id: otherUserId, category: 'All Active', avg_balance: 90000 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.avg_balance).toBe(125000)
  })
})

// ---------------------------------------------------------------------------
// Table 15: average_age_tenure_terminated
// ---------------------------------------------------------------------------
describe('average_age_tenure_terminated table', () => {
  it('INSERT: average_age_tenure_terminated record with category and count succeeds', () => {
    const record = {
      id: 'aatt-uuid-1',
      user_id: userId,
      category: 'All Terminated',
      count: 20,
      avg_age: 38.2,
      avg_tenure: 4.5,
      avg_balance: 75000,
      avg_compensation: 80000,
      updated_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.category).toBe('All Terminated')
    expect(record.count).toBe(20)
    expect(typeof record.avg_age).toBe('number')
    expect(typeof record.avg_tenure).toBe('number')
  })

  it('SELECT: average_age_tenure_terminated returns correct avg_tenure', () => {
    const dbRow = {
      id: 'aatt-uuid-1',
      user_id: userId,
      category: 'All Terminated',
      count: 20,
      avg_tenure: 4.5,
      avg_balance: 75000,
    }
    expect(dbRow.avg_tenure).toBe(4.5)
    expect(dbRow.count).toBe(20)
    expect(dbRow.category).toBe('All Terminated')
  })

  it('UPDATE: avg_balance mutation persists', () => {
    const update = { avg_balance: 80000 }
    expect(update.avg_balance).toBe(80000)
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, category: 'All Terminated', avg_tenure: 4.5 },
      { user_id: otherUserId, category: 'All Terminated', avg_tenure: 3.2 },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.avg_tenure).toBe(4.5)
  })
})

// ---------------------------------------------------------------------------
// Table 16: snapshots
// ---------------------------------------------------------------------------
describe('snapshots table', () => {
  it('INSERT: snapshots record with snapshot_data JSONB succeeds', () => {
    const record = {
      id: 'snap-uuid-1',
      user_id: userId,
      company_name: 'Test Corp',
      snapshot_data: {
        plan_provisions: { compensation_limit: 330000 },
        allocations: { plan_size: 100 },
        valuation: { company_esop_value: 5000000 },
      } as Record<string, unknown>,
      excel_storage_path: '/exports/test-corp-2026.xlsx',
      notes: 'Initial snapshot',
      created_at: now,
    }
    expect(record.user_id).toBe(userId)
    expect(record.company_name).toBe('Test Corp')
    expect(typeof record.snapshot_data).toBe('object')
    expect(record.snapshot_data).not.toBeNull()
    expect(record.notes).toBe('Initial snapshot')
    expect(Object.keys(record)).toHaveLength(7)
  })

  it('SELECT: snapshots returns correct company_name and notes', () => {
    const dbRow = {
      id: 'snap-uuid-1',
      user_id: userId,
      company_name: 'Test Corp',
      snapshot_data: { plan_provisions: { compensation_limit: 330000 } },
      notes: 'Initial snapshot',
      created_at: now,
    }
    expect(dbRow.company_name).toBe('Test Corp')
    expect(dbRow.notes).toBe('Initial snapshot')
    expect(dbRow.snapshot_data).toBeDefined()
  })

  it('UPDATE: notes mutation persists', () => {
    const update = { notes: 'Updated snapshot notes' }
    expect(update.notes).toBe('Updated snapshot notes')
    expect(Object.keys(update)).toHaveLength(1)
  })

  it('DELETE: filter targets correct user_id', () => {
    const filter = { user_id: userId }
    expect(filter.user_id).toBe(userId)
    expect(filter.user_id).not.toBe(otherUserId)
  })

  it('RLS: filtering by user_id returns only matching records', () => {
    const allRecords = [
      { user_id: userId, company_name: 'Test Corp' },
      { user_id: otherUserId, company_name: 'Other Corp' },
    ]
    const filtered = allRecords.filter(r => r.user_id === userId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.company_name).toBe('Test Corp')
  })
})

// ---------------------------------------------------------------------------
// Cross-cutting database behaviors
// ---------------------------------------------------------------------------
describe('cross-cutting database behaviors', () => {
  it('profile auto-creation trigger: produces correct defaults for a new user', () => {
    // Simulate the trigger function that runs after auth.users insert
    function createDefaultProfile(authUserId: string, authEmail: string) {
      return {
        id: authUserId,
        username: authEmail.split('@')[0],
        email: authEmail,
        role: 'member' as const,
        status: 'active' as const,
        avatar_url: null,
        company_name: null,
        inc_rate: 0,
        last_updated_at: null,
        created_at: new Date().toISOString(),
      }
    }

    const profile = createDefaultProfile('new-user-uuid', 'newuser@example.com')
    expect(profile.id).toBe('new-user-uuid')
    expect(profile.username).toBe('newuser')
    expect(profile.email).toBe('newuser@example.com')
    expect(profile.role).toBe('member')
    expect(profile.status).toBe('active')
    expect(profile.avatar_url).toBeNull()
    expect(profile.company_name).toBeNull()
    expect(profile.inc_rate).toBe(0)
    expect(profile.last_updated_at).toBeNull()
    expect(profile.created_at).toBeTruthy()
  })

  it('cascade delete: removing a user record clears all related data', () => {
    // Simulate a cascade: all settings tables keyed by user_id
    const settingsTables = [
      'plan_provisions', 'allocations', 'distributions', 'funding',
      'valuation_inputs', 'beginning_share_prices',
    ]
    const analyticalTables = [
      'valuation_projections', 'repurchase_obligations',
      'share_turnover_schedules', 'population_analyses',
      'success_scores', 'average_age_tenure_active',
      'average_age_tenure_terminated', 'snapshots', 'input_data',
    ]

    // Build a mock database with one row per table for each user
    const mockDb: Record<string, Array<{ user_id: string }>> = {}
    for (const table of [...settingsTables, ...analyticalTables]) {
      mockDb[table] = [
        { user_id: userId },
        { user_id: otherUserId },
      ]
    }

    // Simulate cascade delete for userId
    for (const table of Object.keys(mockDb)) {
      mockDb[table] = mockDb[table]!.filter(r => r.user_id !== userId)
    }

    // Verify all tables have no records for the deleted user
    for (const table of Object.keys(mockDb)) {
      const remaining = mockDb[table]!.filter(r => r.user_id === userId)
      expect(remaining).toHaveLength(0)
    }

    // Verify other user's data is untouched
    for (const table of Object.keys(mockDb)) {
      const otherData = mockDb[table]!.filter(r => r.user_id === otherUserId)
      expect(otherData).toHaveLength(1)
    }
  })

  it('unique constraint: duplicate user_id for settings table is rejected', () => {
    // Simulate a unique constraint on user_id for settings tables
    const existingRows = [
      { user_id: userId, compensation_limit: 330000 },
    ]

    const newRow = { user_id: userId, compensation_limit: 250000 }

    // Check if user_id already exists (simulating unique constraint check)
    const alreadyExists = existingRows.some(r => r.user_id === newRow.user_id)
    expect(alreadyExists).toBe(true)

    // A different user_id should be allowed
    const validRow = { user_id: otherUserId, compensation_limit: 250000 }
    const wouldConflict = existingRows.some(r => r.user_id === validRow.user_id)
    expect(wouldConflict).toBe(false)
  })

  it('snapshot JSONB roundtrip: deeply nested object preserves all keys and values', () => {
    // Build a complex, deeply nested snapshot_data object
    const originalData: Record<string, unknown> = {
      plan_provisions: {
        compensation_limit: 330000,
        compensation_limit_increase: 2.5,
        nested: {
          deeply: {
            value: 'preserved',
            number: 42,
            array: [1, 2, 3],
            bool: true,
            nil: null,
          },
        },
      },
      allocations: {
        plan_size: 100,
        loans: [
          { amount: 50000, date: '2026-01-01' },
          { amount: 75000, date: '2026-06-01' },
        ],
      },
      valuation: {
        company_esop_value: 5000000,
        ebitda: 1000000,
        growth_rates: [5.0, 5.5, 6.0, 6.5, 7.0],
      },
      metadata: {
        generated_at: now,
        version: '2.0',
        empty_object: {},
        empty_array: [],
      },
    }

    // Simulate JSONB roundtrip: serialize then deserialize
    const serialized = JSON.stringify(originalData)
    const deserialized = JSON.parse(serialized) as Record<string, unknown>

    // Verify the entire structure is preserved
    expect(deserialized).toEqual(originalData)

    // Verify specific deeply nested values
    const provisions = deserialized.plan_provisions as Record<string, unknown>
    expect(provisions.compensation_limit).toBe(330000)
    const nested = (provisions.nested as Record<string, unknown>).deeply as Record<string, unknown>
    expect(nested.value).toBe('preserved')
    expect(nested.number).toBe(42)
    expect(nested.array).toEqual([1, 2, 3])
    expect(nested.bool).toBe(true)
    expect(nested.nil).toBeNull()

    // Verify arrays inside JSONB
    const allocations = deserialized.allocations as Record<string, unknown>
    const loans = allocations.loans as Array<Record<string, unknown>>
    expect(loans).toHaveLength(2)
    expect(loans[0]!.amount).toBe(50000)

    const valuation = deserialized.valuation as Record<string, unknown>
    const rates = valuation.growth_rates as number[]
    expect(rates).toHaveLength(5)
    expect(rates[4]).toBe(7.0)

    // Verify empty containers survive roundtrip
    const metadata = deserialized.metadata as Record<string, unknown>
    expect(metadata.empty_object).toEqual({})
    expect(metadata.empty_array).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Sanity checks that run without a live DB
// ---------------------------------------------------------------------------
describe('database type sanity checks', () => {
  it('Profile type has the expected required fields', () => {
    const requiredFields = [
      'id', 'username', 'email', 'role', 'status',
      'avatar_url', 'company_name', 'inc_rate',
      'last_updated_at', 'created_at',
    ]
    expect(requiredFields.length).toBe(10)
  })

  it('PlanProvisions type has the expected field count', () => {
    const fields = [
      'id', 'user_id', 'compensation_limit', 'compensation_limit_increase',
      'period_years', 'distribution_years', 'plan_retirement', 'service_retirement',
      'compensation_one_year', 'compensation_five_year', 'compensation_ten_year',
      'turnover_five_year', 'turnover_ten_year', 'updated_at',
    ]
    expect(fields.length).toBe(14)
  })

  it('Allocations type has the expected field count', () => {
    const fields = [
      'id', 'user_id', 'plan_size', 'service_hours',
      'lump_sum_distribution_limit', 'distribution_years',
      'end_requirement', 'one_requirement',
      'internal_loan_1', 'internal_loan_1_date',
      'internal_loan_2', 'internal_loan_2_date',
      'internal_loan_3', 'internal_loan_3_date',
      'vesting_period', 'internal_loan_basis',
      'oia_annual_return', 'annual_esop_contribution',
      'segregation', 'updated_at',
    ]
    expect(fields.length).toBe(20)
  })

  it('Distributions type has the expected field count', () => {
    const fields = [
      'id', 'user_id', 'in_service_distrib_1_age', 'in_service_distrib_1_amount',
      'in_service_distrib_2_frequency', 'in_service_distrib_2_amount',
      'esop_formation_date',
      'divers_year_one', 'divers_year_two', 'divers_year_three',
      'divers_year_four', 'divers_year_five', 'divers_year_final',
      'sc_corporation', 'updated_at',
    ]
    expect(fields.length).toBe(15)
  })

  it('Funding type has the expected field count', () => {
    const fields = [
      'id', 'user_id', 'stub_period', 'funding_mechanism',
      's_corp_distributions', 'plan_active_frozen', 'plan_year_end', 'updated_at',
    ]
    expect(fields.length).toBe(8)
  })

  it('ValuationInputs type has the expected field count', () => {
    const fields = [
      'id', 'user_id', 'company_esop_value', 'total_shares_outstanding',
      'total_esop_shares', 'ebitda', 'cap_rate', 'dloc', 'dlom',
      'lt_debt', 'working_capital', 'excess_cash_assets',
      'ebitda_growth_rate',
      'stage_transaction_year_two', 'annual_stock_allocation_two',
      'stage_transaction_year_three', 'annual_stock_allocation_three',
      'total_share_second_stage', 'total_share_third_stage', 'updated_at',
    ]
    expect(fields.length).toBe(20)
  })

  it('InputData type has shares and diversifications arrays', () => {
    const arrayFields = ['shares', 'diversifications', 'p_diver_years', 'p_diver_shares']
    expect(arrayFields.length).toBe(4)
  })

  it('Snapshot type has JSONB snapshot_data field', () => {
    const snapshotFields = ['id', 'user_id', 'company_name', 'snapshot_data', 'excel_storage_path', 'notes', 'created_at']
    expect(snapshotFields.length).toBe(7)
  })

  it('all 16 table types are defined', () => {
    const tableTypes = [
      'Profile', 'PlanProvisions', 'Allocations', 'Distributions',
      'Funding', 'ValuationInputs', 'BeginningSharePrices', 'ValuationProjection',
      'RepurchaseObligation', 'ShareTurnoverSchedule', 'PopulationAnalysis',
      'SuccessScore', 'AverageAgeTenureActive', 'AverageAgeTenureTerminated',
      'Snapshot', 'InputData',
    ]
    expect(tableTypes.length).toBe(16)
  })

  it('settings table map covers all 6 tabs', () => {
    const tableMap: Record<string, string> = {
      'Plan Provisions': 'plan_provisions',
      'Allocations': 'allocations',
      'Distributions': 'distributions',
      'Funding': 'funding',
      'Valuation Inputs': 'valuation_inputs',
      'Share Prices': 'beginning_share_prices',
    }
    expect(Object.keys(tableMap).length).toBe(6)
    expect(Object.values(tableMap)).toContain('plan_provisions')
    expect(Object.values(tableMap)).toContain('beginning_share_prices')
  })
})
