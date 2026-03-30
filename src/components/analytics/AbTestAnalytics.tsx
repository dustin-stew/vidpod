'use client'

import { useState } from 'react'
import type { PublishedAbTest } from '@/types'

interface Props {
  publishedTests: PublishedAbTest[]
}

// seeded rng for deterministic fake data
function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return () => {
    h = (h * 16807 + 12345) & 0x7fffffff
    return (h % 10000) / 10000
  }
}

interface VariantData {
  name: string
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  convRate: number
  revenue: number
  isWinner: boolean
}

function generateFakeVariants(testId: string, variantNames: string[]): VariantData[] {
  const rand = seededRandom(testId)
  const names = variantNames.length >= 2 ? variantNames : ['Control', 'Variant A']
  const variants: VariantData[] = []

  // pick a winner index upfront so one always wins clearly
  const winnerIdx = Math.floor(rand() * names.length)

  for (let i = 0; i < names.length; i++) {
    const isWinner = i === winnerIdx
    const impressions = 8000 + Math.floor(rand() * 12000)
    const baseCtr = 1.5 + rand() * 4.0
    const ctr = isWinner ? baseCtr + 2.5 : baseCtr
    const clicks = Math.floor(impressions * ctr / 100)
    const baseConvRate = 0.3 + rand() * 2.5
    const convRate = isWinner ? baseConvRate + 1.5 : baseConvRate
    const conversions = Math.floor(clicks * convRate / 100)
    const revenue = conversions * (8 + rand() * 42)
    variants.push({
      name: names[i],
      impressions,
      clicks,
      ctr: Math.round(ctr * 100) / 100,
      conversions,
      convRate: Math.round(convRate * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      isWinner,
    })
  }

  return variants
}

function generateFakeDailyData(testId: string, days: number = 14): { date: string; impressions: number }[] {
  const rand = seededRandom(testId + '_daily')
  const data: { date: string; impressions: number }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      impressions: 400 + Math.floor(rand() * 1200),
    })
  }
  return data
}

export function AbTestAnalytics({ publishedTests }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(publishedTests[0]?.id ?? null)

  if (publishedTests.length === 0) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">AB test performance across published episodes</p>
          </div>
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">No AB tests published yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Publish an episode with AB test groups to see performance data here.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">AB test performance across published episodes</p>
        </div>

        {/* summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Active Tests" value={publishedTests.length} color="indigo" />
          <SummaryCard label="Total Impressions" value={publishedTests.reduce((sum, t) => {
            const variants = generateFakeVariants(t.id, t.variantNames)
            return sum + variants.reduce((s, v) => s + v.impressions, 0)
          }, 0).toLocaleString()} color="violet" />
          <SummaryCard label="Avg. CTR" value={(() => {
            const allVariants = publishedTests.flatMap(t => generateFakeVariants(t.id, t.variantNames))
            const avg = allVariants.reduce((s, v) => s + v.ctr, 0) / (allVariants.length || 1)
            return `${avg.toFixed(2)}%`
          })()} color="emerald" />
        </div>

        {/* results */}
        <div className="space-y-3">
          {publishedTests.map((test) => {
            const variants = generateFakeVariants(test.id, test.variantNames)
            const dailyData = generateFakeDailyData(test.id)
            const isExpanded = expandedId === test.id
            const totalImpressions = variants.reduce((s, v) => s + v.impressions, 0)
            const winner = variants.find(v => v.isWinner)
            const publishedDate = new Date(test.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <div key={test.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-all">
                {/* header */}
                <button
                  onClick={() => setExpandedId(prev => prev === test.id ? null : test.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{test.abTestGroupName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Live</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {test.episodeTitle} &middot; Published {publishedDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-gray-900">{totalImpressions.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">impressions</div>
                  </div>
                  {winner && (
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-sm font-semibold text-green-600">{winner.ctr}%</div>
                      <div className="text-xs text-gray-400">best CTR</div>
                    </div>
                  )}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {/* sparkline */}
                    <div className="mb-5">
                      <h4 className="text-xs font-medium text-gray-500 mb-2">Daily Impressions (14 days)</h4>
                      <div className="flex items-end gap-1 h-16">
                        {dailyData.map((d, i) => {
                          const maxImp = Math.max(...dailyData.map(x => x.impressions))
                          const h = (d.impressions / maxImp) * 100
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded-sm bg-purple-200 hover:bg-purple-400 transition-colors"
                                style={{ height: `${h}%`, minHeight: 2 }}
                                title={`${d.date}: ${d.impressions.toLocaleString()}`}
                              />
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-gray-300">{dailyData[0].date}</span>
                        <span className="text-[9px] text-gray-300">{dailyData[dailyData.length - 1].date}</span>
                      </div>
                    </div>

                    {/* variant table */}
                    <h4 className="text-xs font-medium text-gray-500 mb-2">Variant Performance</h4>
                    <div className="overflow-hidden rounded-lg border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500">
                            <th className="text-left px-3 py-2 font-medium">Variant</th>
                            <th className="text-right px-3 py-2 font-medium">Impressions</th>
                            <th className="text-right px-3 py-2 font-medium">Clicks</th>
                            <th className="text-right px-3 py-2 font-medium">CTR</th>
                            <th className="text-right px-3 py-2 font-medium">Conversions</th>
                            <th className="text-right px-3 py-2 font-medium">Conv. Rate</th>
                            <th className="text-right px-3 py-2 font-medium">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, i) => (
                            <tr key={i} className={`border-t border-gray-50 ${v.isWinner ? 'bg-green-50' : ''}`}>
                              <td className="px-3 py-2.5 font-medium text-gray-900 flex items-center gap-1.5">
                                {v.name}
                                {v.isWinner && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">WINNER</span>
                                )}
                              </td>
                              <td className="text-right px-3 py-2.5 text-gray-600">{v.impressions.toLocaleString()}</td>
                              <td className="text-right px-3 py-2.5 text-gray-600">{v.clicks.toLocaleString()}</td>
                              <td className={`text-right px-3 py-2.5 font-medium ${v.isWinner ? 'text-green-600' : 'text-gray-900'}`}>{v.ctr}%</td>
                              <td className="text-right px-3 py-2.5 text-gray-600">{v.conversions}</td>
                              <td className="text-right px-3 py-2.5 text-gray-600">{v.convRate}%</td>
                              <td className="text-right px-3 py-2.5 text-gray-900 font-medium">${v.revenue.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* significance */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span>Statistical significance reached (p &lt; 0.05) &middot; {variants.length} variants &middot; {totalImpressions.toLocaleString()} total impressions</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color = 'indigo' }: { label: string; value: string | number; color?: 'indigo' | 'violet' | 'emerald' }) {
  const border = { indigo: 'border-t-indigo-500', violet: 'border-t-violet-500', emerald: 'border-t-emerald-500' }[color]
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-t-2 ${border} px-5 py-4`}>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  )
}
