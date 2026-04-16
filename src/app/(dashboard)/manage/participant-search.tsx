'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { InputData } from '@/lib/types/database'

export function ParticipantSearch({ rows }: { rows: InputData[] }) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? rows.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()))
    : rows

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Birth Date</th>
              <th className="py-2 pr-4">Hire Date</th>
              <th className="py-2 pr-4 text-right">Plan Comp</th>
              <th className="py-2 pr-4 text-right">Vesting %</th>
              <th className="py-2 pr-4">Term Date</th>
              <th className="py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 pr-4">
                  <Link href={`/manage/${r.row_number}`} className="text-blue-600 hover:underline">
                    {r.row_number}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-medium">
                  <Link href={`/manage/${r.row_number}`} className="text-blue-600 hover:underline">
                    {r.name ?? '---'}
                  </Link>
                </td>
                <td className="py-2 pr-4">{r.birth_date ?? '---'}</td>
                <td className="py-2 pr-4">{r.hire_date ?? '---'}</td>
                <td className="py-2 pr-4 text-right">${r.plan_comp.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right">{(r.vesting_pct * 100).toFixed(0)}%</td>
                <td className="py-2 pr-4">{r.term_date ?? '---'}</td>
                <td className="py-2">{r.reason ?? '---'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-8">No participants match your search.</p>
      )}
    </div>
  )
}
