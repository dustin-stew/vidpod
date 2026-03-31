'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMarkerStore } from '@/store/markerStore'
import { usePlayerStore } from '@/store/playerStore'
import { WaveformTrack } from '@/components/timeline/WaveformTrack'
import { ZoomControl } from '@/components/timeline/ZoomControl'
import { AssetPanel } from './AssetPanel'
import { TutorialOverlay } from './TutorialOverlay'
import { packClips, findPackedAtTime } from '@/lib/clipUtils'
import { findQuietSpots } from '@/lib/audioAnalyzer'
import { formatTimestamp, secondsToPixels, pixelsToSeconds, clamp } from '@/lib/utils'
import type { Asset, AssetPanelTab, EpisodeClip, EpisodeWithMarkers, AdSet, AbTestGroup } from '@/types'

const DEFAULT_ZOOM = 60        // px/sec
const CLIP_TRACK_H = 100       // px — clips row above waveform
const WAVE_TRACK_H = 100       // px — fixed height for waveform
const RULER_H = 24             // px
const PLAYHEAD_HIT_W = 16      // px — draggable hit area width


interface Props {
  episode: EpisodeWithMarkers
  initialClips: EpisodeClip[]
  contentAssets: Asset[]
  adAssets: Asset[]
  initialAdSets: AdSet[]
  initialAbTestGroups: AbTestGroup[]
}


export function EpisodeDesigner({ episode, initialClips, contentAssets, adAssets, initialAdSets, initialAbTestGroups }: Props) {
  const router = useRouter()

  // marker store
  const initialize = useMarkerStore((s) => s.initialize)
  const undo = useMarkerStore((s) => s.undo)
  const redo = useMarkerStore((s) => s.redo)
  useEffect(() => { initialize(episode.markers) }, [episode.id]) // eslint-disable-line
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) { e.preventDefault(); redo() }
      // Spacebar play/pause — ignore if typing in an input
      if (e.key === ' ' && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        const v = videoRef.current
        if (!v) return
        if (isPlayingRef.current) { v.pause(); usePlayerStore.getState().setPlaying(false); isPlayingRef.current = false }
        else { v.play().catch(() => {}); usePlayerStore.getState().setPlaying(true); isPlayingRef.current = true }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [undo, redo])

  // player store
  const { currentTime, duration, isPlaying, setCurrentTime, setPlaying } = usePlayerStore()
  const videoRef = useRef<HTMLVideoElement>(null)

  // multi-clip playback refs
  const [currentClipSrc, setCurrentClipSrc] = useState<string>(() =>
    initialClips.find(c => c.clipType === 'content')?.asset?.filePath ?? episode.videoPath ?? ''
  )
  const activeClipIdRef = useRef<string | null>(
    initialClips.find(c => c.clipType === 'content')?.id ?? null
  )
  const currentClipSrcRef = useRef(currentClipSrc)
  const pendingSeekRef = useRef<number | null>(null)  // local-clip seek to apply after src load
  const isPlayingRef = useRef(false)
  const transitioningRef = useRef(false)             // true while switching clips; gates advanceToNextClip
  const packedRef = useRef<ReturnType<typeof packClips>>([])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // set video src imperatively to avoid react re-loads
  useEffect(() => {
    const v = videoRef.current
    if (!v || !currentClipSrc) return
    // compare raw attr, not resolved url
    if (v.getAttribute('src') !== currentClipSrc) {
      v.setAttribute('src', currentClipSrc)
      v.load()
    }
  }, [currentClipSrc])

  const [title, setTitle] = useState(episode.title)
  const [editingTitle, setEditingTitle] = useState(episode.title === 'Untitled episode')
  async function saveTitle(v: string) {
    const t = v.trim() || 'Untitled episode'
    setTitle(t); setEditingTitle(false)
    await fetch(`/api/episodes/${episode.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t }),
    })
  }

  const [clips, setClips] = useState<EpisodeClip[]>(initialClips)
  const clipsRef = useRef<EpisodeClip[]>(initialClips)
  function updateClips(next: EpisodeClip[]) { clipsRef.current = next; setClips(next) }

  // asset durations from metadata
  const [assetDurations, setAssetDurations] = useState<Record<string, number>>(() => {
    const d: Record<string, number> = {}
    for (const a of [...contentAssets, ...adAssets]) {
      if (a.duration > 0) d[a.id] = a.duration
    }
    return d
  })

  const onAssetDuration = useCallback((assetId: string, dur: number) => {
    setAssetDurations((prev) => {
      if (prev[assetId] === dur) return prev
      // persist to db
      fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: dur }),
      }).catch(() => {})
      return { ...prev, [assetId]: dur }
    })
  }, [])

  const [assetTab, setAssetTab] = useState<AssetPanelTab>('content')
  const allAssets = [...contentAssets, ...adAssets]

  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set())
  const [autoInserting, setAutoInserting] = useState(false)

  // ab test clip state
  const [abTestClips, setAbTestClips] = useState<Record<string, { groupName: string; variants: Asset[]; activeAssetId: string; abTestGroupId?: string; abTestGroupName?: string }>>(() => {
    const allAssets = [...contentAssets, ...adAssets]
    const restored: Record<string, { groupName: string; variants: Asset[]; activeAssetId: string; abTestGroupId?: string; abTestGroupName?: string }> = {}
    for (const clip of initialClips) {
      if (clip.abTestGroupId && clip.abTestVariantIds) {
        try {
          const variantIds = JSON.parse(clip.abTestVariantIds) as string[]
          const variants = variantIds.map(id => allAssets.find(a => a.id === id)).filter(Boolean) as Asset[]
          if (variants.length > 0) {
            restored[clip.id] = {
              groupName: clip.abTestGroupName ?? 'AB Test',
              variants,
              activeAssetId: clip.assetId,
              abTestGroupId: clip.abTestGroupId,
              abTestGroupName: clip.abTestGroupName ?? undefined,
            }
          }
        } catch { /* invalid JSON */ }
      }
    }
    return restored
  })

  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')

  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  const draggingAssetRef = useRef<Asset | null>(null)
  const draggingClipRef = useRef<string | null>(null) // clipId

  const [insertIdx, setInsertIdx] = useState<number | null>(null)
  const [dragTime, setDragTime] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  const packed = packClips(clips, assetDurations)
  packedRef.current = packed  // always current, safe to read in event handlers
  const totalDuration = packed.length ? packed[packed.length - 1].start + packed[packed.length - 1].dur : 0
  const timelineW = Math.max(totalDuration * zoom, duration * zoom, 800)

  // seek to virtual time
  const seekToTime = useCallback((t: number) => {
    transitioningRef.current = false  // manual seek cancels any in-flight transition
    const p = packedRef.current
    const total = p.length ? p[p.length - 1].start + p[p.length - 1].dur : 0
    t = clamp(t, 0, total || duration)
    setCurrentTime(t)

    const item = findPackedAtTime(t, p)
    if (!item) return
    const localTime = t - item.start + (item.clip.startOffset ?? 0)
    const newSrc = item.clip.asset?.filePath ?? ''
    if (!newSrc) return

    activeClipIdRef.current = item.clip.id
    if (currentClipSrcRef.current !== newSrc) {
      currentClipSrcRef.current = newSrc
      pendingSeekRef.current = localTime
      setCurrentClipSrc(newSrc)
    } else {
      const v = videoRef.current
      if (v && Math.abs(v.currentTime - localTime) > 0.05) v.currentTime = localTime
    }
  }, [duration, setCurrentTime]) // eslint-disable-line

  // advance to next clip
  const advanceToNextClip = useCallback(() => {
    if (transitioningRef.current) return
    transitioningRef.current = true

    const p = packedRef.current
    const idx = p.findIndex(i => i.clip.id === activeClipIdRef.current)
    if (idx < 0) { transitioningRef.current = false; return }

    if (idx === p.length - 1) {
      setCurrentTime(p[idx].start + p[idx].dur)
      videoRef.current?.pause()
      setPlaying(false)
      isPlayingRef.current = false
      transitioningRef.current = false
      return
    }

    const next = p[idx + 1]
    const nextSrc = next.clip.asset?.filePath ?? ''
    if (!nextSrc) { setPlaying(false); transitioningRef.current = false; return }

    isPlayingRef.current = true
    activeClipIdRef.current = next.clip.id
    pendingSeekRef.current = next.clip.startOffset ?? 0
    setCurrentTime(next.start)

    // same file: seek directly
    if (currentClipSrcRef.current === nextSrc) {
      const v = videoRef.current
      if (v) {
        v.currentTime = pendingSeekRef.current ?? 0
        pendingSeekRef.current = null
        v.play().catch(() => { setPlaying(false); isPlayingRef.current = false })
        transitioningRef.current = false
      }
      return
    }

    currentClipSrcRef.current = nextSrc
    setCurrentClipSrc(nextSrc)
  }, [setCurrentTime, setPlaying, setCurrentClipSrc]) // eslint-disable-line

  // insertion index from x position
  function xToInsertIndex(clientX: number): number {
    const rect = scrollRef.current?.getBoundingClientRect()
    if (!rect) return clips.length
    const x = clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
    const t = x / zoom
    if (packed.length === 0) return 0
    let best = clips.length
    let bestDist = Infinity
    packed.forEach(({ start, dur }, i) => {
      const effectiveDur = dur > 0 ? dur : 48 / zoom
      const mid = start + effectiveDur / 2
      if (t <= mid) {
        const d = Math.abs(t - start)
        if (d < bestDist) { bestDist = d; best = i }
      } else {
        const d = Math.abs(t - (start + effectiveDur))
        if (d < bestDist) { bestDist = d; best = i + 1 }
      }
    })
    return best
  }

  function onPanelDragStart(e: React.DragEvent, asset: Asset) {
    draggingAssetRef.current = asset
    draggingClipRef.current = null
    e.dataTransfer.setData('text/plain', 'panel')
    e.dataTransfer.effectAllowed = 'copy'
  }
  function onPanelDragEnd() { draggingAssetRef.current = null; setInsertIdx(null); setDragTime(null) }

  function onClipDragStart(e: React.DragEvent, clipId: string) {
    draggingClipRef.current = clipId
    draggingAssetRef.current = null
    e.dataTransfer.setData('text/plain', 'clip')
    e.dataTransfer.effectAllowed = 'move'
  }
  function onClipDragEnd() { draggingClipRef.current = null; setInsertIdx(null); setDragTime(null) }

  const onTrackDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = draggingClipRef.current ? 'move' : 'copy'
    const idx = xToInsertIndex(e.clientX)
    setInsertIdx(idx)
    const rect = scrollRef.current?.getBoundingClientRect()
    if (rect) {
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
      setDragTime(x / zoom)
    }
  }, [zoom, packed]) // eslint-disable-line

  const onTrackDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setInsertIdx(null)
      setDragTime(null)
    }
  }, [])

  const onTrackDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setInsertIdx(null)
    setDragTime(null)

    if (draggingAssetRef.current) {
      const asset = draggingAssetRef.current
      draggingAssetRef.current = null

      const rect = scrollRef.current?.getBoundingClientRect()
      const x = rect ? e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0) : 0
      const dropTime = x / zoom

      // split content clip for ad drop
      if (asset.contentType === 'ad') {
        const p = packedRef.current
        const target = p.find(({ start, dur, clip }) =>
          clip.clipType === 'content' && dropTime > start + 0.3 && dropTime < start + dur - 0.3
        )
        if (target) {
          const splitOffset = dropTime - target.start + (target.clip.startOffset ?? 0)
          const res = await fetch(`/api/clips/${target.clip.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset, adAssetId: asset.id }),
          })
          if (res.ok) {
            const { clip1, adClip, clip2 } = await res.json()
            const current = clipsRef.current
            const fromIdx = current.findIndex(c => c.id === target.clip.id)
            const next = [...current]
            next.splice(fromIdx, 1, clip1, adClip, clip2)
            updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))
          }
          return
        }
      }

      const idx = xToInsertIndex(e.clientX)
      const res = await fetch('/api/clips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: episode.id, assetId: asset.id, clipType: asset.contentType, orderIndex: idx }),
      })
      if (res.ok) {
        const newClip: EpisodeClip = await res.json()
        const next = [...clipsRef.current]
        next.splice(idx, 0, newClip)
        updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))
        // set first clip active
        if (!currentClipSrcRef.current && newClip.asset?.filePath) {
          const src = newClip.asset.filePath
          currentClipSrcRef.current = src
          activeClipIdRef.current = newClip.id
          setCurrentClipSrc(src)
        }
      }
    } else if (draggingClipRef.current) {
      const clipId = draggingClipRef.current
      draggingClipRef.current = null
      const idx = xToInsertIndex(e.clientX)
      const current = clipsRef.current
      const fromIdx = current.findIndex((c) => c.id === clipId)
      if (fromIdx < 0 || fromIdx === idx || fromIdx + 1 === idx) return
      const next = [...current]
      const [moved] = next.splice(fromIdx, 1)
      const insertAt = idx > fromIdx ? idx - 1 : idx
      next.splice(insertAt, 0, moved)
      updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))
      await fetch(`/api/clips/${clipId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: episode.id, orderedIds: next.map((c) => c.id) }),
      })
    }
  }, [episode.id, zoom, packed]) // eslint-disable-line

  async function removeClip(id: string) {
    await fetch(`/api/clips/${id}`, { method: 'DELETE' })
    const remaining = clipsRef.current.filter((c) => c.id !== id).map((c, i) => ({ ...c, orderIndex: i }))
    updateClips(remaining)
    // clear waveform if empty
    if (remaining.length === 0) {
      setCurrentClipSrc('')
      currentClipSrcRef.current = ''
      activeClipIdRef.current = null
    }
  }

  // auto-insert at quietest spots
  const doAutoInsert = useCallback(async (newAdAssetIds: string[], mode: 'spread' | 'single' = 'spread', adSetDisplayName?: string, abTestGroupInfo?: { id: string; name: string }) => {
    if (newAdAssetIds.length === 0) return
    const currentClips = [...clipsRef.current]
    const currentPacked = packClips(currentClips, assetDurations)
    if (currentPacked.length === 0) return

    const existingAdCount = currentPacked.filter(i => i.clip.clipType === 'ad').length

    setAutoInserting(true)
    try {
      const existingAdAssetIds = currentPacked
        .filter(i => i.clip.clipType === 'ad')
        .map(i => i.clip.assetId)

      // remove existing ads first
      let workingClips = [...currentClips]
      if (existingAdCount > 0) {
        const adClipIds = workingClips.filter(c => c.clipType === 'ad').map(c => c.id)
        for (const id of adClipIds) {
          await fetch(`/api/clips/${id}`, { method: 'DELETE' })
        }
        workingClips = workingClips.filter(c => c.clipType !== 'ad').map((c, i) => ({ ...c, orderIndex: i }))
      }

      // analyze audio and find quietest spots
      const insertions = await findQuietSpots({
        clips: workingClips,
        assetDurations,
        newAdAssetIds,
        existingAdAssetIds,
        mode,
      })
      if (insertions.length === 0) return

      // perform splits at insertion points
      for (const { time: dropTime, assetId: insertAssetId } of insertions) {
        const wp = packClips(workingClips, assetDurations)
        const target = wp.find(({ start, dur, clip }) =>
          clip.clipType === 'content' && dropTime > start + 0.1 && dropTime < start + dur - 0.1
        )
        if (target) {
          const splitOffset = dropTime - target.start + (target.clip.startOffset ?? 0)
          const res = await fetch(`/api/clips/${target.clip.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset, adAssetId: insertAssetId }),
          })
          if (res.ok) {
            const { clip1, adClip, clip2 } = await res.json()
            const fromIdx = workingClips.findIndex(c => c.id === target.clip.id)
            workingClips.splice(fromIdx, 1, clip1, adClip, clip2)
            workingClips = workingClips.map((c, i) => ({ ...c, orderIndex: i }))
          }
        }
      }
      updateClips(workingClips)

      // mark clip with ab test variants
      if (mode === 'single' && insertions.length > 0) {
        const insertedAdClip = workingClips.find(c => c.clipType === 'ad' && c.assetId === newAdAssetIds[0])
        if (insertedAdClip) {
          const variants = newAdAssetIds.map(id => allAssets.find(a => a.id === id)).filter(Boolean) as Asset[]
          const displayName = abTestGroupInfo?.name ?? adSetDisplayName ?? 'AB Test'
          setAbTestClips(prev => ({
            ...prev,
            [insertedAdClip.id]: {
              groupName: adSetDisplayName ?? 'AB Test',
              variants,
              activeAssetId: newAdAssetIds[0],
              ...(abTestGroupInfo ? { abTestGroupId: abTestGroupInfo.id, abTestGroupName: abTestGroupInfo.name } : {}),
            }
          }))
          // persist to db
          await fetch(`/api/clips/${insertedAdClip.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'setAbTest',
              abTestGroupId: abTestGroupInfo?.id ?? insertedAdClip.id,
              abTestVariantIds: JSON.stringify(newAdAssetIds),
              abTestGroupName: displayName,
            }),
          })
        }
      }
    } finally {
      setAutoInserting(false)
    }
  }, [assetDurations, episode.id, allAssets]) // eslint-disable-line

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-clip]')) return
    if ((e.target as HTMLElement).closest('[data-playhead]')) return
    const rect = scrollRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
    seekToTime(pixelsToSeconds(x, zoom))
  }, [zoom, seekToTime])

  const scrubbing = useRef(false)
  const handlePlayheadDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    scrubbing.current = true
    const onMove = (ev: MouseEvent) => {
      if (!scrubbing.current) return
      const rect = scrollRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = ev.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
      seekToTime(pixelsToSeconds(Math.max(0, x), zoom))
    }
    const onUp = () => {
      scrubbing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, seekToTime])

  const playheadLeft = secondsToPixels(currentTime, zoom)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* header */}
      <header className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center px-5 gap-4">
        <button onClick={() => router.push('/episodes')} className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {editingTitle ? (
          <input autoFocus
            className="text-sm font-semibold text-gray-900 bg-transparent border-b border-gray-900 outline-none px-0.5 w-64"
            defaultValue={title}
            onBlur={(e) => saveTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingTitle(false) }}
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
            {title}
          </button>
        )}
        <TutorialOverlay />
        <div className="flex-1" />
        <button
          onClick={async () => {
            // publish and register ab test pairings
            await fetch(`/api/episodes/${episode.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publishedAt: new Date().toISOString() }),
            })
            const currentPacked = packClips(clipsRef.current, assetDurations)
            for (const [clipId, abTest] of Object.entries(abTestClips)) {
              const packedItem = currentPacked.find(p => p.clip.id === clipId)
              const clipTimestamp = packedItem?.start ?? 0
              const setName = abTest.abTestGroupName ?? abTest.groupName
              const setId = abTest.abTestGroupId ?? clipId // fallback to clipId if no set
              await fetch('/api/published-ab-tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  episodeId: episode.id,
                  abTestGroupId: setId,
                  abTestGroupName: `${setName} @ ${formatTimestamp(clipTimestamp)}`,
                  episodeTitle: title,
                  clipTimestamp,
                  variantNames: abTest.variants.map(v => v.name),
                }),
              })
            }
            router.push('/episodes')
          }}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
        >
          Publish
        </button>
      </header>

      {/* body */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* asset panel + preview */}
        <div className="flex border-b border-gray-200" style={{ height: '45%' }}>

          <AssetPanel
            contentAssets={contentAssets}
            adAssets={adAssets}
            initialAdSets={initialAdSets}
            initialAbTestGroups={initialAbTestGroups}
            clips={clips}
            selectedAdIds={selectedAdIds}
            setSelectedAdIds={setSelectedAdIds}
            autoInserting={autoInserting}
            onAutoInsert={(ids) => doAutoInsert(ids)}
            onAutoInsertGroup={(assetIds, mode, displayName, groupInfo) => doAutoInsert(assetIds, mode, displayName, groupInfo)}
            onAssetDuration={onAssetDuration}
            onPanelDragStart={onPanelDragStart}
            onPanelDragEnd={onPanelDragEnd}
            assetTab={assetTab}
            setAssetTab={setAssetTab}
          />

          {/* Right: video preview */}
          <div className="flex-1 bg-gray-950 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
              {currentClipSrc ? (
                <video
                  ref={videoRef}
                  className={aspectRatio === '9:16' ? 'h-full object-cover' : 'w-full h-full object-contain'}
                  style={aspectRatio === '9:16' ? { aspectRatio: '9/16' } : undefined}
                  playsInline
                  preload="metadata"
                  onTimeUpdate={() => {
                    const v = videoRef.current
                    if (!v) return
                    const p = packedRef.current
                    const item = p.find(i => i.clip.id === activeClipIdRef.current)
                    if (!item) return
                    // advance at split endpoint
                    if (item.clip.endOffset >= 0 && v.currentTime >= item.clip.endOffset - 0.05) {
                      advanceToNextClip()
                      return
                    }
                    setCurrentTime(item.start + (v.currentTime - (item.clip.startOffset ?? 0)))
                  }}
                  onLoadedMetadata={() => {
                    const v = videoRef.current
                    if (!v) return
                    usePlayerStore.getState().setDuration(v.duration)
                    if (pendingSeekRef.current !== null) {
                      v.currentTime = pendingSeekRef.current
                      pendingSeekRef.current = null
                      if (isPlayingRef.current) {
                        v.play().catch(() => { setPlaying(false); isPlayingRef.current = false })
                      }
                    }
                    transitioningRef.current = false  // new clip loaded — ready for the next transition
                  }}
                  onEnded={advanceToNextClip}
                  onError={(e) => {
                    const v = e.currentTarget
                    console.error('[video error]', v.error?.code, v.error?.message, v.src)
                    transitioningRef.current = false
                    setPlaying(false)
                    isPlayingRef.current = false
                  }}
                />
              ) : (
                <div className="text-gray-600 text-xs text-center">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Drag a content clip to the timeline
                </div>
              )}
              {/* ad badge */}
              {currentClipSrc && packed.find(i => i.clip.id === activeClipIdRef.current)?.clip.clipType === 'ad' && (
                <div className="absolute top-3 left-3 z-10 pointer-events-none">
                  <span className="px-2 py-1 rounded bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                    Ad
                  </span>
                </div>
              )}
              {/* play/pause */}
              {currentClipSrc && (
                <button
                  onClick={() => {
                    const v = videoRef.current
                    if (!v) return
                    if (isPlaying) { v.pause(); setPlaying(false) }
                    else { v.play().catch(() => {}); setPlaying(true) }
                  }}
                  className="absolute inset-0 flex items-center justify-center group"
                >
                  <div className={`w-12 h-12 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                    {isPlaying ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                      <svg className="w-5 h-5 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </div>
                </button>
              )}
            </div>
            {/* time + aspect ratio */}
            <div className="h-8 shrink-0 flex items-center bg-gray-900 border-t border-gray-800 px-2">
              <div className="flex items-center gap-0.5 bg-gray-800 rounded p-0.5">
                <button
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    aspectRatio === '16:9' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Landscape (16:9)"
                >
                  <svg className="w-3.5 h-2.5" viewBox="0 0 20 14" fill="none"><rect x="0.5" y="0.5" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" /></svg>
                  16:9
                </button>
                <button
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    aspectRatio === '9:16' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Portrait (9:16)"
                >
                  <svg className="w-2.5 h-3.5" viewBox="0 0 14 20" fill="none"><rect x="0.5" y="0.5" width="13" height="19" rx="2" stroke="currentColor" strokeWidth="1.2" /></svg>
                  9:16
                </button>
              </div>
              <div className="flex-1" />
              <span className="text-xs font-mono text-gray-400 tabular-nums">
                {formatTimestamp(currentTime)} / {formatTimestamp(totalDuration || duration)}
              </span>
            </div>
          </div>
        </div>

        {/* timeline */}
        <div className="flex flex-col min-h-0 bg-white" style={{ height: '55%' }}>

          {/* toolbar */}
          <div className="h-10 shrink-0 flex items-center gap-3 px-4 border-b border-gray-100">
            {/* play/pause */}
            <button
              onClick={() => {
                const v = videoRef.current; if (!v) return
                if (isPlaying) { v.pause(); setPlaying(false) }
                else { v.play().catch(() => {}); setPlaying(true) }
              }}
              className="w-7 h-7 rounded-md bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors"
            >
              {isPlaying
                ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg className="w-3.5 h-3.5 translate-x-px" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
            <span className="text-xs font-mono text-gray-500 tabular-nums">
              {formatTimestamp(currentTime)}
            </span>
            <div className="flex-1" />
            {/* undo/redo */}
            <button onClick={() => undo()} title="Undo (⌘Z)" className="w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
            </button>
            <button onClick={() => redo()} title="Redo (⌘⇧Z)" className="w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/>
              </svg>
            </button>
            <ZoomControl zoom={zoom} onChange={setZoom} />
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">

            <div className="w-16 shrink-0 flex flex-col border-r border-gray-100 select-none">
              <div style={{ height: CLIP_TRACK_H }} className="shrink-0 flex items-center justify-end pr-2 text-[10px] text-gray-400 font-medium">
                clips
              </div>
              <div style={{ height: WAVE_TRACK_H }} className="shrink-0 flex items-center justify-end pr-2 text-[10px] text-gray-400 font-medium border-t border-gray-200">
                audio
              </div>
              <div style={{ height: RULER_H }} className="shrink-0" />
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-x-auto overflow-y-hidden relative"
            >
              <div className="relative flex flex-col overflow-visible" style={{ width: timelineW }}>

                {/* clip track */}
                <div
                  className="relative shrink-0 cursor-crosshair overflow-hidden z-[3]"
                  style={{ height: CLIP_TRACK_H }}
                  onClick={handleTrackClick}
                  onDragOver={onTrackDragOver}
                  onDragLeave={onTrackDragLeave}
                  onDrop={onTrackDrop}
                >
                  <div className="absolute inset-0 bg-gray-50 border-b border-gray-200" />

                  {packed.map(({ clip, start, dur }, i) => {
                    const x = secondsToPixels(start, zoom)
                    const w = Math.max(secondsToPixels(dur, zoom), 48)
                    const isAd = clip.clipType === 'ad'
                    const abTest = abTestClips[clip.id]

                    // ab test: stacked variant bars
                    if (isAd && abTest) {
                      const variantColors = ['bg-purple-200 border-purple-400', 'bg-pink-200 border-pink-400', 'bg-indigo-200 border-indigo-400', 'bg-fuchsia-200 border-fuchsia-400']
                      return (
                        <div
                          key={clip.id}
                          data-clip="true"
                          className="absolute top-1 bottom-1 rounded-md border border-purple-400 bg-purple-50 flex flex-col overflow-hidden z-[2] group select-none"
                          style={{ left: x, width: w }}
                        >
                          {/* header */}
                          <div className="flex items-center gap-1 px-1.5 py-0.5 min-w-0 shrink-0">
                            <span className="text-[7px] font-bold text-purple-700 bg-purple-300 px-1 rounded uppercase shrink-0">AB</span>
                            <span className="text-[9px] font-medium text-purple-800 truncate">{abTest.abTestGroupName ?? abTest.groupName} @ {formatTimestamp(start)}</span>
                          </div>
                          {/* variant bars */}
                          <div className="flex-1 flex flex-col gap-px px-0.5 pb-0.5 min-h-0">
                            {abTest.variants.map((variant, vi) => {
                              const isActive = variant.id === abTest.activeAssetId
                              const colorClass = variantColors[vi % variantColors.length]
                              return (
                                <button
                                  key={variant.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAbTestClips(prev => ({
                                      ...prev,
                                      [clip.id]: { ...prev[clip.id], activeAssetId: variant.id }
                                    }))
                                    updateClips(clipsRef.current.map(c =>
                                      c.id === clip.id ? { ...c, assetId: variant.id, asset: variant } : c
                                    ))
                                    // switch active video src
                                    if (activeClipIdRef.current === clip.id) {
                                      currentClipSrcRef.current = variant.filePath
                                      setCurrentClipSrc(variant.filePath)
                                    }
                                  }}
                                  className={`flex-1 min-h-[14px] rounded-sm border text-[8px] px-1 truncate text-left transition-all ${colorClass} ${
                                    isActive ? 'ring-2 ring-purple-500 ring-inset font-bold' : 'opacity-60 hover:opacity-90'
                                  }`}
                                >
                                  {isActive && <span className="mr-0.5">▶</span>}
                                  {variant.name}
                                </button>
                              )
                            })}
                          </div>
                          {/* remove */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeClip(clip.id); setAbTestClips(prev => { const n = { ...prev }; delete n[clip.id]; return n }) }}
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-800/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                          {insertIdx === i && (
                            <div className="absolute -left-0.5 inset-y-0 w-0.5 bg-blue-500 z-10 pointer-events-none" />
                          )}
                        </div>
                      )
                    }

                    // normal clip
                    return (
                      <div
                        key={clip.id}
                        data-clip="true"
                        draggable
                        onDragStart={(e) => onClipDragStart(e, clip.id)}
                        onDragEnd={onClipDragEnd}
                        className={`absolute top-1 bottom-1 rounded-md border flex flex-col justify-between px-2 py-0.5 cursor-grab active:cursor-grabbing select-none overflow-hidden group z-[2] ${
                          isAd
                            ? 'bg-orange-100 border-orange-300 hover:bg-orange-200'
                            : 'bg-blue-100 border-blue-300 hover:bg-blue-200'
                        }`}
                        style={{ left: x, width: w }}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {isAd && <span className="text-[8px] font-bold text-orange-700 bg-orange-300 px-1 rounded uppercase shrink-0">AD</span>}
                          <span className="text-[10px] font-medium text-gray-700 truncate">{clip.asset?.name}</span>
                        </div>
                        {dur > 0 && <span className="text-[9px] text-gray-400">{formatTimestamp(dur)}</span>}
                        {/* remove */}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-800/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                        {/* insert indicator */}
                        {insertIdx === i && (
                          <div className="absolute -left-0.5 inset-y-0 w-0.5 bg-blue-500 z-10 pointer-events-none" />
                        )}
                      </div>
                    )
                  })}

                  {/* end insert indicator */}
                  {insertIdx === clips.length && clips.length > 0 && (
                    <div
                      className="absolute inset-y-1 w-0.5 bg-blue-500 z-10 pointer-events-none"
                      style={{ left: secondsToPixels(totalDuration, zoom) }}
                    />
                  )}

                  {/* empty state */}
                  {clips.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-gray-400">
                        {insertIdx !== null ? 'Drop to add clip' : 'Drag clips from the panel above'}
                      </span>
                    </div>
                  )}

                  {/* drag gap slots */}
                  {insertIdx !== null && insertIdx < clips.length && (
                    <div
                      className="absolute top-1 bottom-1 rounded-md border-2 border-dashed border-blue-400 bg-blue-50/60 pointer-events-none flex items-center justify-center"
                      style={{
                        left: secondsToPixels(packed[insertIdx]?.start ?? 0, zoom) - 2,
                        width: 4,
                      }}
                    />
                  )}

                  {/* drag tooltip */}
                  {dragTime !== null && (
                    <div
                      className="absolute bottom-full mb-1 pointer-events-none z-30 bg-gray-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded -translate-x-1/2 whitespace-nowrap"
                      style={{ left: secondsToPixels(dragTime, zoom) }}
                    >
                      {formatTimestamp(dragTime)}
                    </div>
                  )}
                </div>

                {/* waveform track */}
                <div
                  className="relative shrink-0 cursor-crosshair overflow-hidden"
                  style={{ height: WAVE_TRACK_H }}
                  onClick={handleTrackClick}
                >
                  <div className="absolute inset-0 bg-gray-900/[0.02]" />
                  {currentClipSrc && (
                    <div className="absolute inset-0">
                      <div style={{ width: timelineW }} className="h-full">
                        <WaveformTrack
                          src={currentClipSrc}
                          zoom={zoom}
                          height={WAVE_TRACK_H}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* playhead */}
                <div
                  data-playhead="true"
                  className="absolute z-20"
                  style={{ left: playheadLeft - PLAYHEAD_HIT_W / 2, width: PLAYHEAD_HIT_W, top: -2, height: CLIP_TRACK_H + WAVE_TRACK_H + 4, cursor: 'col-resize' }}
                  onMouseDown={handlePlayheadDown}
                >
                  <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-red-500" style={{ top: 16, bottom: 0 }} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center">
                    <div className="rounded-t-sm bg-red-500" style={{ width: 14, height: 10 }} />
                    <div className="w-0 h-0"
                      style={{
                        borderLeft: '7px solid transparent',
                        borderRight: '7px solid transparent',
                        borderTop: '6px solid rgb(239 68 68)',
                      }}
                    />
                  </div>
                </div>

                {/* time ruler */}
                <div className="relative shrink-0 border-t border-gray-200" style={{ height: RULER_H }}>
                  <TimeRuler zoom={zoom} duration={Math.max(duration, totalDuration)} top={0} contentWidth={timelineW} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* duration preloader */}
      <div className="hidden" aria-hidden="true">
        {allAssets.map((asset) => (
          <video
            key={asset.id}
            src={asset.filePath}
            preload="metadata"
            muted
            onLoadedMetadata={(e) => onAssetDuration(asset.id, (e.target as HTMLVideoElement).duration)}
          />
        ))}
      </div>
    </div>
  )
}

function TimeRuler({ zoom, duration, top, contentWidth }: {
  zoom: number; duration: number; top: number; contentWidth: number
}) {
  if (duration === 0) return null
  const target = 80
  const raw = target / zoom
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  const interval = intervals.find((i) => i >= raw) ?? 600
  const ticks: number[] = []
  for (let t = 0; t <= duration + interval; t += interval) ticks.push(t)

  return (
    <div className="absolute left-0 border-t border-gray-100 overflow-hidden" style={{ top, height: RULER_H, width: contentWidth }}>
      {ticks.map((t) => (
        <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: t * zoom }}>
          <div className="w-px h-2 bg-gray-200" />
          <span className="text-[9px] text-gray-400 font-mono mt-0.5 whitespace-nowrap">{formatTimestamp(t)}</span>
        </div>
      ))}
    </div>
  )
}
