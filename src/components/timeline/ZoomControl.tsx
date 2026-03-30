'use client'

interface ZoomControlProps {
  zoom: number
  onChange: (zoom: number) => void
  min?: number
  max?: number
}

export function ZoomControl({ zoom, onChange, min = 20, max = 400 }: ZoomControlProps) {
  return (
    <div className="flex items-center gap-2">
      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35M8 11h6" />
      </svg>
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={zoom}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 h-1 accent-gray-700 cursor-pointer"
        title={`Zoom: ${zoom}px/sec`}
      />
      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
      </svg>
    </div>
  )
}
