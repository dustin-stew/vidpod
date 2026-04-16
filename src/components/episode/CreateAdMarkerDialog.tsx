'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { formatTimestamp } from '@/lib/utils'
import type { Asset, AdSet, AbTestGroup, EpisodeClip } from '@/types'

export interface CreateAdMarkerDialogProps {
  onClose: () => void
  adAssets: Asset[]
  initialAdSets: AdSet[]
  initialAbTestGroups: AbTestGroup[]
  initialAdFolders: string[]
  clips: EpisodeClip[]
  currentTime: number
  hasValidInsertPoint: boolean
  autoInserting: boolean
  onInsertAd: (asset: Asset) => void | Promise<void>
  onInsertAbTestGroup: (group: AbTestGroup) => void | Promise<void>
  onAutoInsertAds: (assetIds: string[]) => void
  onAutoInsertAdSet: (group: AdSet) => void
  onAutoInsertAbTestGroup: (group: AbTestGroup) => void
  onQuickAbTest: (prefix: string, assetIds: string[]) => Promise<void>
  onAssetDuration: (assetId: string, dur: number) => void
  editing?: boolean
  editingTime?: number | null
}

type Mode = 'browse' | 'create-ad-set' | 'create-ab-group' | 'quick-ab-test'

const ALL_FOLDERS = '__all__'
const UNFOLDERED = '__none__'

export function CreateAdMarkerDialog(props: CreateAdMarkerDialogProps) {
  const {
    onClose, adAssets, initialAdSets, initialAbTestGroups, initialAdFolders,
    clips, currentTime, hasValidInsertPoint, autoInserting,
    onInsertAd, onInsertAbTestGroup, onAutoInsertAds, onAutoInsertAdSet, onAutoInsertAbTestGroup,
    onQuickAbTest, onAssetDuration, editing, editingTime,
  } = props

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('browse')
  const [adSets, setAdSets] = useState<AdSet[]>(initialAdSets)
  const [abTestGroups, setAbTestGroups] = useState<AbTestGroup[]>(initialAbTestGroups)
  const [folders] = useState<string[]>(initialAdFolders)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ [ALL_FOLDERS]: true })
  const [openSections, setOpenSections] = useState<Record<string, { ads: boolean; adSets: boolean; abTests: boolean }>>({})
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())

  // create-set form
  const [adSetName, setAdSetName] = useState('')
  const [adSetSelection, setAdSetSelection] = useState<Set<string>>(new Set())

  // create-ab form
  const [abGroupName, setAbGroupName] = useState('')
  const [abGroupAdSetSelection, setAbGroupAdSetSelection] = useState<Set<string>>(new Set())

  // quick-ab form
  const [quickAbPrefix, setQuickAbPrefix] = useState('')
  const [quickAbSubmitting, setQuickAbSubmitting] = useState(false)

  const refreshAdSets = useCallback(async () => {
    const r = await fetch('/api/ad-sets')
    if (r.ok) setAdSets(await r.json())
  }, [])
  const refreshAbTestGroups = useCallback(async () => {
    const r = await fetch('/api/ab-test-groups')
    if (r.ok) setAbTestGroups(await r.json())
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const q = query.trim().toLowerCase()

  // folder-keyed buckets
  const buckets = useMemo(() => {
    // ads grouped by folder
    const adsByFolder = new Map<string, Asset[]>()
    adsByFolder.set(ALL_FOLDERS, adAssets)
    adsByFolder.set(UNFOLDERED, adAssets.filter(a => !a.folder))
    for (const f of folders) adsByFolder.set(f, adAssets.filter(a => a.folder === f))

    const folderKeyForAsset = (a: Asset) => a.folder ?? UNFOLDERED
    const allAssetFolders = (assets: Asset[]) => new Set(assets.map(folderKeyForAsset))

    // ad sets grouped by the folders their assets span (a set goes into a folder if ALL its assets belong to it)
    const setsByFolder = new Map<string, AdSet[]>()
    setsByFolder.set(ALL_FOLDERS, adSets)
    setsByFolder.set(UNFOLDERED, [])
    for (const f of folders) setsByFolder.set(f, [])
    for (const s of adSets) {
      const fset = allAssetFolders(s.assets)
      if (fset.size === 1) {
        const key = fset.values().next().value as string
        if (setsByFolder.has(key)) setsByFolder.get(key)!.push(s)
      } else {
        setsByFolder.get(UNFOLDERED)!.push(s)
      }
    }

    // ab groups by the folders their ad sets' assets span
    const abByFolder = new Map<string, AbTestGroup[]>()
    abByFolder.set(ALL_FOLDERS, abTestGroups)
    abByFolder.set(UNFOLDERED, [])
    for (const f of folders) abByFolder.set(f, [])
    for (const g of abTestGroups) {
      const allAssets = g.adSets.flatMap(s => s.assets)
      const fset = allAssetFolders(allAssets)
      if (fset.size === 1) {
        const key = fset.values().next().value as string
        if (abByFolder.has(key)) abByFolder.get(key)!.push(g)
      } else {
        abByFolder.get(UNFOLDERED)!.push(g)
      }
    }

    return { adsByFolder, setsByFolder, abByFolder }
  }, [adAssets, adSets, abTestGroups, folders])

  const matches = useCallback((text: string) => !q || text.toLowerCase().includes(q), [q])

  const filteredAds = useCallback((assets: Asset[]) => {
    if (!q) return assets
    return assets.filter(a => matches(a.name))
  }, [q, matches])
  const filteredSets = useCallback((sets: AdSet[]) => {
    if (!q) return sets
    return sets.filter(s => matches(s.name) || s.assets.some(a => matches(a.name)))
  }, [q, matches])
  const filteredAbs = useCallback((gs: AbTestGroup[]) => {
    if (!q) return gs
    return gs.filter(g => matches(g.name) || g.adSets.some(s => matches(s.name) || s.assets.some(a => matches(a.name))))
  }, [q, matches])

  const hasContent = clips.some(c => c.clipType === 'content')

  const toggleFolder = (key: string) => setOpenFolders(p => ({ ...p, [key]: !p[key] }))
  const toggleSection = (folder: string, sect: 'ads' | 'adSets' | 'abTests') =>
    setOpenSections(prev => {
      const cur = prev[folder] ?? { ads: true, adSets: true, abTests: true }
      return { ...prev, [folder]: { ...cur, [sect]: !cur[sect] } }
    })
  const sectionsOpen = (folder: string) => openSections[folder] ?? { ads: true, adSets: true, abTests: true }

  // ----- create-ad-set sub-view -----
  if (mode === 'create-ad-set') {
    return (
      <PanelShell onClose={onClose} currentTime={editing && editingTime != null ? editingTime : currentTime} hasValidInsertPoint={hasValidInsertPoint} editing={!!editing}>
        <SubHeader title="New ad set" onBack={() => { setMode('browse'); setAdSetName(''); setAdSetSelection(new Set()) }} />
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!adSetName.trim() || adSetSelection.size < 2) return
            await fetch('/api/ad-sets', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: adSetName.trim(), assetIds: Array.from(adSetSelection) }),
            })
            await refreshAdSets()
            setMode('browse'); setAdSetName(''); setAdSetSelection(new Set()); setSelectedAssetIds(new Set())
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="px-3 pt-2 pb-2">
            <input
              autoFocus
              value={adSetName}
              onChange={(e) => setAdSetName(e.target.value)}
              placeholder="Ad set name…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 grid grid-cols-3 gap-2 content-start">
            {adAssets.map(a => {
              const checked = adSetSelection.has(a.id)
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAdSetSelection(prev => {
                    const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n
                  })}
                  className={`relative rounded-md border-2 overflow-hidden aspect-video bg-white text-left transition-colors ${checked ? 'border-blue-500' : 'border-transparent hover:border-gray-300'}`}
                >
                  <video src={a.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />
                  <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[9px] text-white bg-black/60 px-1 py-px rounded truncate">{a.name}</span>
                  {checked && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">✓</span>}
                </button>
              )
            })}
          </div>
          <div className="shrink-0 border-t border-gray-100 p-2 flex gap-1.5">
            <button type="submit" disabled={!adSetName.trim() || adSetSelection.size < 2} className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">Create ({adSetSelection.size})</button>
            <button type="button" onClick={() => { setMode('browse'); setAdSetName(''); setAdSetSelection(new Set()) }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </form>
      </PanelShell>
    )
  }

  // ----- create-ab-group sub-view -----
  if (mode === 'create-ab-group') {
    return (
      <PanelShell onClose={onClose} currentTime={editing && editingTime != null ? editingTime : currentTime} hasValidInsertPoint={hasValidInsertPoint} editing={!!editing}>
        <SubHeader title="New AB test group" onBack={() => { setMode('browse'); setAbGroupName(''); setAbGroupAdSetSelection(new Set()) }} />
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!abGroupName.trim() || abGroupAdSetSelection.size < 1) return
            await fetch('/api/ab-test-groups', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: abGroupName.trim(), adSetIds: Array.from(abGroupAdSetSelection) }),
            })
            await refreshAbTestGroups()
            setMode('browse'); setAbGroupName(''); setAbGroupAdSetSelection(new Set())
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="px-3 pt-2 pb-2">
            <input
              autoFocus
              value={abGroupName}
              onChange={(e) => setAbGroupName(e.target.value)}
              placeholder="AB test group name…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-1">
            {adSets.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-4">Create ad sets first to build AB test groups.</p>
            ) : (
              adSets.map(group => {
                const checked = abGroupAdSetSelection.has(group.id)
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => setAbGroupAdSetSelection(prev => {
                      const n = new Set(prev); if (n.has(group.id)) n.delete(group.id); else n.add(group.id); return n
                    })}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${checked ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${checked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>{checked ? '✓' : ''}</span>
                    <span className="text-xs font-medium text-gray-800 truncate flex-1">{group.name}</span>
                    <span className="text-[10px] text-gray-400">{group.assets.length} ads</span>
                  </button>
                )
              })
            )}
          </div>
          <div className="shrink-0 border-t border-gray-100 p-2 flex gap-1.5">
            <button type="submit" disabled={!abGroupName.trim() || abGroupAdSetSelection.size < 1} className="flex-1 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 disabled:opacity-40 transition-colors">Create</button>
            <button type="button" onClick={() => { setMode('browse'); setAbGroupName(''); setAbGroupAdSetSelection(new Set()) }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </form>
      </PanelShell>
    )
  }

  // ----- quick-ab sub-view -----
  if (mode === 'quick-ab-test') {
    return (
      <PanelShell onClose={onClose} currentTime={editing && editingTime != null ? editingTime : currentTime} hasValidInsertPoint={hasValidInsertPoint} editing={!!editing}>
        <SubHeader title="Quick AB test" onBack={() => { setMode('browse'); setQuickAbPrefix('') }} />
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!quickAbPrefix.trim() || selectedAssetIds.size < 2 || quickAbSubmitting) return
            setQuickAbSubmitting(true)
            try {
              await onQuickAbTest(quickAbPrefix.trim(), Array.from(selectedAssetIds))
              await refreshAdSets()
              await refreshAbTestGroups()
              setSelectedAssetIds(new Set()); setQuickAbPrefix(''); setMode('browse')
            } finally {
              setQuickAbSubmitting(false)
            }
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="px-3 pt-2 pb-2 space-y-2">
            <p className="text-[11px] text-gray-500">Creates an ad set and AB test group named after your prefix, then places a single AB slot on the timeline.</p>
            <input
              autoFocus
              value={quickAbPrefix}
              onChange={(e) => setQuickAbPrefix(e.target.value)}
              placeholder="Prefix (e.g. Eight Sleep Q3)…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:border-purple-400"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">{selectedAssetIds.size} selected</div>
            {adAssets.filter(a => selectedAssetIds.has(a.id)).map(a => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1 rounded">
                <div className="w-8 h-6 shrink-0 rounded overflow-hidden border border-gray-200 bg-gray-100">
                  {a.filePath && <video src={a.filePath} className="w-full h-full object-cover" preload="metadata" muted playsInline />}
                </div>
                <div className="text-[11px] text-gray-700 truncate flex-1">{a.name}</div>
                {a.folder && <span className="text-[9px] text-orange-600 bg-orange-50 px-1 rounded">{a.folder}</span>}
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-gray-100 p-2 flex gap-1.5">
            <button
              type="submit"
              disabled={!quickAbPrefix.trim() || selectedAssetIds.size < 2 || quickAbSubmitting || !hasContent}
              className="flex-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {quickAbSubmitting ? 'Creating…' : `Create & place (${selectedAssetIds.size})`}
            </button>
            <button type="button" onClick={() => { setMode('browse'); setQuickAbPrefix('') }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </form>
      </PanelShell>
    )
  }

  // ----- browse (default) -----
  const folderKeys: string[] = [ALL_FOLDERS, ...folders]

  return (
    <PanelShell onClose={onClose} currentTime={editing && editingTime != null ? editingTime : currentTime} hasValidInsertPoint={hasValidInsertPoint} editing={!!editing}>
      {/* search */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-100">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ads, ad sets, AB groups…"
            className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-gray-400 bg-white"
          />
        </div>
      </div>

      <div className="shrink-0 px-3 pt-2 pb-1 border-b border-gray-100 bg-white flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        <div className="text-[11px] font-semibold text-gray-700">Ad library</div>
      </div>

      {/* tree */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {folderKeys.map(key => {
          const isAll = key === ALL_FOLDERS
          const isNone = key === UNFOLDERED
          const label = isAll ? 'Redmen TV' : key
          const ads = filteredAds(buckets.adsByFolder.get(key) ?? [])
          const sets = filteredSets(buckets.setsByFolder.get(key) ?? [])
          const abs = filteredAbs(buckets.abByFolder.get(key) ?? [])
          const total = ads.length + sets.length + abs.length
          // auto-hide empty non-All folders when searching
          if (q && !isAll && total === 0) return null
          const open = !!openFolders[key]
          const sect = sectionsOpen(key)
          return (
            <div key={key} className="mb-0.5">
              <button
                onClick={() => toggleFolder(key)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-white transition-colors"
              >
                <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <svg className={`w-3.5 h-3.5 ${isAll ? 'text-gray-500' : isNone ? 'text-gray-400' : 'text-orange-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className={`text-[12px] font-semibold ${isAll ? 'text-gray-900' : 'text-gray-800'} truncate`}>{label}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{total}</span>
              </button>
              {open && (
                <div className="pl-4 pb-1">
                  <Section
                    label="Ads"
                    count={ads.length}
                    open={sect.ads}
                    accent="orange"
                    emptyLabel={q ? 'No matches' : 'No ads'}
                    onToggle={() => toggleSection(key, 'ads')}
                  >
                    {ads.map(a => (
                      <AdLeaf
                        key={a.id}
                        asset={a}
                        selected={selectedAssetIds.has(a.id)}
                        anySelected={selectedAssetIds.size > 0}
                        disabled={!hasValidInsertPoint && selectedAssetIds.size === 0}
                        onClick={async () => {
                          if (selectedAssetIds.size > 0) {
                            setSelectedAssetIds(prev => {
                              const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n
                            })
                            return
                          }
                          if (!hasValidInsertPoint) return
                          await onInsertAd(a)
                          onClose()
                        }}
                        onToggleSelect={() => setSelectedAssetIds(prev => {
                          const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n
                        })}
                        onDuration={(d) => onAssetDuration(a.id, d)}
                      />
                    ))}
                  </Section>
                  <Section
                    label="Ad Sets"
                    count={sets.length}
                    open={sect.adSets}
                    accent="blue"
                    emptyLabel={q ? 'No matches' : 'No ad sets'}
                    onToggle={() => toggleSection(key, 'adSets')}
                  >
                    {sets.map(group => (
                      <AdSetLeaf
                        key={group.id}
                        group={group}
                        expanded={expandedItemId === group.id}
                        onToggleExpand={() => setExpandedItemId(prev => prev === group.id ? null : group.id)}
                        disabled={!hasContent || autoInserting}
                        autoInserting={autoInserting}
                        onAutoPlace={() => { onAutoInsertAdSet(group); onClose() }}
                        onDelete={async () => { await fetch(`/api/ad-sets/${group.id}`, { method: 'DELETE' }); await refreshAdSets() }}
                      />
                    ))}
                    {isAll && <CreateLeafButton accent="blue" label="New ad set" onClick={() => setMode('create-ad-set')} />}
                  </Section>
                  <Section
                    label="AB Test Groups"
                    count={abs.length}
                    open={sect.abTests}
                    accent="purple"
                    emptyLabel={q ? 'No matches' : 'No AB test groups'}
                    onToggle={() => toggleSection(key, 'abTests')}
                  >
                    {abs.map(group => (
                      <AbTestLeaf
                        key={group.id}
                        group={group}
                        expanded={expandedItemId === group.id}
                        onToggleExpand={() => setExpandedItemId(prev => prev === group.id ? null : group.id)}
                        hasValidInsertPoint={hasValidInsertPoint}
                        hasContent={hasContent}
                        autoInserting={autoInserting}
                        onInsertAtPlayhead={async () => { await onInsertAbTestGroup(group); onClose() }}
                        onAutoPlace={() => { onAutoInsertAbTestGroup(group); onClose() }}
                        onDelete={async () => { await fetch(`/api/ab-test-groups/${group.id}`, { method: 'DELETE' }); await refreshAbTestGroups() }}
                      />
                    ))}
                    {isAll && <CreateLeafButton accent="purple" label="New AB test group" onClick={() => setMode('create-ab-group')} />}
                  </Section>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!editing && selectedAssetIds.size > 0 && (
        <div className="shrink-0 border-t border-gray-200 bg-white p-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-700">{selectedAssetIds.size} ad{selectedAssetIds.size !== 1 ? 's' : ''} selected</span>
            <button onClick={() => setSelectedAssetIds(new Set())} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Clear</button>
          </div>
          <div className="flex flex-wrap items-stretch gap-1.5">
            <ActionBarButton
              onClick={() => { onAutoInsertAds(Array.from(selectedAssetIds)); setSelectedAssetIds(new Set()); onClose() }}
              disabled={!hasContent || autoInserting}
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              label={autoInserting ? 'Analyzing…' : `Auto-insert ${selectedAssetIds.size} ad${selectedAssetIds.size === 1 ? '' : 's'}`}
            />
            {selectedAssetIds.size >= 2 && (
              <>
                <ActionBarButton
                  onClick={() => { setAdSetSelection(new Set(selectedAssetIds)); setMode('create-ad-set') }}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>}
                  label={`Save as ad set (${selectedAssetIds.size})`}
                />
                <ActionBarButton
                  onClick={() => setMode('quick-ab-test')}
                  disabled={!hasContent}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-8 5h8M4 7h.01M4 12h.01M4 17h.01" /></svg>}
                  label={`Quick AB test (${selectedAssetIds.size})`}
                />
              </>
            )}
          </div>
        </div>
      )}
    </PanelShell>
  )
}

// ---- layout helpers ----

function ActionBarButton({ onClick, disabled, icon, label }: {
  onClick: () => void
  disabled?: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-[11px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-gray-200 transition-colors shadow-sm"
    >
      <span className="text-gray-500 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function PanelShell({
  children, onClose, currentTime, hasValidInsertPoint, editing,
}: {
  children: React.ReactNode; onClose: () => void; currentTime: number; hasValidInsertPoint: boolean; editing?: boolean
}) {
  return (
    <div className="relative flex flex-col bg-gray-50 overflow-hidden w-full h-full">
      <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-gray-100 bg-white">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-gray-900 truncate">{editing ? 'Edit ad marker' : 'Create ad marker'}</div>
          <div className="text-[10px] text-gray-400 truncate">
            {editing
              ? <>Pick a new ad or AB group to replace at <span className="font-medium text-gray-600">{formatTimestamp(currentTime)}</span></>
              : hasValidInsertPoint
              ? <>Insert at <span className="font-medium text-gray-600">{formatTimestamp(currentTime)}</span> — drag playhead to change</>
              : <>Move the playhead onto content to enable insert</>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Close"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {children}
    </div>
  )
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="shrink-0 h-8 flex items-center gap-1.5 px-2 border-b border-gray-100 bg-white">
      <button
        onClick={onBack}
        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        title="Back"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <div className="text-xs font-semibold text-gray-800 truncate">{title}</div>
    </div>
  )
}

function Section({
  label, count, open, onToggle, accent, emptyLabel, children,
}: {
  label: string; count: number; open: boolean; onToggle: () => void
  accent: 'orange' | 'blue' | 'purple'
  emptyLabel: string
  children: React.ReactNode
}) {
  const dot = accent === 'orange' ? 'bg-orange-400' : accent === 'blue' ? 'bg-blue-400' : 'bg-purple-400'
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 pl-2 pr-2 py-1 text-left hover:bg-white transition-colors"
      >
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{count}</span>
      </button>
      {open && (
        <div className="pl-4 pb-1">
          {count === 0 && <p className="pl-4 pr-3 py-1 text-[10px] text-gray-400">{emptyLabel}</p>}
          {children}
        </div>
      )}
    </div>
  )
}

function CreateLeafButton({ accent, label, onClick }: {
  accent: 'blue' | 'purple'; label: string; onClick: () => void
}) {
  const cls = accent === 'purple'
    ? 'text-indigo-600 hover:bg-indigo-50 border-indigo-200'
    : 'text-blue-600 hover:bg-blue-50 border-blue-200'
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] font-medium border border-dashed transition-colors ${cls}`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      {label}
    </button>
  )
}

function AdLeaf({ asset, selected, anySelected, disabled, onClick, onToggleSelect, onDuration }: {
  asset: Asset; selected: boolean; anySelected: boolean; disabled?: boolean
  onClick: () => void; onToggleSelect: () => void; onDuration?: (d: number) => void
}) {
  return (
    <div
      className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
        selected ? 'bg-blue-50' : 'hover:bg-white'
      } ${disabled && !selected && !anySelected ? 'opacity-50' : ''}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white opacity-50 group-hover:opacity-100'
        }`}
        title={selected ? 'Deselect' : 'Select'}
      >
        {selected && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </button>
      <button
        onClick={onClick}
        disabled={disabled && !anySelected}
        className={`flex-1 flex items-center gap-2 min-w-0 text-left ${disabled && !anySelected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        title={anySelected ? 'Toggle select' : disabled ? 'Move playhead onto content to enable' : `Insert "${asset.name}" at playhead`}
      >
        <div className="w-10 h-8 shrink-0 rounded overflow-hidden border border-orange-200 bg-gray-100">
          <video
            src={asset.filePath}
            className="w-full h-full object-cover pointer-events-none"
            preload="metadata"
            muted
            playsInline
            onLoadedMetadata={(e) => onDuration?.((e.target as HTMLVideoElement).duration)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-800 truncate">{asset.name}</div>
          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            {asset.duration > 0 && <span>{formatTimestamp(asset.duration)}</span>}
            {asset.folder && <><span>·</span><span className="text-orange-600 truncate">{asset.folder}</span></>}
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase px-1 py-px rounded bg-orange-100 text-orange-700 shrink-0">Ad</span>
      </button>
    </div>
  )
}

function AdSetLeaf({
  group, expanded, onToggleExpand, disabled, autoInserting, onAutoPlace, onDelete,
}: {
  group: AdSet; expanded: boolean; onToggleExpand: () => void; disabled?: boolean
  autoInserting: boolean; onAutoPlace: () => void; onDelete: () => void
}) {
  return (
    <div className="border-l-2 border-blue-100 pl-1 my-0.5">
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white transition-colors"
        >
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <StackedThumb assets={group.assets} accent="blue" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">{group.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{group.assets.length} ads</div>
          </div>
        </button>
      </div>
      {expanded && (
        <div className="ml-5 my-1 space-y-1">
          {group.assets.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 px-2 py-1">
              <div className="w-6 h-5 shrink-0 rounded overflow-hidden border border-blue-200 bg-gray-100">
                {a.filePath && <video src={a.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />}
              </div>
              <div className="text-[10px] text-gray-600 truncate flex-1">{a.name}</div>
            </div>
          ))}
          <div className="flex gap-1 pt-1">
            <button
              onClick={onAutoPlace}
              disabled={disabled}
              className="flex-1 px-2 py-1 rounded bg-orange-500 text-white text-[10px] font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {autoInserting ? 'Analyzing…' : 'Automated placement'}
            </button>
            <button
              onClick={onDelete}
              className="px-1.5 py-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete ad set"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AbTestLeaf({
  group, expanded, onToggleExpand, hasValidInsertPoint, hasContent, autoInserting,
  onInsertAtPlayhead, onAutoPlace, onDelete,
}: {
  group: AbTestGroup; expanded: boolean; onToggleExpand: () => void
  hasValidInsertPoint: boolean; hasContent: boolean; autoInserting: boolean
  onInsertAtPlayhead: () => void; onAutoPlace: () => void; onDelete: () => void
}) {
  const allAssets = group.adSets.flatMap(g => g.assets)
  return (
    <div className="border-l-2 border-purple-100 pl-1 my-0.5">
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white transition-colors"
        >
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <StackedThumb assets={allAssets} accent="purple" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">{group.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{group.adSets.length} sets · {allAssets.length} ads</div>
          </div>
        </button>
      </div>
      {expanded && (
        <div className="ml-5 my-1 space-y-1">
          {group.adSets.map(s => (
            <div key={s.id}>
              <div className="text-[10px] font-semibold text-purple-700 px-2 py-0.5">{s.name}</div>
              {s.assets.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 px-2 py-0.5">
                  <div className="w-6 h-5 shrink-0 rounded overflow-hidden border border-purple-200 bg-gray-100">
                    {a.filePath && <video src={a.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />}
                  </div>
                  <div className="text-[10px] text-gray-600 truncate flex-1">{a.name}</div>
                </div>
              ))}
            </div>
          ))}
          <div className="flex gap-1 pt-1">
            <button
              onClick={onInsertAtPlayhead}
              disabled={!hasValidInsertPoint}
              className="flex-1 px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              Insert at playhead
            </button>
            <button
              onClick={onAutoPlace}
              disabled={!hasContent || autoInserting}
              className="flex-1 px-2 py-1 rounded bg-orange-500 text-white text-[10px] font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {autoInserting ? 'Analyzing…' : 'Auto place'}
            </button>
            <button
              onClick={onDelete}
              className="px-1.5 py-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete AB test group"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StackedThumb({ assets, accent }: { assets: Asset[]; accent: 'blue' | 'purple' }) {
  const top = assets.slice(0, 3)
  const border = accent === 'purple' ? 'border-purple-300' : 'border-blue-300'
  return (
    <div className="relative w-9 h-7 shrink-0">
      {top.map((asset, i) => {
        const offset = i * 2
        return (
          <div
            key={asset.id}
            className={`absolute top-0 left-0 w-7 h-7 rounded border ${border} overflow-hidden bg-gray-100`}
            style={{ transform: `translate(${offset}px, ${-offset * 0.3}px)`, zIndex: 10 - i }}
          >
            {asset.filePath && <video src={asset.filePath} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsInline />}
          </div>
        )
      })}
    </div>
  )
}
