'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdLibraryCard } from './AdLibraryCard'
import { Button } from '@/components/ui/Button'
import type { Ad } from '@/types'

interface AdLibraryPickerProps {
  mode: 'single' | 'multi'
  initialSelection?: string[]
  onConfirm: (adIds: string[]) => void
  onCancel: () => void
}

interface AdLibraryData {
  ads: Ad[]
  folders: string[]
}

export function AdLibraryPicker({ mode, initialSelection = [], onConfirm, onCancel }: AdLibraryPickerProps) {
  const [data, setData] = useState<AdLibraryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/ads')
      .then((r) => r.json())
      .then((d: AdLibraryData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = useCallback(
    (ad: Ad) => {
      setSelectedIds((prev) => {
        if (mode === 'single') {
          return prev.includes(ad.id) ? [] : [ad.id]
        }
        return prev.includes(ad.id) ? prev.filter((id) => id !== ad.id) : [...prev, ad.id]
      })
    },
    [mode]
  )

  const filteredAds = (data?.ads ?? []).filter((ad) => {
    if (activeFolder && ad.folder !== activeFolder) return false
    if (search && !ad.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const canConfirm =
    mode === 'single' ? selectedIds.length === 1 : selectedIds.length >= 2

  return (
    <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeWidth={1.8} d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search ads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
          autoFocus
        />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Folder sidebar */}
        {data && data.folders.length > 0 && (
          <div className="w-36 shrink-0 border-r border-gray-100 py-2 overflow-y-auto">
            <button
              onClick={() => setActiveFolder(null)}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFolder === null ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              All folders
            </button>
            {data.folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder === activeFolder ? null : folder)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  activeFolder === folder ? 'text-gray-900 bg-gray-100 font-medium' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {folder}
              </button>
            ))}
          </div>
        )}

        {/* Ad list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {loading && (
            <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
          )}
          {!loading && filteredAds.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              {data?.ads.length === 0 ? 'No ads uploaded yet' : 'No ads match your search'}
            </div>
          )}
          {filteredAds.map((ad) => (
            <AdLibraryCard
              key={ad.id}
              ad={ad}
              selected={selectedIds.includes(ad.id)}
              onToggle={toggle}
              selectionMode={mode}
              selectionNumber={mode === 'multi' ? selectedIds.indexOf(ad.id) + 1 || undefined : undefined}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {selectedIds.length === 0
            ? 'No ads selected'
            : `${selectedIds.length} ${selectedIds.length === 1 ? 'ad' : 'ads'} selected`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfirm(selectedIds)}
            disabled={!canConfirm}
          >
            {mode === 'single' ? 'Select ad' : `Create A/B test`}
          </Button>
        </div>
      </div>
    </div>
  )
}
