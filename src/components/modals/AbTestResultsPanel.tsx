'use client'

import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { AdMarker } from '@/types'

interface AbTestResultsPanelProps {
  marker: AdMarker
  open: boolean
  onClose: () => void
  onNewTest: () => void
}

// Mock analytics values — real tracking is out of scope for Phase 1.
// In production, these would come from an analytics/event pipeline.
function mockMetrics(adId: string) {
  const seed = adId.charCodeAt(0) + adId.charCodeAt(adId.length - 1)
  return {
    plays: 1200 + (seed * 37) % 800,
    ctr: ((seed * 13) % 40) / 10 + 2, // 2–6 %
    conv: ((seed * 7) % 20) / 10 + 0.5, // 0.5–2.5 %
  }
}

export function AbTestResultsPanel({ marker, open, onClose, onNewTest }: AbTestResultsPanelProps) {
  if (marker.type !== 'AB_TEST') return null

  // Sort by plays descending (mock ranking)
  const rankedAds = [...marker.ads]
    .map((ma) => ({ ...ma, metrics: mockMetrics(ma.adId) }))
    .sort((a, b) => b.metrics.plays - a.metrics.plays)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="A/B test results"
      description={`${marker.ads.length} ads tested`}
      maxWidth="sm"
    >
      <div className="px-6 py-4 space-y-3">
        {rankedAds.map((item, idx) => (
          <div
            key={item.adId}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
          >
            {/* Rank badge */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
            }`}>
              #{idx + 1}
            </div>

            {/* Ad thumbnail */}
            <div className="w-14 h-10 rounded bg-gray-200 shrink-0 overflow-hidden">
              {item.ad.thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.ad.thumbnailPath} alt={item.ad.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.ad.name}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span>{item.metrics.plays.toLocaleString()} plays</span>
                <span>{item.metrics.ctr.toFixed(1)}% CTR</span>
                <span>{item.metrics.conv.toFixed(1)}% conv</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-5 flex justify-between">
        <Button variant="outline" size="sm" onClick={onNewTest}>
          New test
        </Button>
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  )
}
