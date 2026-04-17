'use client'

import { useMemo, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FormulaConfigDef } from '@/lib/formulas/config'

interface OverrideEntry { value: number | string | null; updated_at: string }
interface AuditRow {
  config_key: string
  action: string
  new_value_number: number | null
  new_value_text: string | null
  previous_value_number: number | null
  previous_value_text: string | null
  created_at: string
}

interface Props {
  registry: FormulaConfigDef[]
  categories: Array<{ id: string; label: string; color: string }>
  overrides: Record<string, OverrideEntry>
  recentAudit: AuditRow[]
}

type Draft = Record<string, string>
type RowStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function FormulaEditor({ registry, categories, overrides, recentAudit }: Props) {
  const [drafts, setDrafts] = useState<Draft>({})
  const [status, setStatus] = useState<Record<string, RowStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedOverrides, setSavedOverrides] = useState<Record<string, OverrideEntry>>(overrides)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'overridden' | 'defaults'>('all')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const overrideCount = Object.keys(savedOverrides).length

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return registry.filter(def => {
      if (activeCategory !== 'all' && def.category !== activeCategory) return false
      if (filter === 'overridden' && !savedOverrides[def.key]) return false
      if (filter === 'defaults' && savedOverrides[def.key]) return false
      if (!needle) return true
      return (
        def.label.toLowerCase().includes(needle) ||
        def.description.toLowerCase().includes(needle) ||
        def.key.toLowerCase().includes(needle) ||
        def.usedIn.toLowerCase().includes(needle)
      )
    })
  }, [registry, search, filter, activeCategory, savedOverrides])

  const grouped = useMemo(() => {
    const out: Record<string, FormulaConfigDef[]> = {}
    for (const def of filtered) {
      if (!out[def.category]) out[def.category] = []
      out[def.category]!.push(def)
    }
    return out
  }, [filtered])

  function getCurrentValue(def: FormulaConfigDef): number | string {
    const override = savedOverrides[def.key]
    if (override && override.value !== null) return override.value
    return def.default as number | string
  }

  function formatValue(def: FormulaConfigDef, v: number | string | null): string {
    if (v === null || v === undefined) return ''
    if (def.type === 'percentage' && typeof v === 'number') {
      return (v * 100).toFixed(2)
    }
    return String(v)
  }

  function parseDraft(def: FormulaConfigDef, raw: string): number | string | null {
    if (raw === '') return null
    if (def.type === 'text') return raw
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    if (def.type === 'percentage') return n / 100
    return n
  }

  async function saveRow(def: FormulaConfigDef) {
    const raw = drafts[def.key] ?? formatValue(def, getCurrentValue(def))
    const value = parseDraft(def, raw)
    if (value === null) {
      setStatus(s => ({ ...s, [def.key]: 'error' }))
      setErrors(e => ({ ...e, [def.key]: 'Enter a valid value.' }))
      return
    }
    setStatus(s => ({ ...s, [def.key]: 'saving' }))
    setErrors(e => ({ ...e, [def.key]: '' }))

    const res = await fetch('/api/formulas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: def.key, value }),
    })
    const json = await res.json()

    if (!res.ok || !json.success) {
      setStatus(s => ({ ...s, [def.key]: 'error' }))
      setErrors(e => ({ ...e, [def.key]: json.message || 'Save failed' }))
      return
    }

    setStatus(s => ({ ...s, [def.key]: 'saved' }))
    setSavedOverrides(prev => ({
      ...prev,
      [def.key]: { value, updated_at: new Date().toISOString() },
    }))
    setBanner({ kind: 'success', text: `Saved ${def.label}` })
    setTimeout(() => setBanner(null), 2500)
  }

  async function resetRow(def: FormulaConfigDef) {
    setStatus(s => ({ ...s, [def.key]: 'saving' }))
    const res = await fetch(`/api/formulas?key=${encodeURIComponent(def.key)}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok || !json.success) {
      setStatus(s => ({ ...s, [def.key]: 'error' }))
      setErrors(e => ({ ...e, [def.key]: json.message || 'Reset failed' }))
      return
    }
    setStatus(s => ({ ...s, [def.key]: 'saved' }))
    setDrafts(d => {
      const copy = { ...d }
      delete copy[def.key]
      return copy
    })
    setSavedOverrides(prev => {
      const copy = { ...prev }
      delete copy[def.key]
      return copy
    })
    setBanner({ kind: 'success', text: `Reset ${def.label} to default` })
    setTimeout(() => setBanner(null), 2500)
  }

  async function resetAll() {
    setResetAllOpen(false)
    startTransition(async () => {
      const res = await fetch('/api/formulas/reset', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setBanner({ kind: 'error', text: json.message || 'Reset all failed' })
        return
      }
      setSavedOverrides({})
      setDrafts({})
      setBanner({ kind: 'success', text: `Reset ${json.resetCount ?? 0} parameters to defaults` })
      setTimeout(() => setBanner(null), 3000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-lg border px-4 py-3 text-sm ${
              banner.kind === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
            data-testid="banner"
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryTile label="Total Parameters" value={registry.length} />
        <SummaryTile label="Customized" value={overrideCount} accent={overrideCount > 0} />
        <SummaryTile label="At Defaults" value={registry.length - overrideCount} />
        <SummaryTile label="Categories" value={categories.length} />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Search by name, description, or key..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-menke-navy"
            aria-label="Search parameters"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'overridden' | 'defaults')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-menke-navy"
            aria-label="Filter status"
          >
            <option value="all">All</option>
            <option value="overridden">Customized only</option>
            <option value="defaults">At default only</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => setResetAllOpen(true)}
          disabled={overrideCount === 0 || isPending}
          className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset all to defaults
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        <CategoryTab active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>All</CategoryTab>
        {categories.map(c => (
          <CategoryTab
            key={c.id}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
          >
            {c.label}
          </CategoryTab>
        ))}
      </div>

      {/* Parameter tables grouped by category */}
      <div className="space-y-8">
        {Object.entries(grouped).map(([categoryId, defs]) => {
          const cat = categories.find(c => c.id === categoryId)
          return (
            <section key={categoryId}>
              <h2 className="text-lg font-semibold text-menke-navy mb-2">
                {cat?.label ?? categoryId}
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  ({defs.length} parameter{defs.length === 1 ? '' : 's'})
                </span>
              </h2>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-left text-gray-700">
                      <th className="py-2 px-3 font-medium">Parameter</th>
                      <th className="py-2 px-3 font-medium w-40">Current Value</th>
                      <th className="py-2 px-3 font-medium w-40">Default</th>
                      <th className="py-2 px-3 font-medium w-52">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((def, i) => {
                      const override = savedOverrides[def.key]
                      const isOverridden = !!override
                      const currentValue = getCurrentValue(def)
                      const draftRaw = drafts[def.key]
                      const displayed = draftRaw !== undefined
                        ? draftRaw
                        : formatValue(def, currentValue)
                      const s = status[def.key] ?? 'idle'
                      const err = errors[def.key]
                      return (
                        <tr
                          key={def.key}
                          data-testid={`row-${def.key}`}
                          className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${isOverridden ? 'ring-1 ring-inset ring-blue-100' : ''}`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-900">{def.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{def.description}</div>
                            <div className="text-[11px] text-gray-400 mt-1 font-mono">
                              {def.key} &middot; used in: <span className="italic">{def.usedIn}</span>
                            </div>
                            {isOverridden && (
                              <div className="text-[11px] text-blue-700 mt-1">
                                Customized &middot; last updated {new Date(override.updated_at).toLocaleString()}
                              </div>
                            )}
                            {err && (
                              <div className="text-[11px] text-red-600 mt-1">{err}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <input
                                type={def.type === 'text' ? 'text' : 'number'}
                                step={def.type === 'percentage' ? '0.01' : 'any'}
                                value={displayed}
                                min={def.min}
                                max={def.type === 'percentage' && def.max !== undefined ? def.max * 100 : def.max}
                                onChange={e => setDrafts(d => ({ ...d, [def.key]: e.target.value }))}
                                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-menke-navy"
                                aria-label={`${def.label} value`}
                                data-testid={`input-${def.key}`}
                              />
                              {def.unit && (
                                <span className="text-xs text-gray-500">{def.unit}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-500">
                            {formatValue(def, def.default as number | string)}
                            {def.unit ? ` ${def.unit}` : ''}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveRow(def)}
                                disabled={s === 'saving'}
                                className="px-2.5 py-1 text-xs font-medium bg-menke-navy text-white rounded-md hover:bg-menke-navy-light disabled:opacity-40"
                                data-testid={`save-${def.key}`}
                              >
                                {s === 'saving' ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => resetRow(def)}
                                disabled={!isOverridden || s === 'saving'}
                                className="px-2.5 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                data-testid={`reset-${def.key}`}
                              >
                                Reset
                              </button>
                              {s === 'saved' && (
                                <span className="text-xs text-green-700">✓</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No parameters match your filters.
        </div>
      )}

      {/* Audit log */}
      {recentAudit.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-menke-navy mb-2">Recent Changes</h2>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-gray-700">
                  <th className="py-2 px-3 font-medium">When</th>
                  <th className="py-2 px-3 font-medium">Parameter</th>
                  <th className="py-2 px-3 font-medium">Action</th>
                  <th className="py-2 px-3 font-medium">From → To</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((r, i) => (
                  <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{r.config_key}</td>
                    <td className="py-2 px-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        r.action === 'create' ? 'bg-green-100 text-green-800'
                          : r.action === 'update' ? 'bg-blue-100 text-blue-800'
                          : r.action === 'reset' ? 'bg-gray-100 text-gray-700'
                          : 'bg-red-100 text-red-800'
                      }`}>{r.action}</span>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600">
                      {formatAuditValue(r.previous_value_number, r.previous_value_text)}
                      {' → '}
                      {formatAuditValue(r.new_value_number, r.new_value_text)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reset All modal */}
      <AnimatePresence>
        {resetAllOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setResetAllOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-semibold text-menke-navy">Reset all parameters?</h3>
              <p className="mt-2 text-sm text-gray-600">
                This will revert all {overrideCount} customized parameter{overrideCount === 1 ? '' : 's'} to
                their code-level default values. This action cannot be undone, but the audit log
                will retain a record of previous values.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetAllOpen(false)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Reset all {overrideCount} to defaults
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'}`}>
      <div className="text-2xl font-bold text-menke-navy">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function CategoryTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
        active
          ? 'bg-menke-navy text-white'
          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function formatAuditValue(num: number | null, text: string | null): string {
  if (num !== null && num !== undefined) return String(num)
  if (text) return text
  return '(default)'
}
