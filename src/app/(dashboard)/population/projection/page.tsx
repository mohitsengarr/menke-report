'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PopulationProjectionPage() {
  const [rate, setRate] = useState(0)
  const [savedRate, setSavedRate] = useState<number | null>(null)
  const [baseCount, setBaseCount] = useState(0)
  const [projections, setProjections] = useState<{year: number; count: number; newHires: number}[]>([])
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase.from('input_data').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      setBaseCount(count || 0)
      // Load persisted incRate so the page reflects the last projection applied
      const { data: profile } = await supabase.from('profiles').select('inc_rate').eq('id', user.id).single()
      if (profile?.inc_rate !== undefined && profile?.inc_rate !== null) {
        setSavedRate(profile.inc_rate)
        setRate(profile.inc_rate)
      }
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

  const applyToAnalytics = async () => {
    setError('')
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/population/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incRate: rate }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setSaveStatus('error')
        setSaveMessage(json.message || 'Save failed')
        return
      }
      setSaveStatus('saved')
      setSavedRate(rate)
      setSaveMessage(json.message || 'Saved')
    } catch (err) {
      setSaveStatus('error')
      setSaveMessage((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Population Projection</h1>

      <Card>
        <CardHeader><CardTitle>Projection Parameters</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">Current active participants: <strong>{baseCount.toLocaleString()}</strong></p>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Change Rate (%)</label>
              <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))}
                min={-50} max={50} step={1}
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <button onClick={calculate}
              className="px-4 py-2 bg-menke-navy text-white rounded-lg hover:bg-menke-navy-light text-sm font-medium">
              Preview Projection
            </button>
            <button
              onClick={applyToAnalytics}
              disabled={saveStatus === 'saving'}
              className="px-4 py-2 border border-menke-navy text-menke-navy rounded-lg hover:bg-menke-navy/5 text-sm font-medium disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Apply to Analytics'}
            </button>
            {savedRate !== null && (
              <span className="text-xs text-gray-500 ml-1">
                Currently applied: {savedRate >= 0 ? '+' : ''}{savedRate}%
              </span>
            )}
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          {saveStatus === 'saved' && saveMessage && (
            <p className="text-green-700 text-sm mt-2">{saveMessage}</p>
          )}
          {saveStatus === 'error' && saveMessage && (
            <p className="text-red-600 text-sm mt-2">{saveMessage}</p>
          )}
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
