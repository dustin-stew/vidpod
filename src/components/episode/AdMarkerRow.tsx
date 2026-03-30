'use client'

import { useState } from 'react'
import { Badge, markerTypeToBadgeVariant, markerTypeLabel } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatTimestamp } from '@/lib/utils'
import { useMarkerStore } from '@/store/markerStore'
import type { AdMarker } from '@/types'

interface AdMarkerRowProps {
  marker: AdMarker
  index: number
  onEdit: (marker: AdMarker) => void
}

export function AdMarkerRow({ marker, index, onEdit }: AdMarkerRowProps) {
  const deleteMarker = useMarkerStore((s) => s.deleteMarker)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    // Optimistic removal
    deleteMarker(marker.id)
    try {
      const res = await fetch(`/api/markers/${marker.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    } catch {
      // Revert
      useMarkerStore.getState().addMarker(marker)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      {/* Index */}
      <td className="py-2.5 pl-4 pr-2 text-xs text-gray-400 tabular-nums w-8">
        {index + 1}
      </td>
      {/* Timestamp */}
      <td className="py-2.5 px-2 text-sm font-mono text-gray-700 tabular-nums">
        {formatTimestamp(marker.timestamp)}
      </td>
      {/* Type badge */}
      <td className="py-2.5 px-2">
        <Badge variant={markerTypeToBadgeVariant(marker.type)}>
          {markerTypeLabel(marker.type)}
        </Badge>
      </td>
      {/* Ad name (for Static/AB) */}
      <td className="py-2.5 px-2 text-xs text-gray-500 max-w-[140px] truncate">
        {marker.type === 'AUTO' && '–'}
        {marker.type === 'STATIC' && marker.ads[0]?.ad.name}
        {marker.type === 'AB_TEST' && `${marker.ads.length} ads`}
      </td>
      {/* Actions */}
      <td className="py-2.5 pl-2 pr-4 w-20">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={() => onEdit(marker)} title="Edit marker">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            title="Delete marker"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </td>
    </tr>
  )
}
