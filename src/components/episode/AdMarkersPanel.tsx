'use client'

import { useMarkerStore } from '@/store/markerStore'
import { usePlayerStore } from '@/store/playerStore'
import { AdMarkerRow } from './AdMarkerRow'
import { Button } from '@/components/ui/Button'
import type { AdMarker } from '@/types'

interface AdMarkersPanelProps {
  episodeId: string
  onCreateMarker: () => void
  onEditMarker: (marker: AdMarker) => void
}

export function AdMarkersPanel({ episodeId, onCreateMarker, onEditMarker }: AdMarkersPanelProps) {
  const markers = useMarkerStore((s) => s.markers)
  const duration = usePlayerStore((s) => s.duration)

  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp)

  async function handleAutoPlace() {
    if (duration === 0) return
    // Place AUTO markers at every 10 minutes (or divide evenly for short episodes)
    const intervalSec = duration > 600 ? 600 : Math.floor(duration / 3)
    if (intervalSec === 0) return

    const timestamps: number[] = []
    for (let t = intervalSec; t < duration - 30; t += intervalSec) {
      // Skip if too close to an existing marker
      const tooClose = markers.some((m) => Math.abs(m.timestamp - t) < 30)
      if (!tooClose) timestamps.push(t)
    }

    for (const timestamp of timestamps) {
      try {
        const res = await fetch('/api/markers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeId, timestamp, type: 'AUTO', adIds: [] }),
        })
        if (res.ok) {
          const marker: AdMarker = await res.json()
          useMarkerStore.getState().addMarker(marker)
        }
      } catch {
        // non-critical
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Ad markers</h2>
          {markers.length > 0 && (
            <span className="text-xs text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded-full">
              {markers.length}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {markers.length} {markers.length === 1 ? 'marker' : 'markers'}
        </span>
      </div>

      {/* Markers table */}
      {sortedMarkers.length > 0 ? (
        <table className="w-full">
          <tbody>
            {sortedMarkers.map((marker, idx) => (
              <AdMarkerRow
                key={marker.id}
                marker={marker}
                index={idx}
                onEdit={onEditMarker}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="py-8 text-center text-sm text-gray-400">
          No ad markers yet
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        <Button variant="primary" size="sm" onClick={onCreateMarker}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create ad marker
        </Button>
        <Button variant="outline" size="sm" onClick={handleAutoPlace} disabled={duration === 0}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Automatically place
        </Button>
      </div>
    </div>
  )
}
