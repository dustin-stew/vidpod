'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMarkerStore } from '@/store/markerStore'
import { usePlayerStore } from '@/store/playerStore'
import { WaveformTrack } from '@/components/timeline/WaveformTrack'
import { ZoomControl } from '@/components/timeline/ZoomControl'
import { EpisodeMarkerPanel } from './EpisodeMarkerPanel'
import { CreateAdMarkerDialog } from './CreateAdMarkerDialog'
import { TutorialOverlay } from './TutorialOverlay'
import { packClips, findPackedAtTime } from '@/lib/clipUtils'
import { findQuietSpots } from '@/lib/audioAnalyzer'
import { formatTimestamp, secondsToPixels, pixelsToSeconds, clamp } from '@/lib/utils'
import type { Asset, EpisodeClip, EpisodeWithMarkers, AdSet, AbTestGroup } from '@/types'

const DEFAULT_ZOOM = 60        // px/sec
const CLIP_TRACK_H = 140       // px — single clip+waveform bar height
const RULER_H = 24             // px
const PLAYHEAD_HIT_W = 16      // px — draggable hit area width
const WAVE_COLOR = 'rgba(147, 197, 253, 0.9)'      // light blue waveform fill
const WAVE_PROGRESS = 'rgba(96, 165, 250, 0.95)'   // slightly deeper on playback progress


interface Props {
  episode: EpisodeWithMarkers
  initialClips: EpisodeClip[]
  contentAssets: Asset[]
  adAssets: Asset[]
  initialAdSets: AdSet[]
  initialAbTestGroups: AbTestGroup[]
  initialAdFolders: string[]
}


export function EpisodeDesigner({ episode, initialClips, contentAssets, adAssets, initialAdSets, initialAbTestGroups, initialAdFolders }: Props) {
  const router = useRouter()

  // marker store (legacy — kept for marker panel compatibility)
  const initialize = useMarkerStore((s) => s.initialize)
  useEffect(() => { initialize(episode.markers) }, [episode.id]) // eslint-disable-line

  // clip-action history (undo/redo for clip-level edits like ad drops)
  type HistoryEntry = { undo: () => Promise<void> | void; redo: () => Promise<void> | void }
  const pastRef = useRef<HistoryEntry[]>([])
  const futureRef = useRef<HistoryEntry[]>([])
  const [, setHistoryTick] = useState(0)
  const bumpHistory = () => setHistoryTick((v) => v + 1)
  const pushHistory = useCallback((entry: HistoryEntry) => {
    pastRef.current = [...pastRef.current, entry].slice(-50)
    futureRef.current = []
    bumpHistory()
  }, [])
  const undo = useCallback(async () => {
    const entry = pastRef.current[pastRef.current.length - 1]
    if (!entry) return
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [entry, ...futureRef.current].slice(0, 50)
    bumpHistory()
    await entry.undo()
  }, [])
  const redo = useCallback(async () => {
    const entry = futureRef.current[0]
    if (!entry) return
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current, entry].slice(-50)
    bumpHistory()
    await entry.redo()
  }, [])

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

  const allAssets = [...contentAssets, ...adAssets]

  const [autoInserting, setAutoInserting] = useState(false)
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false)
  const [editingClipId, setEditingClipId] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState<number | null>(null)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

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
  const abTestClipsRef = useRef(abTestClips)
  useEffect(() => { abTestClipsRef.current = abTestClips }, [abTestClips])

  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')

  const [leftPanelPct, setLeftPanelPct] = useState(40)
  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('episode-left-panel-pct') : null
    const n = v ? parseFloat(v) : NaN
    if (!isNaN(n) && n >= 20 && n <= 75) setLeftPanelPct(n)
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('episode-left-panel-pct', String(leftPanelPct))
  }, [leftPanelPct])
  const splitRowRef = useRef<HTMLDivElement>(null)
  const startSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const row = splitRowRef.current
    if (!row) return
    const rect = row.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftPanelPct(Math.min(75, Math.max(20, pct)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const [topRowPct, setTopRowPct] = useState(35)
  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('episode-top-row-pct') : null
    const n = v ? parseFloat(v) : NaN
    if (!isNaN(n) && n >= 15 && n <= 80) setTopRowPct(n)
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('episode-top-row-pct', String(topRowPct))
  }, [topRowPct])
  const bodyColRef = useRef<HTMLDivElement>(null)
  const startVerticalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const col = bodyColRef.current
    if (!col) return
    const rect = col.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientY - rect.top) / rect.height) * 100
      setTopRowPct(Math.min(80, Math.max(15, pct)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  // zoom toward the viewport center: preserve the timeline time at the horizontal middle
  const handleZoomChange = useCallback((nextZoom: number) => {
    const el = scrollRef.current
    if (!el || zoom === nextZoom) { setZoom(nextZoom); return }
    const centerTime = (el.scrollLeft + el.clientWidth / 2) / zoom
    setZoom(nextZoom)
    requestAnimationFrame(() => {
      const el2 = scrollRef.current
      if (!el2) return
      el2.scrollLeft = Math.max(0, centerTime * nextZoom - el2.clientWidth / 2)
    })
  }, [zoom])

  const draggingAssetRef = useRef<Asset | null>(null)
  const draggingClipRef = useRef<string | null>(null) // clipId
  const draggingAdSetRef = useRef<AdSet | null>(null)
  const draggingAbTestGroupRef = useRef<AbTestGroup | null>(null)
  const grabOffsetRef = useRef(0) // seconds from clip's left edge to cursor at dragstart

  const [insertIdx, setInsertIdx] = useState<number | null>(null)
  const [dragTime, setDragTime] = useState<number | null>(null)
  const [dragGhost, setDragGhost] = useState<{ clipId: string; offsetPx: number } | null>(null)
  const [splitHint, setSplitHint] = useState<{
    clipId: string
    splitX: number          // px from track start
    splitTime: number       // virtual timeline seconds
    adWidth: number         // px width of ad placeholder
    localSplit: number      // seconds from start of target clip
    label?: string          // override the "Ad" text (e.g., "Ad set ×3")
  } | null>(null)

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
  function virtualizePacked(p: typeof packed, excludedClipId: string | null) {
    if (!excludedClipId) return p
    const idx = p.findIndex(pp => pp.clip.id === excludedClipId)
    if (idx < 0) return p
    const excluded = p[idx]
    return p
      .filter((_, i) => i !== idx)
      .map(pp => (pp.start > excluded.start ? { ...pp, start: pp.start - excluded.dur } : pp))
  }

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
  function onPanelDragEnd() { draggingAssetRef.current = null; setInsertIdx(null); setDragTime(null); setSplitHint(null) }

  function onClipDragStart(e: React.DragEvent, clipId: string) {
    draggingClipRef.current = clipId
    draggingAssetRef.current = null
    e.dataTransfer.setData('text/plain', 'clip')
    e.dataTransfer.effectAllowed = 'move'
    // grab offset: where inside the clip (in seconds) the user grabbed
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    grabOffsetRef.current = (e.clientX - rect.left) / zoom
    // hide native drag image (we render our own ghost on the track)
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }
  function onClipDragEnd() {
    draggingClipRef.current = null
    setInsertIdx(null)
    setDragTime(null)
    setSplitHint(null)
    setDragGhost(null)
  }

  function onAdSetDragStart(e: React.DragEvent, adSet: AdSet) {
    draggingAdSetRef.current = adSet
    draggingAbTestGroupRef.current = null
    draggingAssetRef.current = null
    e.dataTransfer.setData('text/plain', 'ad_set')
    e.dataTransfer.effectAllowed = 'copy'
  }
  function onAdSetDragEnd() { draggingAdSetRef.current = null; setInsertIdx(null); setDragTime(null); setSplitHint(null) }

  function onAbTestGroupDragStart(e: React.DragEvent, group: AbTestGroup) {
    draggingAbTestGroupRef.current = group
    draggingAdSetRef.current = null
    draggingAssetRef.current = null
    e.dataTransfer.setData('text/plain', 'ab_test_group')
    e.dataTransfer.effectAllowed = 'copy'
  }
  function onAbTestGroupDragEnd() { draggingAbTestGroupRef.current = null; setInsertIdx(null); setDragTime(null); setSplitHint(null) }

  const onTrackDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = draggingClipRef.current ? 'move' : 'copy'
    const rect = scrollRef.current?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0) : 0
    const t = x / zoom
    setDragTime(t)

    // figure out what's being dragged and how it splits content
    const asset = draggingAssetRef.current
    const adSet = draggingAdSetRef.current
    const group = draggingAbTestGroupRef.current

    let totalAdSeconds = 0
    let label: string | undefined

    if (asset && asset.contentType === 'ad') {
      totalAdSeconds = assetDurations[asset.id] ?? asset.duration ?? 0
    } else if (adSet) {
      totalAdSeconds = adSet.assets.reduce((s, a) => s + (assetDurations[a.id] ?? a.duration ?? 0), 0)
      label = `Ad set ×${adSet.assets.length}`
    } else if (group) {
      // dropping an AB test group inserts a single "AB" ad clip using the first variant
      const firstAsset = group.adSets[0]?.assets[0]
      totalAdSeconds = firstAsset ? (assetDurations[firstAsset.id] ?? firstAsset.duration ?? 0) : 0
      const variantCount = group.adSets.reduce((s, g) => s + g.assets.length, 0)
      label = `AB ×${variantCount}`
    }

    // also support dragging an existing ad clip onto a content clip's middle
    const draggingClipId = draggingClipRef.current
    let draggedAdClipDur = 0
    let isDraggingExistingAd = false
    if (draggingClipId) {
      const dragged = packedRef.current.find(p => p.clip.id === draggingClipId)
      if (dragged?.clip.clipType === 'ad') {
        isDraggingExistingAd = true
        draggedAdClipDur = assetDurations[dragged.clip.assetId] ?? dragged.clip.asset?.duration ?? 0
      }
    }

    if (asset?.contentType === 'ad' || adSet || group || isDraggingExistingAd) {
      const p = packedRef.current
      // for existing-ad drags, use the ad's left edge (cursor - grab offset) as the proposed new start
      const searchT = isDraggingExistingAd ? t - grabOffsetRef.current : t
      // snap: if dragging existing ad and its proposed new start is near its current start, move along bar only
      if (isDraggingExistingAd) {
        const excluded = p.find(pp => pp.clip.id === draggingClipId)
        const SNAP = 1 // seconds
        if (excluded && Math.abs(searchT - excluded.start) < SNAP) {
          setSplitHint(null)
          setInsertIdx(null)
          setDragGhost({ clipId: draggingClipId!, offsetPx: (searchT - excluded.start) * zoom })
          return
        }
      }
      setDragGhost(null)
      // virtualize: when moving an existing ad, remove it so adjacent content becomes contiguous
      const searchPacked = isDraggingExistingAd ? virtualizePacked(p, draggingClipId) : p
      const target = searchPacked.find(({ start, dur, clip }) =>
        clip.clipType === 'content' && clip.id !== draggingClipId && searchT > start + 0.3 && searchT < start + dur - 0.3
      )
      if (target) {
        setSplitHint({
          clipId: target.clip.id,
          splitX: secondsToPixels(searchT, zoom),
          splitTime: searchT,
          adWidth: Math.max(secondsToPixels(isDraggingExistingAd ? draggedAdClipDur : totalAdSeconds, zoom), 48),
          localSplit: searchT - target.start + (target.clip.startOffset ?? 0),
          label,
        })
        setInsertIdx(null)
        return
      }
    }
    setDragGhost(null)
    setSplitHint(null)
    setInsertIdx(xToInsertIndex(e.clientX))
  }, [zoom, packed, assetDurations]) // eslint-disable-line

  const onTrackDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setInsertIdx(null)
      setDragTime(null)
      setSplitHint(null)
    }
  }, [])

  const onTrackDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setInsertIdx(null)
    setDragTime(null)
    setSplitHint(null)

    const rectForDrop = scrollRef.current?.getBoundingClientRect()
    const dropX = rectForDrop ? e.clientX - rectForDrop.left + (scrollRef.current?.scrollLeft ?? 0) : 0
    const dropT = dropX / zoom

    // ad-set drop: split content at drop point and insert all ads sequentially
    if (draggingAdSetRef.current) {
      const adSet = draggingAdSetRef.current
      draggingAdSetRef.current = null
      const p = packedRef.current
      const target = p.find(({ start, dur, clip }) =>
        clip.clipType === 'content' && dropT > start + 0.3 && dropT < start + dur - 0.3
      )
      if (!target || adSet.assets.length === 0) return
      const splitOffset = dropT - target.start + (target.clip.startOffset ?? 0)
      const snapshotBefore = clipsRef.current
      const originalEndOffset = target.clip.endOffset

      const splitRes = await fetch(`/api/clips/${target.clip.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'split', splitOffset, adAssetId: adSet.assets[0].id }),
      })
      if (!splitRes.ok) return
      const { clip1, adClip, clip2 } = await splitRes.json()
      const insertedAdClips: EpisodeClip[] = [adClip]
      // insert remaining ads between adClip and clip2
      for (let i = 1; i < adSet.assets.length; i++) {
        const orderIndex = clip1.orderIndex + 1 + i
        const r = await fetch('/api/clips', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeId: episode.id, assetId: adSet.assets[i].id, clipType: 'ad', orderIndex }),
        })
        if (r.ok) insertedAdClips.push(await r.json())
      }
      // rebuild clip list
      const cur = snapshotBefore
      const fromIdx = cur.findIndex(c => c.id === target.clip.id)
      const next = [...cur]
      next.splice(fromIdx, 1, clip1, ...insertedAdClips, clip2)
      updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))

      const idRef = { clip1Id: clip1.id, adClipId: adClip.id, clip2Id: clip2.id, extraAdIds: insertedAdClips.slice(1).map(c => c.id) }
      pushHistory({
        undo: async () => {
          // delete the extra ads first, then merge the split
          for (const id of idRef.extraAdIds) {
            await fetch(`/api/clips/${id}`, { method: 'DELETE' })
          }
          await fetch(`/api/clips/${idRef.clip1Id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mergeSplit', adClipId: idRef.adClipId, clip2Id: idRef.clip2Id }),
          })
          updateClips(snapshotBefore.map((c, i) =>
            c.id === idRef.clip1Id ? { ...c, endOffset: originalEndOffset, orderIndex: i } : { ...c, orderIndex: i }
          ))
        },
        redo: async () => {
          const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset, adAssetId: adSet.assets[0].id }),
          })
          if (!r.ok) return
          const again = await r.json()
          const newExtras: EpisodeClip[] = []
          for (let i = 1; i < adSet.assets.length; i++) {
            const r2 = await fetch('/api/clips', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ episodeId: episode.id, assetId: adSet.assets[i].id, clipType: 'ad', orderIndex: again.clip1.orderIndex + 1 + i }),
            })
            if (r2.ok) newExtras.push(await r2.json())
          }
          const c = clipsRef.current
          const fIdx = c.findIndex(x => x.id === idRef.clip1Id)
          const nxt = [...c]
          nxt.splice(fIdx, 1, again.clip1, again.adClip, ...newExtras, again.clip2)
          updateClips(nxt.map((c2, i) => ({ ...c2, orderIndex: i })))
          idRef.clip1Id = again.clip1.id
          idRef.adClipId = again.adClip.id
          idRef.clip2Id = again.clip2.id
          idRef.extraAdIds = newExtras.map(c => c.id)
        },
      })
      return
    }

    // ab-test-group drop: split content and insert a single AB-test ad clip
    if (draggingAbTestGroupRef.current) {
      const group = draggingAbTestGroupRef.current
      draggingAbTestGroupRef.current = null
      const variantAssets = group.adSets.flatMap(g => g.assets)
      if (variantAssets.length === 0) return
      const p = packedRef.current
      const target = p.find(({ start, dur, clip }) =>
        clip.clipType === 'content' && dropT > start + 0.3 && dropT < start + dur - 0.3
      )
      if (!target) return
      const splitOffset = dropT - target.start + (target.clip.startOffset ?? 0)
      const snapshotBefore = clipsRef.current
      const originalEndOffset = target.clip.endOffset

      const splitRes = await fetch(`/api/clips/${target.clip.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'split', splitOffset, adAssetId: variantAssets[0].id }),
      })
      if (!splitRes.ok) return
      const { clip1, adClip, clip2 } = await splitRes.json()
      // mark as AB test on the server
      await fetch(`/api/clips/${adClip.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setAbTest',
          abTestGroupId: group.id,
          abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)),
          abTestGroupName: group.name,
        }),
      })
      const cur = snapshotBefore
      const fromIdx = cur.findIndex(c => c.id === target.clip.id)
      const markedAdClip = { ...adClip, abTestGroupId: group.id, abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)), abTestGroupName: group.name }
      const next = [...cur]
      next.splice(fromIdx, 1, clip1, markedAdClip, clip2)
      updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))
      setAbTestClips(prev => ({
        ...prev,
        [adClip.id]: {
          groupName: group.name,
          variants: variantAssets,
          activeAssetId: variantAssets[0].id,
          abTestGroupId: group.id,
          abTestGroupName: group.name,
        },
      }))

      const idRef = { clip1Id: clip1.id, adClipId: adClip.id, clip2Id: clip2.id }
      pushHistory({
        undo: async () => {
          await fetch(`/api/clips/${idRef.clip1Id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mergeSplit', adClipId: idRef.adClipId, clip2Id: idRef.clip2Id }),
          })
          updateClips(snapshotBefore.map((c, i) =>
            c.id === idRef.clip1Id ? { ...c, endOffset: originalEndOffset, orderIndex: i } : { ...c, orderIndex: i }
          ))
          setAbTestClips(prev => { const n = { ...prev }; delete n[idRef.adClipId]; return n })
        },
        redo: async () => {
          const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset, adAssetId: variantAssets[0].id }),
          })
          if (!r.ok) return
          const again = await r.json()
          await fetch(`/api/clips/${again.adClip.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'setAbTest',
              abTestGroupId: group.id,
              abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)),
              abTestGroupName: group.name,
            }),
          })
          const c2 = clipsRef.current
          const fIdx = c2.findIndex(x => x.id === idRef.clip1Id)
          const nxt = [...c2]
          nxt.splice(fIdx, 1, again.clip1, { ...again.adClip, abTestGroupId: group.id, abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)), abTestGroupName: group.name }, again.clip2)
          updateClips(nxt.map((c3, i) => ({ ...c3, orderIndex: i })))
          setAbTestClips(prev => ({
            ...prev,
            [again.adClip.id]: {
              groupName: group.name,
              variants: variantAssets,
              activeAssetId: variantAssets[0].id,
              abTestGroupId: group.id,
              abTestGroupName: group.name,
            },
          }))
          idRef.clip1Id = again.clip1.id
          idRef.adClipId = again.adClip.id
          idRef.clip2Id = again.clip2.id
        },
      })
      return
    }

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
          const originalEndOffset = target.clip.endOffset
          const res = await fetch(`/api/clips/${target.clip.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset, adAssetId: asset.id }),
          })
          if (res.ok) {
            const { clip1, adClip, clip2 } = await res.json()
            const current = clipsRef.current
            const fromIdx = current.findIndex(c => c.id === target.clip.id)
            const snapshotBefore = current
            const next = [...current]
            next.splice(fromIdx, 1, clip1, adClip, clip2)
            const snapshotAfter = next.map((c, i) => ({ ...c, orderIndex: i }))
            updateClips(snapshotAfter)

            // history: undo reverses the split via mergeSplit; redo re-splits.
            // IDs of adClip/clip2 change on redo, so track them via a mutable ref.
            const idRef = { clip1Id: clip1.id, adClipId: adClip.id, clip2Id: clip2.id }
            pushHistory({
              undo: async () => {
                const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'mergeSplit', adClipId: idRef.adClipId, clip2Id: idRef.clip2Id }),
                })
                if (r.ok) {
                  updateClips(snapshotBefore.map((c, i) =>
                    c.id === idRef.clip1Id ? { ...c, endOffset: originalEndOffset, orderIndex: i } : { ...c, orderIndex: i }
                  ))
                  // clear ab-test entry on the removed ad clip if any
                  setAbTestClips((prev) => {
                    if (!prev[idRef.adClipId]) return prev
                    const n = { ...prev }; delete n[idRef.adClipId]; return n
                  })
                }
              },
              redo: async () => {
                const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'split', splitOffset, adAssetId: asset.id }),
                })
                if (r.ok) {
                  const again = await r.json()
                  const cur = clipsRef.current
                  const fIdx = cur.findIndex(c => c.id === idRef.clip1Id)
                  const nxt = [...cur]
                  nxt.splice(fIdx, 1, again.clip1, again.adClip, again.clip2)
                  updateClips(nxt.map((c, i) => ({ ...c, orderIndex: i })))
                  // update tracked IDs so the next undo targets the new ad/clip2
                  idRef.clip1Id = again.clip1.id
                  idRef.adClipId = again.adClip.id
                  idRef.clip2Id = again.clip2.id
                }
              },
            })
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
        const snapshotBefore = clipsRef.current
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
        pushHistory({
          undo: async () => {
            await fetch(`/api/clips/${newClip.id}`, { method: 'DELETE' })
            updateClips(snapshotBefore.map((c, i) => ({ ...c, orderIndex: i })))
          },
          redo: async () => {
            const r = await fetch('/api/clips', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ episodeId: episode.id, assetId: asset.id, clipType: asset.contentType, orderIndex: idx }),
            })
            if (r.ok) {
              const created: EpisodeClip = await r.json()
              const cur = clipsRef.current
              const nxt = [...cur]
              nxt.splice(idx, 0, created)
              updateClips(nxt.map((c, i) => ({ ...c, orderIndex: i })))
            }
          },
        })
      }
    } else if (draggingClipRef.current) {
      const clipId = draggingClipRef.current
      draggingClipRef.current = null
      const current = clipsRef.current
      const dragged = current.find(c => c.id === clipId)

      // if moving an ad onto a content clip's middle, split-move: remove old ad, split target at drop, re-mark AB if needed
      if (dragged?.clipType === 'ad') {
        const p = packedRef.current
        // proposed new start = cursor time minus where inside the clip the user grabbed
        const newAdStart = dropT - grabOffsetRef.current
        // snap: within 1s of current ad start -> no-op
        const excluded = p.find(pp => pp.clip.id === clipId)
        const SNAP = 1
        if (excluded && Math.abs(newAdStart - excluded.start) < SNAP) return
        // use virtualized packed so adjacent content clips become contiguous when the ad is removed
        const searchPacked = virtualizePacked(p, clipId)
        const target = searchPacked.find(({ start, dur, clip }) =>
          clip.clipType === 'content' && clip.id !== clipId && newAdStart > start + 0.3 && newAdStart < start + dur - 0.3
        )
        if (target) {
          const splitOffset = newAdStart - target.start + (target.clip.startOffset ?? 0)
          const adAssetId = dragged.assetId
          const oldAbInfo = abTestClipsRef.current[clipId]
          const snapshotBefore = current
          const originalAd = dragged
          const originalTargetEndOffset = target.clip.endOffset

          await fetch(`/api/clips/${clipId}`, { method: 'DELETE' })

          const res = await fetch(`/api/clips/${target.clip.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset, adAssetId }),
          })
          if (!res.ok) return
          const { clip1, adClip, clip2 } = await res.json()

          if (oldAbInfo) {
            await fetch(`/api/clips/${adClip.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'setAbTest',
                abTestGroupId: oldAbInfo.abTestGroupId,
                abTestVariantIds: JSON.stringify(oldAbInfo.variants.map(v => v.id)),
                abTestGroupName: oldAbInfo.abTestGroupName ?? oldAbInfo.groupName,
              }),
            })
          }

          const withoutOld = current.filter(c => c.id !== clipId)
          const targetIdx = withoutOld.findIndex(c => c.id === target.clip.id)
          const markedAdClip = oldAbInfo
            ? { ...adClip, abTestGroupId: oldAbInfo.abTestGroupId, abTestVariantIds: JSON.stringify(oldAbInfo.variants.map(v => v.id)), abTestGroupName: oldAbInfo.abTestGroupName ?? oldAbInfo.groupName }
            : adClip
          const next = [...withoutOld]
          next.splice(targetIdx, 1, clip1, markedAdClip, clip2)

          if (oldAbInfo) {
            setAbTestClips(prev => {
              const n = { ...prev }
              delete n[clipId]
              n[adClip.id] = oldAbInfo
              return n
            })
          }

          // auto-merge any content siblings that became adjacent after deleting the old ad
          const { clips: afterMerges, merges: splitMoveMerges } = await runMergeSiblings(next.map((c, i) => ({ ...c, orderIndex: i })))
          updateClips(afterMerges)

          const idRef = {
            oldAdAssetId: originalAd.assetId,
            oldAdOrderIndex: originalAd.orderIndex,
            oldAdId: clipId, // tracks the most recently-created id for this "old ad" across undo/redo
            targetId: target.clip.id,
            clip1Id: clip1.id,
            adClipId: adClip.id,
            clip2Id: clip2.id,
            merges: splitMoveMerges as MergeRec[],
          }
          pushHistory({
            undo: async () => {
              // reverse the NEW split → restores target clip
              await fetch(`/api/clips/${idRef.clip1Id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mergeSplit', adClipId: idRef.adClipId, clip2Id: idRef.clip2Id }),
              })
              // reverse auto-merge (if any) by re-splitting the kept clip AND re-inserting the old ad in one op
              let recreated: EpisodeClip | null = null
              if (idRef.merges.length === 1) {
                const m = idRef.merges[0]
                const r = await fetch(`/api/clips/${m.keptId}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'split', splitOffset: m.splitOffset, adAssetId: idRef.oldAdAssetId }),
                })
                if (r.ok) {
                  const { adClip: reAd } = await r.json()
                  recreated = reAd
                }
              } else {
                const r = await fetch('/api/clips', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    episodeId: episode.id,
                    assetId: idRef.oldAdAssetId,
                    clipType: 'ad',
                    orderIndex: idRef.oldAdOrderIndex,
                  }),
                })
                if (r.ok) recreated = await r.json()
              }
              if (recreated) {
                idRef.oldAdId = recreated.id
                if (oldAbInfo) {
                  await fetch(`/api/clips/${recreated.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'setAbTest',
                      abTestGroupId: oldAbInfo.abTestGroupId,
                      abTestVariantIds: JSON.stringify(oldAbInfo.variants.map(v => v.id)),
                      abTestGroupName: oldAbInfo.abTestGroupName ?? oldAbInfo.groupName,
                    }),
                  })
                  setAbTestClips(prev => {
                    const n = { ...prev }
                    delete n[idRef.adClipId]
                    n[recreated!.id] = oldAbInfo
                    return n
                  })
                }
              }
              // Rebuild from the pre-action snapshot, substituting the re-created ad's new id + AB fields
              const restored = snapshotBefore.map(c => {
                if (c.id === originalAd.id && recreated) {
                  return {
                    ...recreated,
                    abTestGroupId: oldAbInfo?.abTestGroupId ?? null,
                    abTestVariantIds: oldAbInfo ? JSON.stringify(oldAbInfo.variants.map(v => v.id)) : null,
                    abTestGroupName: oldAbInfo?.abTestGroupName ?? oldAbInfo?.groupName ?? null,
                  }
                }
                if (c.id === idRef.targetId) return { ...c, endOffset: originalTargetEndOffset }
                return c
              })
              updateClips(restored.map((c, i) => ({ ...c, orderIndex: i })))
            },
            redo: async () => {
              await fetch(`/api/clips/${idRef.oldAdId}`, { method: 'DELETE' })
              const r = await fetch(`/api/clips/${idRef.targetId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'split', splitOffset, adAssetId }),
              })
              if (!r.ok) return
              const again = await r.json()
              idRef.clip1Id = again.clip1.id
              idRef.adClipId = again.adClip.id
              idRef.clip2Id = again.clip2.id
              if (oldAbInfo) {
                await fetch(`/api/clips/${again.adClip.id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'setAbTest',
                    abTestGroupId: oldAbInfo.abTestGroupId,
                    abTestVariantIds: JSON.stringify(oldAbInfo.variants.map(v => v.id)),
                    abTestGroupName: oldAbInfo.abTestGroupName ?? oldAbInfo.groupName,
                  }),
                })
                setAbTestClips(prev => {
                  const n = { ...prev }
                  delete n[idRef.oldAdId]
                  n[again.adClip.id] = oldAbInfo
                  return n
                })
              }
              const cur = clipsRef.current
              const withoutOld2 = cur.filter(c => c.id !== idRef.oldAdId)
              const tIdx = withoutOld2.findIndex(c => c.id === idRef.targetId)
              const markedAgain = oldAbInfo
                ? { ...again.adClip, abTestGroupId: oldAbInfo.abTestGroupId, abTestVariantIds: JSON.stringify(oldAbInfo.variants.map(v => v.id)), abTestGroupName: oldAbInfo.abTestGroupName ?? oldAbInfo.groupName }
                : again.adClip
              const nxt = [...withoutOld2]
              nxt.splice(tIdx, 1, again.clip1, markedAgain, again.clip2)
              const { clips: merged2, merges: againMerges } = await runMergeSiblings(nxt.map((c, i) => ({ ...c, orderIndex: i })))
              idRef.merges = againMerges
              updateClips(merged2)
            },
          })
          return
        }
      }

      const idx = xToInsertIndex(e.clientX)
      const fromIdx = current.findIndex((c) => c.id === clipId)
      if (fromIdx < 0 || fromIdx === idx || fromIdx + 1 === idx) return
      const prevSnapshot = current
      const next = [...current]
      const [moved] = next.splice(fromIdx, 1)
      const insertAt = idx > fromIdx ? idx - 1 : idx
      next.splice(insertAt, 0, moved)
      const nextSnapshot = next.map((c, i) => ({ ...c, orderIndex: i }))
      updateClips(nextSnapshot)
      await fetch(`/api/clips/${clipId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: episode.id, orderedIds: next.map((c) => c.id) }),
      })
      pushHistory({
        undo: async () => {
          updateClips(prevSnapshot.map((c, i) => ({ ...c, orderIndex: i })))
          await fetch(`/api/clips/${clipId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episodeId: episode.id, orderedIds: prevSnapshot.map((c) => c.id) }),
          })
        },
        redo: async () => {
          updateClips(nextSnapshot)
          await fetch(`/api/clips/${clipId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episodeId: episode.id, orderedIds: nextSnapshot.map((c) => c.id) }),
          })
        },
      })
    }
  }, [episode.id, zoom, packed, pushHistory]) // eslint-disable-line

  type MergeRec = { keptId: string; deletedId: string; newEndOffset: number; splitOffset: number }

  // Request server-side merge of adjacent content siblings (clip pairs where right.startOffset === left.endOffset
  // and they share assetId). Apply returned merges to the provided clip list and return { clips, merges }.
  async function runMergeSiblings(baseClips: EpisodeClip[]): Promise<{ clips: EpisodeClip[]; merges: MergeRec[] }> {
    const r = await fetch(`/api/episodes/${episode.id}/merge-siblings`, { method: 'POST' })
    if (!r.ok) return { clips: baseClips, merges: [] }
    const { merges } = await r.json() as { merges: MergeRec[] }
    if (!merges || merges.length === 0) return { clips: baseClips, merges: [] }
    let out = baseClips
    for (const m of merges) {
      out = out
        .filter(c => c.id !== m.deletedId)
        .map(c => c.id === m.keptId ? { ...c, endOffset: m.newEndOffset } : c)
    }
    return { clips: out.map((c, i) => ({ ...c, orderIndex: i })), merges }
  }

  async function removeClip(id: string) {
    const beforeSnapshot = clipsRef.current
    const removed = beforeSnapshot.find((c) => c.id === id)
    if (!removed) return
    await fetch(`/api/clips/${id}`, { method: 'DELETE' })
    const remaining = beforeSnapshot.filter((c) => c.id !== id).map((c, i) => ({ ...c, orderIndex: i }))
    const { clips: merged, merges } = await runMergeSiblings(remaining)
    updateClips(merged)
    // clear waveform if empty
    if (remaining.length === 0) {
      setCurrentClipSrc('')
      currentClipSrcRef.current = ''
      activeClipIdRef.current = null
    }
    const undoMergeRef = { merges, lastRecreatedId: id }
    pushHistory({
      undo: async () => {
        // If auto-merge happened when we removed an ad, reverse it via splitClip which atomically
        // re-creates the two siblings AND inserts the ad in the middle.
        if (removed.clipType === 'ad' && undoMergeRef.merges.length === 1) {
          const m = undoMergeRef.merges[0]
          const r = await fetch(`/api/clips/${m.keptId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'split', splitOffset: m.splitOffset, adAssetId: removed.assetId }),
          })
          if (r.ok) {
            const { clip1, adClip, clip2 } = await r.json()
            undoMergeRef.lastRecreatedId = adClip.id
            const cur = clipsRef.current
            const idx = cur.findIndex(c => c.id === m.keptId)
            const nxt = [...cur]
            nxt.splice(idx, 1, clip1, adClip, clip2)
            updateClips(nxt.map((c, i) => ({ ...c, orderIndex: i })))
            return
          }
        }
        // Fallback: plain re-add at original order index
        const r = await fetch('/api/clips', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episodeId: episode.id,
            assetId: removed.assetId,
            clipType: removed.clipType,
            orderIndex: removed.orderIndex,
          }),
        })
        if (r.ok) {
          const recreated: EpisodeClip = await r.json()
          undoMergeRef.lastRecreatedId = recreated.id
          const cur = clipsRef.current
          const nxt = [...cur]
          nxt.splice(removed.orderIndex, 0, recreated)
          updateClips(nxt.map((c, i) => ({ ...c, orderIndex: i })))
        }
      },
      redo: async () => {
        const delId = undoMergeRef.lastRecreatedId
        await fetch(`/api/clips/${delId}`, { method: 'DELETE' })
        const rem = clipsRef.current.filter((c) => c.id !== delId).map((c, i) => ({ ...c, orderIndex: i }))
        const { clips: again, merges: againMerges } = await runMergeSiblings(rem)
        undoMergeRef.merges = againMerges
        updateClips(again)
      },
    })
  }

  // auto-insert at quietest spots
  // find the content clip + split offset that best matches a given timeline time.
  // if the time is inside a valid content clip, use that. otherwise snap to the nearest
  // content clip and clamp to a safe edge margin.
  const nearestValidSplit = useCallback((time: number) => {
    const p = packedRef.current
    const contentItems = p.filter(i => i.clip.clipType === 'content')
    if (contentItems.length === 0) return null
    const EDGE = 0.3
    const hit = contentItems.find(i => time > i.start + EDGE && time < i.start + i.dur - EDGE)
    if (hit) {
      return {
        target: hit,
        splitOffset: time - hit.start + (hit.clip.startOffset ?? 0),
        adjustedTime: time,
      }
    }
    let best: typeof contentItems[number] | null = null
    let bestDist = Infinity
    let bestClamped = 0
    for (const item of contentItems) {
      const left = item.start + EDGE
      const right = item.start + item.dur - EDGE
      if (right <= left) continue
      const clamped = Math.max(left, Math.min(right, time))
      const dist = Math.abs(clamped - time)
      if (dist < bestDist) { bestDist = dist; best = item; bestClamped = clamped }
    }
    if (!best) return null
    return {
      target: best,
      splitOffset: bestClamped - best.start + (best.clip.startOffset ?? 0),
      adjustedTime: bestClamped,
    }
  }, [])

  // programmatic single-ad insert at a given time (used by the "insert at playhead" flow).
  // mirrors the ad-drop branch of onTrackDrop.
  const insertAdAtTime = useCallback(async (asset: Asset, time: number) => {
    const found = nearestValidSplit(time)
    if (!found) return
    const { target, splitOffset } = found
    const originalEndOffset = target.clip.endOffset
    const res = await fetch(`/api/clips/${target.clip.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'split', splitOffset, adAssetId: asset.id }),
    })
    if (!res.ok) return
    const { clip1, adClip, clip2 } = await res.json()
    const snapshotBefore = clipsRef.current
    const fromIdx = snapshotBefore.findIndex(c => c.id === target.clip.id)
    const next = [...snapshotBefore]
    next.splice(fromIdx, 1, clip1, adClip, clip2)
    updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))

    const idRef = { clip1Id: clip1.id, adClipId: adClip.id, clip2Id: clip2.id }
    pushHistory({
      undo: async () => {
        const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mergeSplit', adClipId: idRef.adClipId, clip2Id: idRef.clip2Id }),
        })
        if (r.ok) {
          updateClips(snapshotBefore.map((c, i) =>
            c.id === idRef.clip1Id ? { ...c, endOffset: originalEndOffset, orderIndex: i } : { ...c, orderIndex: i }
          ))
        }
      },
      redo: async () => {
        const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'split', splitOffset, adAssetId: asset.id }),
        })
        if (!r.ok) return
        const again = await r.json()
        const c = clipsRef.current
        const fIdx = c.findIndex(x => x.id === idRef.clip1Id)
        const nxt = [...c]
        nxt.splice(fIdx, 1, again.clip1, again.adClip, again.clip2)
        updateClips(nxt.map((c2, i) => ({ ...c2, orderIndex: i })))
        idRef.clip1Id = again.clip1.id
        idRef.adClipId = again.adClip.id
        idRef.clip2Id = again.clip2.id
      },
    })
  }, [nearestValidSplit, pushHistory])

  // programmatic ab-test group insert at a given time. mirrors the ab-test drop branch.
  const insertAbTestGroupAtTime = useCallback(async (group: AbTestGroup, time: number) => {
    const variantAssets = group.adSets.flatMap(g => g.assets)
    if (variantAssets.length === 0) return
    const found = nearestValidSplit(time)
    if (!found) return
    const { target, splitOffset } = found
    const originalEndOffset = target.clip.endOffset
    const snapshotBefore = clipsRef.current

    const splitRes = await fetch(`/api/clips/${target.clip.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'split', splitOffset, adAssetId: variantAssets[0].id }),
    })
    if (!splitRes.ok) return
    const { clip1, adClip, clip2 } = await splitRes.json()
    await fetch(`/api/clips/${adClip.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setAbTest',
        abTestGroupId: group.id,
        abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)),
        abTestGroupName: group.name,
      }),
    })
    const fromIdx = snapshotBefore.findIndex(c => c.id === target.clip.id)
    const markedAdClip = { ...adClip, abTestGroupId: group.id, abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)), abTestGroupName: group.name }
    const next = [...snapshotBefore]
    next.splice(fromIdx, 1, clip1, markedAdClip, clip2)
    updateClips(next.map((c, i) => ({ ...c, orderIndex: i })))
    setAbTestClips(prev => ({
      ...prev,
      [adClip.id]: {
        groupName: group.name,
        variants: variantAssets,
        activeAssetId: variantAssets[0].id,
        abTestGroupId: group.id,
        abTestGroupName: group.name,
      },
    }))

    const idRef = { clip1Id: clip1.id, adClipId: adClip.id, clip2Id: clip2.id }
    pushHistory({
      undo: async () => {
        await fetch(`/api/clips/${idRef.clip1Id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mergeSplit', adClipId: idRef.adClipId, clip2Id: idRef.clip2Id }),
        })
        updateClips(snapshotBefore.map((c, i) =>
          c.id === idRef.clip1Id ? { ...c, endOffset: originalEndOffset, orderIndex: i } : { ...c, orderIndex: i }
        ))
        setAbTestClips(prev => { const n = { ...prev }; delete n[idRef.adClipId]; return n })
      },
      redo: async () => {
        const r = await fetch(`/api/clips/${idRef.clip1Id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'split', splitOffset, adAssetId: variantAssets[0].id }),
        })
        if (!r.ok) return
        const again = await r.json()
        await fetch(`/api/clips/${again.adClip.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setAbTest',
            abTestGroupId: group.id,
            abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)),
            abTestGroupName: group.name,
          }),
        })
        const c2 = clipsRef.current
        const fIdx = c2.findIndex(x => x.id === idRef.clip1Id)
        const nxt = [...c2]
        nxt.splice(fIdx, 1, again.clip1, { ...again.adClip, abTestGroupId: group.id, abTestVariantIds: JSON.stringify(variantAssets.map(a => a.id)), abTestGroupName: group.name }, again.clip2)
        updateClips(nxt.map((c3, i) => ({ ...c3, orderIndex: i })))
        setAbTestClips(prev => ({
          ...prev,
          [again.adClip.id]: {
            groupName: group.name,
            variants: variantAssets,
            activeAssetId: variantAssets[0].id,
            abTestGroupId: group.id,
            abTestGroupName: group.name,
          },
        }))
        idRef.clip1Id = again.clip1.id
        idRef.adClipId = again.adClip.id
        idRef.clip2Id = again.clip2.id
      },
    })
  }, [nearestValidSplit, pushHistory])

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
      <div ref={bodyColRef} className="flex-1 flex flex-col min-h-0">

        {/* asset panel + preview */}
        <div ref={splitRowRef} className="flex" style={{ height: `${topRowPct}%` }}>

          <div className="shrink-0 border-r border-gray-100 flex flex-col overflow-hidden" style={{ width: `${leftPanelPct}%` }}>
          {markerDialogOpen ? (
            <CreateAdMarkerDialog
              onClose={() => { setMarkerDialogOpen(false); setEditingClipId(null); setEditingTime(null) }}
              adAssets={adAssets}
              initialAdSets={initialAdSets}
              initialAbTestGroups={initialAbTestGroups}
              initialAdFolders={initialAdFolders}
              clips={clips}
              currentTime={currentTime}
              hasValidInsertPoint={editingClipId != null || nearestValidSplit(currentTime) != null}
              autoInserting={autoInserting}
              editing={editingClipId != null}
              editingTime={editingTime}
              onInsertAd={async (asset) => {
                if (editingClipId != null && editingTime != null) {
                  const t = editingTime
                  const id = editingClipId
                  await removeClip(id)
                  setAbTestClips(prev => { const n = { ...prev }; delete n[id]; return n })
                  await insertAdAtTime(asset, t)
                } else {
                  await insertAdAtTime(asset, currentTime)
                }
              }}
              onInsertAbTestGroup={async (group) => {
                if (editingClipId != null && editingTime != null) {
                  const t = editingTime
                  const id = editingClipId
                  await removeClip(id)
                  setAbTestClips(prev => { const n = { ...prev }; delete n[id]; return n })
                  await insertAbTestGroupAtTime(group, t)
                } else {
                  await insertAbTestGroupAtTime(group, currentTime)
                }
              }}
              onAutoInsertAds={(ids) => doAutoInsert(ids, 'spread')}
              onAutoInsertAdSet={(g) => doAutoInsert(g.assets.map(a => a.id), 'spread')}
              onAutoInsertAbTestGroup={(g) => {
                const ids = g.adSets.flatMap(s => s.assets.map(a => a.id))
                doAutoInsert(ids, 'single', g.name, { id: g.id, name: g.name })
              }}
              onQuickAbTest={async (prefix, assetIds) => {
                const setRes = await fetch('/api/ad-sets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: prefix, assetIds }),
                })
                if (!setRes.ok) throw new Error('Failed to create ad set')
                const newSet: AdSet = await setRes.json()
                const grpRes = await fetch('/api/ab-test-groups', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: prefix, adSetIds: [newSet.id] }),
                })
                if (!grpRes.ok) throw new Error('Failed to create ab test group')
                const newGroup: AbTestGroup = await grpRes.json()
                await doAutoInsert(assetIds, 'single', prefix, { id: newGroup.id, name: newGroup.name })
              }}
              onAssetDuration={onAssetDuration}
            />
          ) : (
            <EpisodeMarkerPanel
              packed={packed}
              abTestClips={abTestClips}
              onOpenCreate={() => setMarkerDialogOpen(true)}
              onSelectClip={(id) => setSelectedClipId(prev => prev === id ? null : id)}
              onDeleteClip={(id) => {
                removeClip(id)
                setAbTestClips(prev => { const n = { ...prev }; delete n[id]; return n })
              }}
              onEditClip={(id) => {
                const item = packed.find(p => p.clip.id === id)
                if (!item) return
                setEditingClipId(id)
                setEditingTime(item.start)
                setMarkerDialogOpen(true)
              }}
              selectedClipId={selectedClipId}
              onContentDragStart={onPanelDragStart}
              onContentDragEnd={onPanelDragEnd}
            />
          )}
          </div>

          {/* drag handle */}
          <div
            data-tour="split-handle"
            onMouseDown={startSplitResize}
            onDoubleClick={() => setLeftPanelPct(40)}
            title="Drag to resize — double-click to reset"
            className="shrink-0 w-1.5 cursor-col-resize bg-gray-100 hover:bg-indigo-300 active:bg-indigo-400 transition-colors"
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
        {/* vertical drag handle */}
        <div
          data-tour="split-handle-v"
          onMouseDown={startVerticalResize}
          onDoubleClick={() => setTopRowPct(35)}
          title="Drag to resize — double-click to reset"
          className="shrink-0 h-1.5 cursor-row-resize bg-gray-100 hover:bg-indigo-300 active:bg-indigo-400 transition-colors"
        />

        <div className="flex flex-col min-h-0 bg-white" style={{ height: `${100 - topRowPct}%` }}>

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
            <button
              onClick={() => undo()}
              disabled={pastRef.current.length === 0}
              title="Undo (⌘Z)"
              className="w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
            </button>
            <button
              onClick={() => redo()}
              disabled={futureRef.current.length === 0}
              title="Redo (⌘⇧Z)"
              className="w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/>
              </svg>
            </button>
            <ZoomControl zoom={zoom} onChange={handleZoomChange} />
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">

            <div className="w-16 shrink-0 flex flex-col border-r border-gray-100 select-none">
              <div style={{ height: CLIP_TRACK_H }} className="shrink-0 flex items-center justify-end pr-2 text-[10px] text-gray-400 font-medium">
                clips
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

                    // ab test: stacked variant bars, waveform inside active bar
                    if (isAd && abTest) {
                      const variantColors = ['bg-purple-200 border-purple-400', 'bg-pink-200 border-pink-400', 'bg-indigo-200 border-indigo-400', 'bg-fuchsia-200 border-fuchsia-400']
                      const assetDurAb = assetDurations[clip.assetId] ?? clip.asset?.duration ?? 0
                      const startOffAb = clip.startOffset ?? 0
                      return (
                        <div
                          key={clip.id}
                          data-clip="true"
                          draggable
                          onDragStart={(e) => onClipDragStart(e, clip.id)}
                          onDragEnd={onClipDragEnd}
                          className="absolute top-1 bottom-1 rounded-md border border-purple-400 bg-purple-50 flex flex-col overflow-hidden z-[2] group select-none cursor-grab active:cursor-grabbing"
                          style={{
                            left: x,
                            width: w,
                            transform: dragGhost?.clipId === clip.id ? `translateX(${dragGhost.offsetPx}px)` : undefined,
                          }}
                        >
                          {/* header */}
                          <div className="relative z-[2] flex items-center gap-1 px-1.5 py-0.5 min-w-0 shrink-0">
                            <span className="text-[7px] font-bold text-purple-700 bg-purple-300 px-1 rounded uppercase shrink-0">AB</span>
                            <span className="text-[9px] font-medium text-purple-800 truncate">{abTest.abTestGroupName ?? abTest.groupName} @ {formatTimestamp(start)}</span>
                          </div>
                          {/* variant bars */}
                          <div className="relative z-[2] flex-1 flex flex-col gap-px px-0.5 pb-0.5 min-h-0">
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
                                  className={`relative flex-1 min-h-[14px] rounded-sm border text-[8px] px-1 text-left transition-all overflow-hidden ${colorClass} ${
                                    isActive ? 'ring-2 ring-purple-500 ring-inset font-bold' : 'opacity-60 hover:opacity-90'
                                  }`}
                                >
                                  {/* waveform fills the active variant bar */}
                                  {isActive && variant.filePath && assetDurAb > 0 && (
                                    <div className="absolute inset-0 pointer-events-none opacity-70">
                                      <div
                                        style={{
                                          position: 'absolute',
                                          left: -secondsToPixels(startOffAb, zoom),
                                          top: 0,
                                          bottom: 0,
                                          width: secondsToPixels(assetDurAb, zoom),
                                        }}
                                      >
                                        <WaveformTrack
                                          src={variant.filePath}
                                          zoom={zoom}
                                          height={CLIP_TRACK_H - 2}
                                          waveColor={WAVE_COLOR}
                                          progressColor={WAVE_PROGRESS}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <span className="relative z-[1] flex items-center truncate">
                                    {isActive && <span className="mr-0.5">▶</span>}
                                    {variant.name}
                                  </span>
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
                    const assetDur = assetDurations[clip.assetId] ?? clip.asset?.duration ?? 0
                    const startOff = clip.startOffset ?? 0
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
                        } ${splitHint?.clipId === clip.id ? 'ring-2 ring-orange-400 ring-offset-0' : ''}`}
                        style={{
                          left: x,
                          width: w,
                          transform: dragGhost?.clipId === clip.id ? `translateX(${dragGhost.offsetPx}px)` : undefined,
                        }}
                      >
                        {/* waveform underlay — sliced by overflow */}
                        {clip.asset?.filePath && assetDur > 0 && (
                          <div className="absolute inset-0 pointer-events-none opacity-70">
                            <div
                              style={{
                                position: 'absolute',
                                left: -secondsToPixels(startOff, zoom),
                                top: 0,
                                bottom: 0,
                                width: secondsToPixels(assetDur, zoom),
                              }}
                            >
                              <WaveformTrack
                                src={clip.asset.filePath}
                                zoom={zoom}
                                height={CLIP_TRACK_H - 2}
                                waveColor={WAVE_COLOR}
                                progressColor={WAVE_PROGRESS}
                              />
                            </div>
                          </div>
                        )}
                        {/* break-apart visualization when a new ad is being dropped on this clip */}
                        {splitHint?.clipId === clip.id && (
                          <div
                            className="absolute top-0 bottom-0 bg-white pointer-events-none z-[3]"
                            style={{
                              left: (splitHint.splitX - x) - 2,
                              width: 4,
                              boxShadow: '0 0 0 1px rgba(249, 115, 22, 0.8)',
                            }}
                          />
                        )}
                        <div className="relative z-[2] flex items-center gap-1 min-w-0">
                          {isAd && <span className="text-[8px] font-bold text-orange-700 bg-orange-300 px-1 rounded uppercase shrink-0">AD</span>}
                          <span className="text-[10px] font-medium text-gray-700 truncate">{clip.asset?.name}</span>
                        </div>
                        {dur > 0 && <span className="relative z-[2] text-[9px] text-gray-400">{formatTimestamp(dur)}</span>}
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

                  {/* drag tooltip (normal inserts — not split) */}
                  {dragTime !== null && !splitHint && (
                    <div
                      className="absolute bottom-full mb-1 pointer-events-none z-30 bg-gray-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded -translate-x-1/2 whitespace-nowrap"
                      style={{ left: secondsToPixels(dragTime, zoom) }}
                    >
                      {formatTimestamp(dragTime)}
                    </div>
                  )}

                  {/* split hint: ghost ad placeholder + timestamp pill */}
                  {splitHint && (
                    <>
                      <div
                        className="absolute top-1 bottom-1 z-[5] pointer-events-none rounded-md border-2 border-dashed border-orange-500 bg-orange-200/75 shadow-lg flex items-center justify-center animate-pulse"
                        style={{
                          left: splitHint.splitX,
                          width: splitHint.adWidth,
                        }}
                      >
                        <span className="text-[9px] font-bold text-orange-700 uppercase tracking-wider">
                          {splitHint.label ?? 'Ad'}
                        </span>
                      </div>
                      <div
                        className="absolute z-[6] pointer-events-none bg-orange-500 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap -translate-x-1/2"
                        style={{ left: splitHint.splitX, top: 4 }}
                      >
                        Split @ {formatTimestamp(splitHint.splitTime)}
                      </div>
                    </>
                  )}
                </div>

                {/* playhead */}
                <div
                  data-playhead="true"
                  data-tour="playhead"
                  className="absolute z-20"
                  style={{ left: playheadLeft - PLAYHEAD_HIT_W / 2, width: PLAYHEAD_HIT_W, top: -2, height: CLIP_TRACK_H + 4, cursor: 'col-resize' }}
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
