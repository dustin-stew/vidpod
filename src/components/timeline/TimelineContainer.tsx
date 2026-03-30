'use client'

import { useRef, useState, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useMarkerStore } from '@/store/markerStore'
import { WaveformTrack } from './WaveformTrack'
import { MarkerOverlayLayer } from './MarkerOverlayLayer'
import { Playhead } from './Playhead'
import { ZoomControl } from './ZoomControl'
import { Button } from '@/components/ui/Button'
import { formatTimestamp } from '@/lib/utils'

interface TimelineContainerProps {
  videoSrc: string
}

const DEFAULT_ZOOM = 60 // px/sec — fits ~20min episode in typical viewport

export function TimelineContainer({ videoSrc }: TimelineContainerProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const scrollRef = useRef<HTMLDivElement>(null)

  const duration = usePlayerStore((s) => s.duration)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const canUndo = useMarkerStore((s) => s.canUndo())
  const canRedo = useMarkerStore((s) => s.canRedo())
  const undo = useMarkerStore((s) => s.undo)
  const redo = useMarkerStore((s) => s.redo)

  const contentWidth = Math.max(duration * zoom, 200)

  const handleUndo = useCallback(() => {
    undo()
  }, [undo])

  const handleRedo = useCallback(() => {
    redo()
  }, [redo])

  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-100">
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-500 tabular-nums">
            {formatTimestamp(currentTime)}
          </span>
          <ZoomControl zoom={zoom} onChange={setZoom} />
          <button className="w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: 120 }}
      >
        <div
          className="relative"
          style={{ width: contentWidth, height: 120 }}
        >
          <div className="absolute inset-0">
            <WaveformTrack
              src={videoSrc}
              zoom={zoom}
              height={120}
            />
          </div>

          <MarkerOverlayLayer zoom={zoom} />

          <Playhead zoom={zoom} containerRef={scrollRef} />
        </div>
      </div>

      <TimeRuler zoom={zoom} duration={duration} contentWidth={contentWidth} />
    </div>
  )
}

function TimeRuler({
  zoom,
  duration,
  contentWidth,
}: {
  zoom: number
  duration: number
  contentWidth: number
}) {
  if (duration === 0) return null

  // tick interval based on zoom
  const targetTickPx = 80
  const rawInterval = targetTickPx / zoom
  const niceIntervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  const tickInterval = niceIntervals.find((i) => i >= rawInterval) ?? 600

  const ticks: number[] = []
  for (let t = 0; t <= duration; t += tickInterval) {
    ticks.push(t)
  }

  return (
    <div className="relative overflow-hidden border-t border-gray-100" style={{ height: 20 }}>
      <div className="absolute inset-0" style={{ width: contentWidth }}>
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: t * zoom }}
          >
            <div className="w-px h-2 bg-gray-300" />
            <span className="text-[9px] text-gray-400 font-mono mt-0.5 whitespace-nowrap">
              {formatTimestamp(t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
