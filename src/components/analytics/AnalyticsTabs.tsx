'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PublishedAbTest } from '@/types'
import { AbTestAnalytics } from './AbTestAnalytics'
import { FlightcastDashboard } from './FlightcastDashboard'

interface Props {
  publishedTests: PublishedAbTest[]
}

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'ab-tests', label: 'A/B Tests' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AnalyticsTabs({ publishedTests }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-gray-200 px-6 pt-4">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px',
                activeTab === tab.key
                  ? 'bg-white border border-gray-200 border-b-white text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        {activeTab === 'dashboard' && <FlightcastDashboard />}
        {activeTab === 'ab-tests' && <AbTestAnalytics publishedTests={publishedTests} />}
      </div>
    </div>
  )
}
