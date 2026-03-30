'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMarkerStore } from '@/store/markerStore'
import { EpisodeHeader } from './EpisodeHeader'
import { VideoPlayer } from './VideoPlayer'
import { AdMarkersPanel } from './AdMarkersPanel'
import { TimelineContainer } from '@/components/timeline/TimelineContainer'
import { CreateMarkerModal } from '@/components/modals/CreateMarkerModal'
import { AbTestResultsPanel } from '@/components/modals/AbTestResultsPanel'
import type { EpisodeWithMarkers, AdMarker } from '@/types'

interface EpisodePageProps {
  episode: EpisodeWithMarkers
}

export function EpisodePage({ episode }: EpisodePageProps) {
  const initialize = useMarkerStore((s) => s.initialize)

  useEffect(() => {
    initialize(episode.markers)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.id])

  const undo = useMarkerStore((s) => s.undo)
  const redo = useMarkerStore((s) => s.redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const videoRef = useRef<HTMLVideoElement>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingMarker, setEditingMarker] = useState<AdMarker | null>(null)
  const [abResultsMarker, setAbResultsMarker] = useState<AdMarker | null>(null)

  const handleCreateMarker = useCallback(() => {
    setEditingMarker(null)
    setCreateModalOpen(true)
  }, [])

  const handleEditMarker = useCallback((marker: AdMarker) => {
    if (marker.type === 'AB_TEST') {
      setAbResultsMarker(marker)
    } else {
      setEditingMarker(marker)
      setCreateModalOpen(true)
    }
  }, [])

  const handleModalClose = useCallback(() => {
    setCreateModalOpen(false)
    setEditingMarker(null)
  }, [])

  return (
    <div className="flex-1 overflow-auto bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <EpisodeHeader episode={episode} />

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 mb-4">
          <AdMarkersPanel
            episodeId={episode.id}
            onCreateMarker={handleCreateMarker}
            onEditMarker={handleEditMarker}
          />

          <VideoPlayer
            ref={videoRef}
            src={episode.videoPath}
            episodeId={episode.id}
          />
        </div>

        <TimelineContainer
          videoSrc={episode.videoPath}
        />
      </div>

      <CreateMarkerModal
        open={createModalOpen}
        onClose={handleModalClose}
        episodeId={episode.id}
        editingMarker={editingMarker}
      />

      {abResultsMarker && (
        <AbTestResultsPanel
          marker={abResultsMarker}
          open={!!abResultsMarker}
          onClose={() => setAbResultsMarker(null)}
          onNewTest={() => {
            setAbResultsMarker(null)
            setEditingMarker(abResultsMarker)
            setCreateModalOpen(true)
          }}
        />
      )}
    </div>
  )
}
