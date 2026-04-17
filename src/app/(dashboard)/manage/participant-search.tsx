'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { InputData } from '@/lib/types/database'

const PAGE_SIZE = 25

export function ParticipantSearch({ rows }: { rows: InputData[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = search
    ? rows.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()))
    : rows

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const startIndex = (page - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, filtered.length)
  const paginatedRows = filtered.slice(startIndex, endIndex)

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={handleSearchChange}
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
            {paginatedRows.map((r) => (
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

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
          <p className="text-sm text-gray-500">
            Showing {startIndex + 1}-{endIndex} of {filtered.length} participants
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
