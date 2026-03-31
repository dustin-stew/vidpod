'use client'

import React, { useCallback, useState } from 'react'
import { formatTimestamp } from '@/lib/utils'
import type { Asset, AssetPanelTab, EpisodeClip, AdSet, AbTestGroup } from '@/types'

export interface AssetPanelProps {
  contentAssets: Asset[]
  adAssets: Asset[]
  initialAdSets: AdSet[]
  initialAbTestGroups: AbTestGroup[]
  clips: EpisodeClip[]
  selectedAdIds: Set<string>
  setSelectedAdIds: React.Dispatch<React.SetStateAction<Set<string>>>
  autoInserting: boolean
  onAutoInsert: (ids: string[]) => void
  onAutoInsertGroup: (assetIds: string[], mode: 'spread' | 'single', displayName?: string, groupInfo?: { id: string; name: string }) => void
  onAssetDuration: (assetId: string, dur: number) => void
  onPanelDragStart: (e: React.DragEvent, asset: Asset) => void
  onPanelDragEnd: () => void
  assetTab: AssetPanelTab
  setAssetTab: React.Dispatch<React.SetStateAction<AssetPanelTab>>
}

export function AssetPanel({
  contentAssets,
  adAssets,
  initialAdSets,
  initialAbTestGroups,
  clips,
  selectedAdIds,
  setSelectedAdIds,
  autoInserting,
  onAutoInsert,
  onAutoInsertGroup,
  onAssetDuration,
  onPanelDragStart,
  onPanelDragEnd,
  assetTab,
  setAssetTab,
}: AssetPanelProps) {
  const panelAssets = assetTab === 'content' ? contentAssets : assetTab === 'ad' ? adAssets : []

  // ad sets
  const [adSets, setAdSets] = useState<AdSet[]>(initialAdSets)
  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null)
  const [creatingAdSet, setCreatingAdSet] = useState(false)
  const [adSetName, setAdSetName] = useState('')

  // ab test groups
  const [abTestGroups, setAbTestGroups] = useState<AbTestGroup[]>(initialAbTestGroups)
  const [selectedAbTestGroupId, setSelectedAbTestGroupId] = useState<string | null>(null)
  const [creatingAbTestGroup, setCreatingAbTestGroup] = useState<string | null>(null)
  const [abTestGroupName, setAbTestGroupName] = useState('')

  const refreshAdSets = useCallback(async () => {
    const res = await fetch('/api/ad-sets')
    if (res.ok) setAdSets(await res.json())
  }, [])

  const refreshAbTestGroups = useCallback(async () => {
    const res = await fetch('/api/ab-test-groups')
    if (res.ok) setAbTestGroups(await res.json())
  }, [])

  const handleAutoInsert = useCallback(() => {
    const ids = Array.from(selectedAdIds)
    if (ids.length === 0) return
    onAutoInsert(ids)
  }, [selectedAdIds, onAutoInsert])

  const doAutoInsert = useCallback((assetIds: string[], mode: 'spread' | 'single', displayName?: string, groupInfo?: { id: string; name: string }) => {
    onAutoInsertGroup(assetIds, mode, displayName, groupInfo)
  }, [onAutoInsertGroup])

  return (
    <div className="relative flex flex-col border-r border-gray-100 bg-gray-50 overflow-hidden" style={{ width: '40%' }}>
      <div className="h-10 shrink-0 flex items-center gap-1 px-2 border-b border-gray-100 bg-white overflow-x-auto">
        <TabPill data-tour="tab-content" active={assetTab === 'content'} onClick={() => { setAssetTab('content'); setSelectedAdIds(new Set()); setSelectedAdSetId(null); setSelectedAbTestGroupId(null) }}>Content</TabPill>
        <TabPill data-tour="tab-ad" active={assetTab === 'ad'} onClick={() => { setAssetTab('ad'); setSelectedAdSetId(null); setSelectedAbTestGroupId(null) }} accent>Ads</TabPill>
        <TabPill data-tour="tab-ad_set" active={assetTab === 'ad_set'} onClick={() => { setAssetTab('ad_set'); setSelectedAdIds(new Set()); setSelectedAbTestGroupId(null); refreshAdSets() }}>Ad Sets</TabPill>
        <TabPill data-tour="tab-ab_test" active={assetTab === 'ab_test'} onClick={() => { setAssetTab('ab_test'); setSelectedAdIds(new Set()); setSelectedAdSetId(null); refreshAbTestGroups() }}>AB Test Groups</TabPill>
      </div>

      {/* content/ads tab */}
      {(assetTab === 'content' || assetTab === 'ad') && (
        panelAssets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-400">No clips. <a href="/assets" className="underline">Upload in Assets</a></p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2.5 content-start">
            {panelAssets.map((asset) => {
              const isSelected = assetTab === 'ad' && selectedAdIds.has(asset.id)
              return (
                <React.Fragment key={asset.id}>
                  <AssetIcon
                    asset={asset}
                    selected={isSelected}
                    onClick={assetTab === 'ad' ? () => setSelectedAdIds(prev => {
                      const next = new Set(prev)
                      if (next.has(asset.id)) next.delete(asset.id); else next.add(asset.id)
                      return next
                    }) : undefined}
                    onDragStart={(e) => onPanelDragStart(e, asset)}
                    onDragEnd={onPanelDragEnd}
                    onDuration={(dur) => onAssetDuration(asset.id, dur)}
                  />
                </React.Fragment>
              )
            })}
          </div>
        )
      )}

      {/* ad actions */}
      {assetTab === 'ad' && selectedAdIds.size > 0 && (
        <div className="shrink-0 border-t border-gray-200 bg-white p-2 flex flex-col gap-1.5">
          {/* auto insert */}
          {clips.some(c => c.clipType === 'content') ? (
          <button
            onClick={handleAutoInsert}
            disabled={autoInserting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {autoInserting ? (
              <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Analyzing…</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Insert automatically ({selectedAdIds.size})</>
            )}
          </button>
          ) : (
            <p className="text-[10px] text-gray-400 text-center py-1">Add content to the timeline to enable auto-insert and drag & drop</p>
          )}
          {/* create ad set */}
          {selectedAdIds.size >= 2 && (
            <>
              {creatingAdSet ? (
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  if (!adSetName.trim()) return
                  await fetch('/api/ad-sets', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: adSetName.trim(), assetIds: Array.from(selectedAdIds) }),
                  })
                  await refreshAdSets()
                  setSelectedAdIds(new Set())
                  setCreatingAdSet(false)
                  setAdSetName('')
                }} className="flex gap-1.5">
                  <input
                    autoFocus
                    value={adSetName}
                    onChange={(e) => setAdSetName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingAdSet(false); setAdSetName('') } }}
                    placeholder="Ad set name…"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-blue-400"
                  />
                  <button type="submit" disabled={!adSetName.trim()} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">Create</button>
                  <button type="button" onClick={() => { setCreatingAdSet(false); setAdSetName('') }} className="px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">✕</button>
                </form>
              ) : (
              <button
                onClick={() => setCreatingAdSet(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create ad set ({selectedAdIds.size})
              </button>
              )}
              {adSets.length > 0 && (
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 bg-white"
                  defaultValue=""
                  onChange={async (e) => {
                    const groupId = e.target.value
                    if (!groupId) return
                    await fetch(`/api/ad-sets/${groupId}`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ addAssetIds: Array.from(selectedAdIds) }),
                    })
                    await refreshAdSets()
                    setSelectedAdIds(new Set())
                    e.target.value = ''
                  }}
                >
                  <option value="" disabled>Add to existing group…</option>
                  {adSets.map(g => <option key={g.id} value={g.id}>{g.name} ({g.assets.length})</option>)}
                </select>
              )}
            </>
          )}
        </div>
      )}

      {/* ad sets tab */}
      {assetTab === 'ad_set' && (
        adSets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-400">No ad sets yet. Select 2+ ads to create one.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {adSets.map((group) => {
              const isSel = selectedAdSetId === group.id
              return (
                <div key={group.id}>
                  <button
                    onClick={() => setSelectedAdSetId(prev => prev === group.id ? null : group.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 hover:bg-white transition-colors ${isSel ? 'bg-blue-50' : ''}`}
                  >
                    <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold">{group.assets.length}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{group.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{group.assets.map(a => a.name).join(', ')}</div>
                    </div>
                    <button onClick={async (e) => { e.stopPropagation(); await fetch(`/api/ad-sets/${group.id}`, { method: 'DELETE' }); await refreshAdSets(); if (selectedAdSetId === group.id) setSelectedAdSetId(null) }} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </button>
                  {isSel && (
                    <div className="p-2 bg-blue-50 border-b border-gray-100 flex flex-col gap-1.5">
                      {clips.some(c => c.clipType === 'content') ? (<>
                      <button
                        onClick={() => doAutoInsert(group.assets.map(a => a.id), 'spread')}
                        disabled={autoInserting}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
                      >
                        {autoInserting ? 'Analyzing…' : 'Automated placement'}
                      </button>
                      <button
                        onClick={() => doAutoInsert(group.assets.map(a => a.id), 'single', group.name)}
                        disabled={autoInserting}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 disabled:opacity-60 transition-colors"
                      >
                        {autoInserting ? 'Analyzing…' : 'Quick AB test'}
                      </button>
                      </>) : (
                        <p className="text-[10px] text-gray-400 text-center py-1">Add content to the timeline to enable placement and AB testing</p>
                      )}
                      {creatingAbTestGroup === group.id ? (
                        <form onSubmit={async (e) => {
                          e.preventDefault()
                          if (!abTestGroupName.trim()) return
                          await fetch('/api/ab-test-groups', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: abTestGroupName.trim(), adSetIds: [group.id] }),
                          })
                          await refreshAbTestGroups()
                          setCreatingAbTestGroup(null)
                          setAbTestGroupName('')
                        }} className="flex gap-1.5">
                          <input
                            autoFocus
                            value={abTestGroupName}
                            onChange={(e) => setAbTestGroupName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingAbTestGroup(null); setAbTestGroupName('') } }}
                            placeholder="AB test group name…"
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-indigo-400"
                          />
                          <button type="submit" disabled={!abTestGroupName.trim()} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 disabled:opacity-40 transition-colors">Create</button>
                          <button type="button" onClick={() => { setCreatingAbTestGroup(null); setAbTestGroupName('') }} className="px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">✕</button>
                        </form>
                      ) : (
                      <button
                        onClick={() => { setCreatingAbTestGroup(group.id); setAbTestGroupName('') }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors"
                      >
                        Create AB test group
                      </button>
                      )}
                      {abTestGroups.length > 0 && (
                        <select
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 bg-white"
                          defaultValue=""
                          onChange={async (e) => {
                            const setId = e.target.value
                            if (!setId) return
                            await fetch(`/api/ab-test-groups/${setId}`, {
                              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ addAdSetIds: [group.id] }),
                            })
                            await refreshAbTestGroups()
                            e.target.value = ''
                          }}
                        >
                          <option value="" disabled>Add to existing AB test group…</option>
                          {abTestGroups.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adSets.length} sets)</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ab test groups tab */}
      {assetTab === 'ab_test' && (
        abTestGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-400 text-center px-4">No AB test groups yet. Create one from the Ad Sets tab.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {abTestGroups.map((testSet) => {
              const isSel = selectedAbTestGroupId === testSet.id
              const allAssetIds = testSet.adSets.flatMap(g => g.assets.map(a => a.id))
              return (
                <div key={testSet.id}>
                  <button
                    onClick={() => setSelectedAbTestGroupId(prev => prev === testSet.id ? null : testSet.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 hover:bg-white transition-colors ${isSel ? 'bg-purple-50' : ''}`}
                  >
                    <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600 text-[10px] font-bold">{testSet.adSets.length}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{testSet.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{testSet.adSets.map(g => g.name).join(', ')}</div>
                    </div>
                    <button onClick={async (e) => { e.stopPropagation(); await fetch(`/api/ab-test-groups/${testSet.id}`, { method: 'DELETE' }); await refreshAbTestGroups(); if (selectedAbTestGroupId === testSet.id) setSelectedAbTestGroupId(null) }} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </button>
                  {isSel && (
                    <div className="p-2 bg-purple-50 border-b border-gray-100 flex flex-col gap-1.5">
                      {clips.some(c => c.clipType === 'content') && (
                      <button
                        onClick={() => doAutoInsert(allAssetIds, 'single', testSet.name, { id: testSet.id, name: testSet.name })}
                        disabled={autoInserting}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
                      >
                        {autoInserting ? 'Analyzing…' : `Auto placement (${allAssetIds.length} ads)`}
                      </button>
                      )}
                      <p className="text-[10px] text-gray-500 text-center">
                        {clips.some(c => c.clipType === 'content') ? 'Or drag & drop individual groups onto the timeline' : 'Add content to the timeline first, or drag & drop groups'}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

    </div>
  )
}

function AssetIcon({ asset, selected, onClick, onDragStart, onDragEnd, onDuration }: {
  asset: Asset
  selected?: boolean
  onClick?: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDuration?: (dur: number) => void
}) {
  const isAd = asset.contentType === 'ad'
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`flex flex-col cursor-grab active:cursor-grabbing select-none group ${onClick ? 'cursor-pointer' : ''}`}
      title={asset.name}
    >
      <div className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
        selected
          ? 'border-orange-500 ring-2 ring-orange-300'
          : isAd ? 'border-orange-200 group-hover:border-orange-400' : 'border-gray-200 group-hover:border-blue-400'
      }`}>
        <video
          src={asset.filePath}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={(e) => onDuration?.((e.target as HTMLVideoElement).duration)}
        />
        {isAd && (
          <span className="absolute bottom-1 left-1 text-[8px] font-bold px-1 py-px rounded bg-orange-500 text-white uppercase">
            Ad
          </span>
        )}
      </div>
      <p className="text-[10px] text-gray-600 truncate mt-1 text-center leading-tight">{asset.name}</p>
      {asset.duration > 0 && (
        <p className="text-[9px] text-gray-400 text-center">{formatTimestamp(asset.duration)}</p>
      )}
    </div>
  )
}

function TabPill({ active, onClick, accent, children, 'data-tour': dataTour }: {
  active: boolean; onClick: () => void; accent?: boolean; children: React.ReactNode; 'data-tour'?: string
}) {
  return (
    <button
      onClick={onClick}
      data-tour={dataTour}
      className={`px-3 py-1 text-[clamp(0.875rem,0.75vw,1.125rem)] font-medium rounded-full transition-colors ${
        active
          ? accent ? 'bg-orange-100 text-orange-700' : 'bg-gray-900 text-white'
          : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}
