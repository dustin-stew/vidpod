'use client'

import { useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { secondsToPixels, pixelsToSeconds, clamp } from '@/lib/utils'

interface PlayheadProps {
  zoom: number
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function Playhead({ zoom, containerRef }: PlayheadProps) {
  const { currentTime, duration, setCurrentTime } = usePlayerStore()

  const left = secondsToPixels(currentTime, zoom)

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container || duration === 0) return
      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const clickX = e.clientX - rect.left + scrollLeft
      const newTime = clamp(pixelsToSeconds(clickX, zoom), 0, duration)
      setCurrentTime(newTime)
    },
    [containerRef, duration, zoom, setCurrentTime]
  )

  return (
    <>
      {/* seek overlay */}
      <div
        className="absolute inset-0 cursor-crosshair z-0"
        onClick={handleSeek}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
        style={{ left }}
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '6px solid rgb(239 68 68)',
          }}
        />
      </div>
    </>
  )
}
