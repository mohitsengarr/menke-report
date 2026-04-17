'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import type { InputData } from '@/lib/types/database'

interface Props {
  participant: InputData
  isNew?: boolean
}

type FieldType = 'text' | 'number' | 'date' | 'select' | 'percent'

interface FieldSpec {
  key: keyof InputData
  label: string
  type: FieldType
  options?: readonly string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  group: 'identity' | 'dates' | 'plan' | 'separation' | 'amounts'
}

const FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', group: 'identity' },
  { key: 'ss_num', label: 'SSN (last 4)', type: 'text', group: 'identity', placeholder: '1234' },
  { key: 'ss_seq', label: 'SS Seq', type: 'text', group: 'identity' },
  { key: 'loc_no', label: 'Location No', type: 'text', group: 'identity' },
  { key: 'div_no', label: 'Division No', type: 'text', group: 'identity' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['M', 'F'], group: 'identity' },
  { key: 'emp_group', label: 'Employee Group', type: 'number', min: 0, group: 'identity' },

  { key: 'birth_date', label: 'Birth Date', type: 'date', group: 'dates' },
  { key: 'hire_date', label: 'Hire Date', type: 'date', group: 'dates' },
  { key: 'esop_date', label: 'ESOP Entry Date', type: 'date', group: 'dates' },
  { key: 'term_date', label: 'Termination Date', type: 'date', group: 'separation' },

  { key: 'vesting_pct', label: 'Vesting %', type: 'percent', min: 0, max: 1, step: 0.01, group: 'plan' },
  { key: 'comp_years', label: 'Comp Years', type: 'number', min: 0, step: 0.1, group: 'plan' },
  { key: 'plan_comp', label: 'Plan Compensation ($)', type: 'number', min: 0, group: 'plan' },
  { key: 'divers', label: 'Diversification Elected', type: 'number', min: 0, group: 'plan' },
  { key: 'sra', label: 'SRA', type: 'text', group: 'plan' },

  { key: 'reason', label: 'Separation Reason', type: 'select',
    options: ['', 'RETIREMENT', 'TURNOVER', 'DEATH', 'DISABILITY'], group: 'separation' },
  { key: 'nonvested', label: 'Non-Vested Flag', type: 'text', group: 'separation' },

  { key: 'total_cash', label: 'Total Cash ($)', type: 'number', min: 0, group: 'amounts' },
  { key: 'oia_tranche', label: 'OIA Tranche', type: 'number', min: 0, group: 'amounts' },
  { key: 'stock_tranche', label: 'Stock Tranche', type: 'number', min: 0, group: 'amounts' },
]

const GROUP_LABELS: Record<FieldSpec['group'], string> = {
  identity: 'Identity',
  dates: 'Dates',
  plan: 'Plan Details',
  separation: 'Separation',
  amounts: 'Account Values',
}

function formatFieldValue(value: unknown, type: FieldType): string {
  if (value === null || value === undefined) return ''
  if (type === 'date' && typeof value === 'string') return value.slice(0, 10)
  if (type === 'percent' && typeof value === 'number') return (value * 100).toFixed(2)
  return String(value)
}

function parseFieldValue(raw: string, type: FieldType): string | number | null {
  if (raw === '' && type !== 'text' && type !== 'select') return null
  if (type === 'percent') {
    const n = Number(raw)
    return Number.isFinite(n) ? n / 100 : 0
  }
  if (type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  return raw
}

export default function ParticipantForm({ participant, isNew = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const field of FIELDS) {
      out[field.key as string] = formatFieldValue(participant[field.key], field.type)
    }
    return out
  })
  const [shares, setShares] = useState<string[]>(() =>
    (participant.shares ?? new Array(10).fill(0)).map(v => String(v))
  )
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function onField(key: string, val: string) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  async function save() {
    setSaving(true)
    setBanner(null)
    // Build payload
    const payload: Record<string, unknown> = {}
    for (const field of FIELDS) {
      payload[field.key as string] = parseFieldValue(draft[field.key as string] ?? '', field.type)
    }
    payload.shares = shares.map(s => Number(s) || 0)

    const url = isNew ? '/api/participants' : `/api/participants/${participant.row_number}`
    const method = isNew ? 'POST' : 'PUT'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setBanner({ kind: 'error', text: json.message || 'Save failed' })
      } else {
        setBanner({ kind: 'success', text: json.message || 'Saved' })
        if (isNew && json.participant?.row_number) {
          startTransition(() => router.replace(`/manage/${json.participant.row_number}`))
        } else {
          startTransition(() => router.refresh())
        }
      }
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    setDeleting(true)
    setBanner(null)
    try {
      const res = await fetch(`/api/participants/${participant.row_number}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setBanner({ kind: 'error', text: json.message || 'Delete failed' })
        setDeleting(false)
      } else {
        startTransition(() => router.push('/manage'))
      }
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message })
      setDeleting(false)
    }
  }

  const groups = Array.from(new Set(FIELDS.map(f => f.group))) as FieldSpec['group'][]

  return (
    <div className="space-y-6">
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
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      {groups.map(group => (
        <section key={group} className="space-y-3">
          <h3 className="text-sm font-semibold text-menke-navy uppercase tracking-wide">{GROUP_LABELS[group]}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FIELDS.filter(f => f.group === group).map(field => (
              <div key={field.key as string} className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">
                  {field.label}
                  {field.type === 'percent' && <span className="text-gray-400 ml-1">(%)</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={draft[field.key as string] ?? ''}
                    onChange={e => onField(field.key as string, e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-menke-navy"
                  >
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt || '—'}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'percent' ? 'number' : 'text'}
                    value={draft[field.key as string] ?? ''}
                    onChange={e => onField(field.key as string, e.target.value)}
                    min={field.min}
                    max={field.type === 'percent' && field.max !== undefined ? field.max * 100 : field.max}
                    step={field.step}
                    placeholder={field.placeholder}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-menke-navy"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-menke-navy uppercase tracking-wide">
          10-Year Share Allocations
        </h3>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {shares.map((s, i) => (
            <div key={i} className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Yr {i + 1}</label>
              <input
                type="number"
                min={0}
                value={s}
                onChange={e => setShares(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-menke-navy"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={save}
          disabled={saving || isPending}
          className="px-4 py-2 bg-menke-navy text-white text-sm font-medium rounded-md hover:bg-menke-navy-light disabled:opacity-50"
        >
          {saving ? 'Saving…' : isNew ? 'Create Participant' : 'Save Changes'}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || isPending}
            className="px-4 py-2 text-sm font-medium border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          Row #{participant.row_number}
        </span>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => !deleting && setConfirmDelete(false)}
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
              <h3 className="text-lg font-semibold text-menke-navy">
                Delete participant #{participant.row_number}?
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                This will permanently remove {participant.name || 'this participant'} from the input data.
                Analytical projections will need to be recomputed on your next Excel upload.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={del}
                  disabled={deleting}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
