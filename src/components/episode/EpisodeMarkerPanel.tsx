'use client'

import React, { useMemo, useState } from 'react'
import { formatTimestamp } from '@/lib/utils'
import type { Asset, EpisodeClip } from '@/types'

interface PackedItem {
  clip: EpisodeClip
  start: number
  dur: number
}

export interface AbTestClipInfo {
  groupName: string
  variants: Asset[]
  activeAssetId: string
  abTestGroupId?: string
  abTestGroupName?: string
}

export interface EpisodeMarkerPanelProps {
  packed: PackedItem[]
  abTestClips: Record<string, AbTestClipInfo>
  onOpenCreate: () => void
  onSelectClip: (clipId: string) => void
  onDeleteClip: (clipId: string) => void
  onEditClip: (clipId: string) => void
  selectedClipId?: string | null
  onContentDragStart?: (e: React.DragEvent, asset: Asset) => void
  onContentDragEnd?: () => void
}

export function EpisodeMarkerPanel({
  packed, abTestClips, onOpenCreate, onSelectClip, onDeleteClip, onEditClip, selectedClipId,
  onContentDragStart, onContentDragEnd,
}: EpisodeMarkerPanelProps) {

  const contentItems = useMemo(() => packed.filter(p => p.clip.clipType === 'content'), [packed])
  const adItems = useMemo(() => packed.filter(p => p.clip.clipType === 'ad'), [packed])

  // deduplicate content assets for the summary (track of unique sources)
  const contentAssetSummary = useMemo(() => {
    const map = new Map<string, { asset: Asset; totalDur: number }>()
    for (const it of contentItems) {
      const existing = map.get(it.clip.assetId)
      if (existing) { existing.totalDur += it.dur }
      else map.set(it.clip.assetId, { asset: it.clip.asset, totalDur: it.dur })
    }
    return Array.from(map.values())
  }, [contentItems])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="relative flex flex-col bg-gray-50 overflow-hidden w-full h-full">
      <div className="h-10 shrink-0 flex items-center px-3 border-b border-gray-100 bg-white">
        <div className="text-xs font-semibold text-gray-700">Episode markers</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ad markers section */}
        <div className="border-b border-gray-100">
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Ad markers</div>
            <div className="text-[10px] text-gray-400">{adItems.length}</div>
          </div>
          {adItems.length === 0 ? (
            <div className="px-3 py-4">
              <p className="text-[11px] text-gray-400">No ad markers yet.</p>
            </div>
          ) : (
            <div className="pb-2">
              {adItems.map((item, idx) => {
                const clip = item.clip
                const ab = abTestClips[clip.id]
                const isSel = selectedClipId === clip.id
                const adDur = item.dur
                if (ab) {
                  const isOpen = !!expanded[clip.id]
                  const accent = 'bg-purple-500'
                  return (
                    <div key={clip.id} {...(idx === 0 ? { 'data-tour': 'marker-row' } : {})} className="group mx-2 my-1 rounded-lg overflow-hidden border border-purple-200 bg-white">
                      <div
                        className={`flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-purple-50 ${isSel ? 'bg-purple-50' : ''}`}
                        onClick={() => onSelectClip(clip.id)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(clip.id) }}
                          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 shrink-0"
                          title={isOpen ? 'Collapse' : 'Expand variants'}
                        >
                          <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className={`shrink-0 w-1 h-8 rounded-full ${accent}`} />
                        <MarkerNumberBadge n={idx + 1} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase px-1 py-px rounded bg-purple-100 text-purple-700">AB</span>
                            <span className="text-xs font-medium text-gray-800 truncate">{ab.groupName}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {formatTimestamp(item.start)} · {ab.variants.length} variants · {formatTimestamp(adDur)}
                          </div>
                        </div>
                        <EditMarkerButton onClick={(e) => { e.stopPropagation(); onEditClip(clip.id) }} />
                        <DeleteMarkerButton onClick={(e) => { e.stopPropagation(); onDeleteClip(clip.id) }} />
                      </div>
                      {isOpen && (
                        <div className="border-t border-purple-100 bg-purple-50/50 px-2 py-1.5 space-y-1">
                          {ab.variants.map(v => (
                            <div key={v.id} className="flex items-center gap-2 px-1 py-1 rounded">
                              <div className="w-6 h-6 shrink-0 rounded-md overflow-hidden border border-purple-200 bg-gray-100">
                                {v.filePath ? (
                                  <video src={v.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />
                                ) : null}
                              </div>
                              <div className="text-[11px] text-gray-700 truncate flex-1">{v.name}</div>
                              {v.id === ab.activeAssetId && (
                                <span className="text-[9px] font-semibold text-purple-600">active</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                const accent = 'bg-orange-500'
                return (
                  <div
                    key={clip.id}
                    {...(idx === 0 ? { 'data-tour': 'marker-row' } : {})}
                    onClick={() => onSelectClip(clip.id)}
                    className={`group mx-2 my-1 rounded-lg border bg-white cursor-pointer hover:bg-orange-50 transition-colors ${isSel ? 'border-orange-300 bg-orange-50' : 'border-orange-200'}`}
                  >
                    <div className="flex items-center gap-2 px-2 py-2">
                      <div className={`shrink-0 w-1 h-8 rounded-full ${accent}`} />
                      <MarkerNumberBadge n={idx + 1} />
                      <div className="w-8 h-8 shrink-0 rounded-md overflow-hidden border border-orange-200 bg-gray-100">
                        {clip.asset?.filePath ? (
                          <video src={clip.asset.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase px-1 py-px rounded bg-orange-100 text-orange-700">Ad</span>
                          <span className="text-xs font-medium text-gray-800 truncate">{clip.asset?.name ?? 'Ad'}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {formatTimestamp(item.start)} · {formatTimestamp(adDur)}
                        </div>
                      </div>
                      <EditMarkerButton onClick={(e) => { e.stopPropagation(); onEditClip(clip.id) }} />
                      <DeleteMarkerButton onClick={(e) => { e.stopPropagation(); onDeleteClip(clip.id) }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* content section */}
        <div data-tour="content-section">
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Content</div>
            <div className="text-[10px] text-gray-400">{contentAssetSummary.length}</div>
          </div>
          {contentAssetSummary.length === 0 ? (
            <div className="px-3 py-4">
              <p className="text-[11px] text-gray-400">
                No content yet. <a href="/assets" className="underline">Upload</a> or drag from assets.
              </p>
            </div>
          ) : (
            <div className="pb-2">
              {contentAssetSummary.map(({ asset, totalDur }) => (
                <div
                  key={asset.id}
                  draggable={!!onContentDragStart}
                  onDragStart={onContentDragStart ? (e) => onContentDragStart(e, asset) : undefined}
                  onDragEnd={onContentDragEnd}
                  className={`px-3 py-1.5 flex items-center gap-2 hover:bg-white transition-colors ${onContentDragStart ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden border border-gray-200 bg-gray-100">
                    {asset.filePath ? (
                      <video src={asset.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{asset.name}</div>
                    <div className="text-[10px] text-gray-400">{formatTimestamp(totalDur)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white p-2">
        <button
          data-tour="create-ad-marker"
          onClick={onOpenCreate}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create ad marker
        </button>
      </div>
    </div>
  )
}

function MarkerNumberBadge({ n }: { n: number }) {
  return (
    <div className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold flex items-center justify-center">
      {n}
    </div>
  )
}

function EditMarkerButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      title="Edit ad marker"
      aria-label="Edit ad marker"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}

function DeleteMarkerButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      title="Delete ad marker"
      aria-label="Delete ad marker"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3" />
      </svg>
    </button>
  )
}
