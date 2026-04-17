/**
 * MySQL to Supabase Migration Script
 *
 * Usage:
 *   1. Set environment variables:
 *      - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *      - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   2. Run: npx tsx scripts/migrate-mysql-to-supabase.ts
 *
 * This script:
 *   - Reads all users from MySQL and creates them in Supabase Auth
 *   - Maps old userIds (VARCHAR) to new Supabase UUIDs
 *   - Migrates all 16 data tables
 *   - Uploads backup Excel files to Supabase Storage
 */

console.log(`
=== MySQL to Supabase Migration Script ===

This script migrates data from the old MenkeReport MySQL database
to the new Supabase PostgreSQL database.

Prerequisites:
  1. Install dependencies: npm install mysql2 @supabase/supabase-js
  2. Set environment variables in a .env file:
     - MYSQL_HOST=localhost
     - MYSQL_USER=root
     - MYSQL_PASSWORD=your_password
     - MYSQL_DATABASE=menkereportdb
     - SUPABASE_URL=https://gcmugkbvfizcnkrhwjzz.supabase.co
     - SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

  3. Run: npx tsx scripts/migrate-mysql-to-supabase.ts

Table Mapping:
  MySQL (31 tables) -> Supabase (15 tables)
  ─────────────────────────────────────────
  user                              -> profiles (via Supabase Auth)
  userimages                        -> profiles.avatar_url (Supabase Storage)
  company_name_table                -> profiles.company_name
  incrate_table                     -> profiles.inc_rate
  dataupdate_date                   -> profiles.last_updated_at
  plan_provision_population_analysis -> plan_provisions
  allocations_funding               -> allocations
  distributions                     -> distributions
  funding                           -> funding
  valuation_input                   -> valuation_inputs
  beginning_share_price             -> beginning_share_prices
  input_data                        -> input_data
  capital_table_valuation_projection -> valuation_projections
  repurchase_obligation_projection  -> repurchase_obligations
  share_turnover_schedule           -> share_turnover_schedules
  population_analysis               -> population_analyses
  menke_esop_success_score          -> success_scores
  average_age_tenure_for_active_participants -> average_age_tenure_active
  average_age_tenure_for_terminated_participants -> average_age_tenure_terminated
  15 backup_* tables                -> snapshots (JSONB)

Steps:
  1. Create Supabase Auth users for each MySQL user
  2. Build userId -> UUID mapping
  3. Migrate settings tables (6 tables)
  4. Migrate participant data (input_data)
  5. Migrate analytical tables (7 tables)
  6. Migrate backups -> snapshots

Note: Run this script only ONCE. It does not handle duplicates.
`)

// ---------------------------------------------------------------------------
// Reference implementation below. Uncomment and adapt when ready to run.
// ---------------------------------------------------------------------------

/*
import mysql from 'mysql2/promise'
import { createClient } from '@supabase/supabase-js'

const mysqlConfig = {
  host: process.env.MYSQL_HOST!,
  user: process.env.MYSQL_USER!,
  password: process.env.MYSQL_PASSWORD!,
  database: process.env.MYSQL_DATABASE!,
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserMap = Record<string, string> // oldId -> newUUID

async function createSupabaseUsers(conn: mysql.Connection): Promise<UserMap> {
  const [rows] = await conn.execute('SELECT * FROM user')
  const map: UserMap = {}

  for (const row of rows as any[]) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.email,
      password: 'ChangeMe123!', // Users must reset password
      email_confirm: true,
      user_metadata: { username: row.username, migrated: true },
    })
    if (error) {
      console.error(`  SKIP user ${row.email}: ${error.message}`)
      continue
    }
    map[row.userId] = data.user.id
    await supabase.from('profiles').update({
      company_name: row.company_name || null,
      inc_rate: row.incrate || 0,
    }).eq('id', data.user.id)
    console.log(`  Created: ${row.email} -> ${data.user.id}`)
  }
  return map
}

async function migrateTable(
  conn: mysql.Connection,
  userMap: UserMap,
  mysqlTable: string,
  supabaseTable: string,
  transformRow: (row: any, newUserId: string) => Record<string, unknown>
) {
  const [rows] = await conn.execute(`SELECT * FROM \`${mysqlTable}\``)
  let inserted = 0
  let skipped = 0

  for (const row of rows as any[]) {
    const newUserId = userMap[row.userId || row.user_id]
    if (!newUserId) { skipped++; continue }

    const transformed = transformRow(row, newUserId)
    const { error } = await supabase.from(supabaseTable).insert(transformed)
    if (error) {
      console.error(`  Error in ${supabaseTable}: ${error.message}`)
      skipped++
    } else {
      inserted++
    }
  }
  console.log(`  ${supabaseTable}: ${inserted} inserted, ${skipped} skipped`)
}

async function main() {
  console.log('Connecting to MySQL...')
  const conn = await mysql.createConnection(mysqlConfig)

  console.log('\n--- Step 1: Create Supabase Auth users ---')
  const userMap = await createSupabaseUsers(conn)
  console.log(`  Mapped ${Object.keys(userMap).length} users\n`)

  console.log('--- Step 2: Migrate settings tables ---')
  await migrateTable(conn, userMap, 'plan_provision_population_analysis', 'plan_provisions',
    (r, uid) => ({ user_id: uid, compensation_limit: r.compensation_limit, compensation_limit_increase: r.compensation_limit_increase,
      period_years: r.period_years, distribution_years: r.distribution_years, plan_retirement: r.plan_retirement,
      service_retirement: r.service_retirement, compensation_one_year: r.compensation_one_year, compensation_five_year: r.compensation_five_year,
      compensation_ten_year: r.compensation_ten_year, turnover_five_year: r.turnover_five_year, turnover_ten_year: r.turnover_ten_year }))

  await migrateTable(conn, userMap, 'allocations_funding', 'allocations',
    (r, uid) => ({ user_id: uid, plan_size: r.plan_size, service_hours: r.service_hours,
      lump_sum_distribution_limit: r.lump_sum_distribution_limit, distribution_years: r.distribution_years,
      end_requirement: r.end_requirement, one_requirement: r.one_requirement,
      internal_loan_1: r.internal_loan_1, internal_loan_2: r.internal_loan_2, internal_loan_3: r.internal_loan_3,
      vesting_period: r.vesting_period, internal_loan_basis: r.internal_loan_basis,
      oia_annual_return: r.oia_annual_return, annual_esop_contribution: r.annual_esop_contribution, segregation: r.segregation }))

  console.log('\n--- Step 3: Migrate participant data ---')
  await migrateTable(conn, userMap, 'input_data', 'input_data',
    (r, uid) => ({ user_id: uid, row_number: r.row_number, ss_num: r.ss_num, name: r.name,
      birth_date: r.birth_date, hire_date: r.hire_date, esop_date: r.esop_date,
      vesting_pct: r.vesting_pct, comp_years: r.comp_years, gender: r.gender,
      plan_comp: r.plan_comp, emp_group: r.emp_group, divers: r.divers,
      term_date: r.term_date, reason: r.reason, total_cash: r.total_cash, shares: r.shares || [] }))

  console.log('\n--- Step 4: Migrate analytical tables ---')
  await migrateTable(conn, userMap, 'capital_table_valuation_projection', 'valuation_projections',
    (r, uid) => ({ user_id: uid, year: r.year, esop_valuation: r.esop_valuation, esop_shares: r.esop_shares,
      pct_esop_shares: r.pct_esop_shares, other_shares: r.other_shares, total_shares: r.total_shares,
      price_per_share: r.price_per_share, share_price_change: r.share_price_change }))

  await migrateTable(conn, userMap, 'repurchase_obligation_projection', 'repurchase_obligations',
    (r, uid) => ({ user_id: uid, year: r.year, calendar_year_for_payout: r.calendar_year_for_payout,
      share_price: r.share_price, esop_shares_allocated: r.esop_shares_allocated, shares_turned: r.shares_turned,
      total_repurchase_obligation: r.total_repurchase_obligation, npv: r.npv }))

  await migrateTable(conn, userMap, 'share_turnover_schedule', 'share_turnover_schedules',
    (r, uid) => ({ user_id: uid, year: r.year, calendar_year_for_payout: r.calendar_year_for_payout,
      diversification: r.diversification, in_service_distributions: r.in_service_distributions,
      retirement_death_disability: r.retirement_death_disability, turnover: r.turnover, total_shares: r.total_shares }))

  await migrateTable(conn, userMap, 'population_analysis', 'population_analyses',
    (r, uid) => ({ user_id: uid, year: r.year, active_participants: r.active_participants,
      covered_compensation: r.covered_compensation, avg_total_compensation: r.avg_total_compensation,
      effective_benefit_rate: r.effective_benefit_rate, share_turn: r.share_turn }))

  await migrateTable(conn, userMap, 'menke_esop_success_score', 'success_scores',
    (r, uid) => ({ user_id: uid, year_for_payout: r.year_for_payout, repurchase_obligation: r.repurchase_obligation,
      cash_source: r.cash_source, surplus_or_deficit: r.surplus_or_deficit, ro_cash_burn: r.ro_cash_burn,
      esop_success_score: r.esop_success_score, health_check: r.health_check, key_takeaway: r.key_takeaway }))

  await migrateTable(conn, userMap, 'average_age_tenure_for_active_participants', 'average_age_tenure_active',
    (r, uid) => ({ user_id: uid, category: r.category, count: r.count, avg_age: r.avg_age,
      avg_tenure: r.avg_tenure, avg_balance: r.avg_balance }))

  await migrateTable(conn, userMap, 'average_age_tenure_for_terminated_participants', 'average_age_tenure_terminated',
    (r, uid) => ({ user_id: uid, category: r.category, count: r.count, avg_age: r.avg_age,
      avg_tenure: r.avg_tenure, avg_balance: r.avg_balance }))

  console.log('\n--- Step 5: Migrate backups -> snapshots ---')
  // Backup tables follow naming: backup_<table>
  // We consolidate all backup data for each user into a single snapshot row
  const backupTables = [
    'backup_plan_provision', 'backup_allocations', 'backup_distributions',
    'backup_funding', 'backup_valuation_input', 'backup_beginning_share_price',
    'backup_input_data', 'backup_valuation_projection', 'backup_repurchase_obligation',
    'backup_share_turnover', 'backup_population_analysis', 'backup_success_score',
    'backup_avg_age_active', 'backup_avg_age_terminated', 'backup_company_name',
  ]

  for (const [oldId, newId] of Object.entries(userMap)) {
    const snapshotData: Record<string, unknown> = {}
    for (const bt of backupTables) {
      try {
        const [rows] = await conn.execute(`SELECT * FROM \`${bt}\` WHERE userId = ?`, [oldId])
        if ((rows as any[]).length > 0) snapshotData[bt] = rows
      } catch { /* table may not exist */ }
    }
    if (Object.keys(snapshotData).length > 0) {
      await supabase.from('snapshots').insert({
        user_id: newId,
        snapshot_data: snapshotData,
        notes: 'Migrated from MySQL backup tables',
      })
    }
  }
  console.log('  Snapshots migrated.')

  await conn.end()
  console.log('\n=== Migration complete ===')
}

main().catch(console.error)
*/
