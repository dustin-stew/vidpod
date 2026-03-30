'use client'

import { useEffect, useRef, useCallback, forwardRef } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { cn } from '@/lib/utils'
import { formatTimestamp } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  episodeId: string
  className?: string
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, episodeId, className }, videoRef) => {
    const { currentTime, duration, isPlaying, volume, isMuted, setCurrentTime, setDuration, setPlaying, setVolume, toggleMute } =
      usePlayerStore()

    const isSeeking = useRef(false)

    useEffect(() => {
      const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
      if (!video) return
      if (isPlaying) {
        video.play().catch(() => setPlaying(false))
      } else {
        video.pause()
      }
    }, [isPlaying, setPlaying, videoRef])

    useEffect(() => {
      const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
      if (!video) return
      video.volume = volume
      video.muted = isMuted
    }, [volume, isMuted, videoRef])

    const handleTimeUpdate = useCallback(() => {
      const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
      if (!video || isSeeking.current) return
      setCurrentTime(video.currentTime)
    }, [setCurrentTime, videoRef])

    const handleLoadedMetadata = useCallback(() => {
      const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
      if (!video) return
      setDuration(video.duration)
      fetch(`/api/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: video.duration }),
      }).catch(() => {/* non-critical */})
    }, [setDuration, episodeId, videoRef])

    const handleEnded = useCallback(() => {
      setPlaying(false)
    }, [setPlaying])

    const handleProgressClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
        if (!video || duration === 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        const ratio = (e.clientX - rect.left) / rect.width
        const newTime = ratio * duration
        video.currentTime = newTime
        setCurrentTime(newTime)
      },
      [duration, setCurrentTime, videoRef]
    )

    const skipBy = useCallback(
      (seconds: number) => {
        const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
        if (!video) return
        const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
        video.currentTime = newTime
        setCurrentTime(newTime)
      },
      [duration, setCurrentTime, videoRef]
    )

    const jumpTo = useCallback(
      (position: 'start' | 'end') => {
        const video = (videoRef as React.RefObject<HTMLVideoElement>)?.current
        if (!video) return
        const newTime = position === 'start' ? 0 : duration
        video.currentTime = newTime
        setCurrentTime(newTime)
      },
      [duration, setCurrentTime, videoRef]
    )

    const progress = duration > 0 ? currentTime / duration : 0

    return (
      <div className={cn('flex flex-col bg-white rounded-xl overflow-hidden', className)}>
        <div className="relative aspect-video bg-gray-900">
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            playsInline
            preload="metadata"
          />
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <div
            className="relative h-1.5 bg-gray-200 rounded-full cursor-pointer mb-3 group"
            onClick={handleProgressClick}
          >
            <div
              className="absolute inset-y-0 left-0 bg-gray-900 rounded-full transition-none"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-900 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <ControlButton onClick={() => jumpTo('start')} title="Jump to start">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </ControlButton>

              <ControlButton onClick={() => skipBy(-10)} title="Back 10 seconds">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </ControlButton>

              <button
                onClick={() => setPlaying(!isPlaying)}
                className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors mx-1"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <ControlButton onClick={() => skipBy(10)} title="Forward 10 seconds">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </ControlButton>

              <ControlButton onClick={() => jumpTo('end')} title="Jump to end">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zm2.5-6l5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z" />
                </svg>
              </ControlButton>
            </div>

            <span className="text-xs font-mono text-gray-500 tabular-nums">
              {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
            </span>

            <div className="flex items-center gap-2">
              <ControlButton onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted || volume === 0 ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12A4.5 4.5 0 0014 7.97v1.71l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                )}
              </ControlButton>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setVolume(v)
                  if (v > 0 && isMuted) toggleMute()
                }}
                className="w-20 h-1 accent-gray-900 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
)

VideoPlayer.displayName = 'VideoPlayer'

function ControlButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  )
}
