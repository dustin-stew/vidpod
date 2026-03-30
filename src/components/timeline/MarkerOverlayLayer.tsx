'use client'

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { MarkerChip } from './MarkerChip'
import { useMarkerStore } from '@/store/markerStore'
import { usePlayerStore } from '@/store/playerStore'
import { clamp, pixelsToSeconds, secondsToPixels } from '@/lib/utils'

interface MarkerOverlayLayerProps {
  zoom: number
}

export function MarkerOverlayLayer({ zoom }: MarkerOverlayLayerProps) {
  const markers = useMarkerStore((s) => s.markers)
  const updateMarker = useMarkerStore((s) => s.updateMarker)
  const duration = usePlayerStore((s) => s.duration)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event
    const marker = markers.find((m) => m.id === active.id)
    if (!marker) return

    const deltaSeconds = pixelsToSeconds(delta.x, zoom)
    const newTimestamp = clamp(marker.timestamp + deltaSeconds, 0, duration || Infinity)

    updateMarker(marker.id, { timestamp: newTimestamp })

    fetch(`/api/markers/${marker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: newTimestamp }),
    }).catch(() => {
      updateMarker(marker.id, { timestamp: marker.timestamp })
    })
  }

  return (
    <DndContext sensors={sensors} modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
      <div className="absolute inset-0 pointer-events-none">
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="absolute top-0 bottom-0 pointer-events-auto"
            style={{ left: secondsToPixels(marker.timestamp, zoom) }}
          >
            <MarkerChip marker={marker} />
          </div>
        ))}
      </div>
    </DndContext>
  )
}
