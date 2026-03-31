import type { ReactNode } from 'react'

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    </div>
  )
}

export function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="text-center">
        <p className="text-sm text-red-500">Failed to load data</p>
        {error && <p className="text-xs text-gray-400 mt-1">{error}</p>}
      </div>
    </div>
  )
}
