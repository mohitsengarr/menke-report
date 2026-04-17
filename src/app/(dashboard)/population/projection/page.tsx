'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PopulationProjectionPage() {
  const [rate, setRate] = useState(0)
  const [baseCount, setBaseCount] = useState(0)
  const [projections, setProjections] = useState<{year: number; count: number; newHires: number}[]>([])
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase.from('input_data').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      setBaseCount(count || 0)
    }
    load()
  }, [])

  const calculate = () => {
    setError('')
    if (rate < -50 || rate > 50) {
      setError('Rate must be between -50% and 50%')
      return
    }
    const results = []
    for (let y = 1; y <= 10; y++) {
      const projected = Math.round(baseCount * Math.pow((100 + rate) / 100, y))
      const prev = y === 1 ? baseCount : Math.round(baseCount * Math.pow((100 + rate) / 100, y - 1))
      results.push({ year: y, count: projected, newHires: projected - prev })
    }
    setProjections(results)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Population Projection</h1>

      <Card>
        <CardHeader><CardTitle>Projection Parameters</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">Current active participants: <strong>{baseCount.toLocaleString()}</strong></p>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Change Rate (%)</label>
              <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))}
                min={-50} max={50} step={1}
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <button onClick={calculate}
              className="px-4 py-2 bg-menke-navy text-white rounded-lg hover:bg-menke-navy-light text-sm font-medium">
              Calculate Projection
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {projections.length > 0 && (
        <Card>
          <CardHeader><CardTitle>10-Year Population Forecast ({rate > 0 ? '+' : ''}{rate}% annual)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium">Year</th>
                  <th className="text-right py-2 px-3 font-medium">Projected Count</th>
                  <th className="text-right py-2 px-3 font-medium">New / (Lost)</th>
                  <th className="text-right py-2 px-3 font-medium">Change %</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-blue-50 font-medium">
                  <td className="py-2 px-3">Current</td>
                  <td className="text-right py-2 px-3">{baseCount.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">&mdash;</td>
                  <td className="text-right py-2 px-3">&mdash;</td>
                </tr>
                {projections.map(p => (
                  <tr key={p.year} className="border-b">
                    <td className="py-2 px-3">Year {p.year}</td>
                    <td className="text-right py-2 px-3">{p.count.toLocaleString()}</td>
                    <td className={`text-right py-2 px-3 ${p.newHires >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {p.newHires >= 0 ? '+' : ''}{p.newHires.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">{rate > 0 ? '+' : ''}{rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
