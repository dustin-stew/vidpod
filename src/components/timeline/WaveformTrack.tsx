'use client'

import { useEffect, useRef, useState } from 'react'

interface WaveformTrackProps {
  src: string
  zoom: number
  height?: number
}

export function WaveformTrack({ src, zoom, height }: WaveformTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<ReturnType<typeof import('wavesurfer.js')['default']['create']> | null>(null)
  const [measuredHeight, setMeasuredHeight] = useState(height ?? 120)

  useEffect(() => {
    if (height) return // explicit height provided
    const el = containerRef.current?.parentElement
    if (el) {
      const h = el.offsetHeight
      if (h > 0) setMeasuredHeight(h)
    }
  }, [height])

  const resolvedHeight = height ?? measuredHeight

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (cancelled) return

      if (wsRef.current) {
        wsRef.current.destroy()
        wsRef.current = null
      }

      const ws = WaveSurfer.create({
        container,
        height: resolvedHeight,
        waveColor: 'rgba(139, 92, 246, 0.5)',
        progressColor: 'rgba(139, 92, 246, 0.7)',
        cursorColor: 'transparent',
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        minPxPerSec: zoom,
        hideScrollbar: true,
        interact: false,
        normalize: true,
      })
      ws.load(src)
      wsRef.current = ws
    })

    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.destroy()
        wsRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, resolvedHeight])

  useEffect(() => {
    wsRef.current?.zoom(zoom)
  }, [zoom])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  )
}
