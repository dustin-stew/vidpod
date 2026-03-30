'use client'

import { cn } from '@/lib/utils'
import { formatTimestamp } from '@/lib/utils'
import type { Ad } from '@/types'

interface AdLibraryCardProps {
  ad: Ad
  selected: boolean
  onToggle: (ad: Ad) => void
  selectionMode: 'single' | 'multi'
  selectionNumber?: number
}

export function AdLibraryCard({ ad, selected, onToggle, selectionMode, selectionNumber }: AdLibraryCardProps) {
  return (
    <button
      onClick={() => onToggle(ad)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
        selected
          ? 'border-gray-900 bg-gray-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      {/* Thumbnail */}
      <div className="w-14 h-10 rounded bg-gray-200 shrink-0 overflow-hidden relative">
        {ad.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnailPath} alt={ad.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{ad.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {ad.folder && <span>{ad.folder} · </span>}
          {ad.duration > 0 ? formatTimestamp(ad.duration) : '–'}
        </p>
      </div>

      {/* Selection indicator */}
      <div
        className={cn(
          'w-5 h-5 rounded shrink-0 flex items-center justify-center border transition-colors',
          selected
            ? 'bg-gray-900 border-gray-900 text-white'
            : 'border-gray-300'
        )}
      >
        {selected && selectionMode === 'multi' && selectionNumber != null ? (
          <span className="text-[10px] font-bold leading-none">{selectionNumber}</span>
        ) : selected ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : null}
      </div>
    </button>
  )
}
