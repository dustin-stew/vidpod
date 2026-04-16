'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { formatTimestamp } from '@/lib/utils'
import type { Asset, AssetContentType, AdSet, AbTestGroup } from '@/types'

type AssetsTab = 'content' | 'ad' | 'ad_set' | 'ab_test'

interface AssetsLibraryProps {
  initialContent: Asset[]
  initialAds: Asset[]
  initialAdSets: AdSet[]
  initialAbTestGroups: AbTestGroup[]
  initialAdFolders: string[]
}

type UploadStep = 'idle' | 'uploading'
type FolderSelection = string | '__all__' | '__none__'

export function AssetsLibrary({
  initialContent, initialAds, initialAdSets, initialAbTestGroups, initialAdFolders,
}: AssetsLibraryProps) {
  const [activeTab, setActiveTab] = useState<AssetsTab>('content')
  const [contentAssets, setContentAssets] = useState<Asset[]>(initialContent)
  const [adAssets, setAdAssets] = useState<Asset[]>(initialAds)
  const [adSets, setAdSets] = useState<AdSet[]>(initialAdSets)
  const [abTestGroups, setAbTestGroups] = useState<AbTestGroup[]>(initialAbTestGroups)
  const [adFolders, setAdFolders] = useState<string[]>(initialAdFolders)
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const contentInputRef = useRef<HTMLInputElement>(null)
  const adInputRef = useRef<HTMLInputElement>(null)
  const pendingFolderRef = useRef<string | null>(null)

  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set())
  const [folderFilter, setFolderFilter] = useState<FolderSelection>('__all__')

  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null)
  const [creatingAdSet, setCreatingAdSet] = useState(false)
  const [adSetName, setAdSetName] = useState('')

  const [creatingAbTestGroup, setCreatingAbTestGroup] = useState<string | null>(null)
  const [abTestGroupName, setAbTestGroupName] = useState('')

  const [uploadFolderDialogOpen, setUploadFolderDialogOpen] = useState(false)

  const refreshFolders = useCallback(async () => {
    const res = await fetch('/api/assets/folders')
    if (res.ok) setAdFolders(await res.json())
  }, [])
  const refreshAdSets = useCallback(async () => {
    const res = await fetch('/api/ad-sets')
    if (res.ok) setAdSets(await res.json())
  }, [])
  const refreshAbTestGroups = useCallback(async () => {
    const res = await fetch('/api/ab-test-groups')
    if (res.ok) setAbTestGroups(await res.json())
  }, [])

  const handleUpload = useCallback(async (file: File, contentType: AssetContentType, folder: string | null) => {
    setUploadStep('uploading')
    setUploadProgress(0)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', 'episode')

      const uploadResult = await uploadWithProgress(form, (pct) => setUploadProgress(pct))
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      const assetRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filePath: uploadResult.filePath, type: 'video', contentType, folder }),
      })
      const asset: Asset = await assetRes.json()

      if (contentType === 'content') {
        setContentAssets((prev) => [asset, ...prev])
      } else {
        setAdAssets((prev) => [asset, ...prev])
        if (folder && !adFolders.includes(folder)) {
          setAdFolders(prev => [...prev, folder].sort((a, b) => a.localeCompare(b)))
        }
      }
      setActiveTab(contentType)
    } catch {
      alert('Upload failed. Please try again.')
    } finally {
      setUploadStep('idle')
    }
  }, [adFolders])

  const startAdUpload = useCallback((folder: string | null) => {
    pendingFolderRef.current = folder
    setUploadFolderDialogOpen(false)
    adInputRef.current?.click()
  }, [])

  const updateAssetFolder = useCallback(async (assetId: string, folder: string | null) => {
    setAdAssets(prev => prev.map(a => a.id === assetId ? { ...a, folder } : a))
    await fetch(`/api/assets/${assetId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    })
    await refreshFolders()
  }, [refreshFolders])

  const filteredAdAssets = useMemo(() => {
    if (folderFilter === '__all__') return adAssets
    if (folderFilter === '__none__') return adAssets.filter(a => !a.folder)
    return adAssets.filter(a => a.folder === folderFilter)
  }, [adAssets, folderFilter])

  const currentAssets = activeTab === 'content' ? contentAssets : filteredAdAssets

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assets</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your video clips and ad creatives</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUploadFolderDialogOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Upload ad
            </button>
            <button
              onClick={() => contentInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Upload content
            </button>
          </div>
        </div>

        {uploadStep === 'uploading' && (
          <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Uploading…</span>
              <span className="text-sm text-gray-500">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-5">
          <TabButton active={activeTab === 'content'} onClick={() => setActiveTab('content')} count={contentAssets.length}>
            Content
          </TabButton>
          <TabButton active={activeTab === 'ad'} onClick={() => { setActiveTab('ad'); setSelectedAdIds(new Set()) }} count={adAssets.length} accent>
            Ads
          </TabButton>
          <TabButton active={activeTab === 'ad_set'} onClick={() => { setActiveTab('ad_set'); setSelectedAdIds(new Set()); refreshAdSets() }} count={adSets.length} accent>
            Ad Sets
          </TabButton>
          <TabButton active={activeTab === 'ab_test'} onClick={() => { setActiveTab('ab_test'); setSelectedAdIds(new Set()); setSelectedAdSetId(null); refreshAbTestGroups() }} count={abTestGroups.length} accent>
            AB Test Groups
          </TabButton>
        </div>

        {activeTab === 'ad' && (
          <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Ad clips are overlays — drag them anywhere into your episode timeline to insert a break.
          </p>
        )}
        {activeTab === 'content' && (
          <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Content clips snap to the beginning or end of your episode timeline.
          </p>
        )}
        {activeTab === 'ad_set' && (
          <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Group ads together for organized placement and AB testing.
          </p>
        )}
        {activeTab === 'ab_test' && (
          <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            AB test groups let you compare ad sets against each other.
          </p>
        )}

        {activeTab === 'ad' && (
          <FolderFilterStrip
            folders={adFolders}
            value={folderFilter}
            onChange={setFolderFilter}
            onRename={async (oldName, newName) => {
              const res = await fetch('/api/assets/folders', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldName, newName }),
              })
              if (res.ok) {
                setAdAssets(prev => prev.map(a => a.folder === oldName ? { ...a, folder: newName } : a))
                await refreshFolders()
                if (folderFilter === oldName) setFolderFilter(newName)
              }
            }}
            onDelete={async (folder) => {
              await fetch(`/api/assets/folders?name=${encodeURIComponent(folder)}`, { method: 'DELETE' })
              setAdAssets(prev => prev.map(a => a.folder === folder ? { ...a, folder: null } : a))
              await refreshFolders()
              if (folderFilter === folder) setFolderFilter('__all__')
            }}
            counts={{
              all: adAssets.length,
              none: adAssets.filter(a => !a.folder).length,
              byFolder: Object.fromEntries(adFolders.map(f => [f, adAssets.filter(a => a.folder === f).length])),
            }}
          />
        )}

        {/* asset grid */}
        {(activeTab === 'content' || activeTab === 'ad') && (
          <>
            {currentAssets.length === 0 ? (
              <EmptyState
                type={activeTab as AssetContentType}
                onUpload={() => activeTab === 'content' ? contentInputRef.current?.click() : setUploadFolderDialogOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {currentAssets.map((asset) => {
                  const isSelected = activeTab === 'ad' && selectedAdIds.has(asset.id)
                  return (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      selectable={activeTab === 'ad'}
                      selected={isSelected}
                      folders={adFolders}
                      onToggleSelect={activeTab === 'ad' ? () => setSelectedAdIds(prev => {
                        const next = new Set(prev)
                        if (next.has(asset.id)) next.delete(asset.id); else next.add(asset.id)
                        return next
                      }) : undefined}
                      onSetFolder={activeTab === 'ad' ? (folder) => updateAssetFolder(asset.id, folder) : undefined}
                    />
                  )
                })}
              </div>
            )}

            {/* ad actions */}
            {activeTab === 'ad' && selectedAdIds.size > 0 && (
              <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-gray-700">{selectedAdIds.size} ad{selectedAdIds.size !== 1 ? 's' : ''} selected</span>
                  <button onClick={() => setSelectedAdIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Clear</button>
                </div>
                <div className="flex flex-col gap-2">
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
                        }} className="flex gap-2">
                          <input
                            autoFocus
                            value={adSetName}
                            onChange={(e) => setAdSetName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingAdSet(false); setAdSetName('') } }}
                            placeholder="Ad set name…"
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-400"
                          />
                          <button type="submit" disabled={!adSetName.trim()} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">Create</button>
                          <button type="button" onClick={() => { setCreatingAdSet(false); setAdSetName('') }} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
                        </form>
                      ) : (
                        <button
                          onClick={() => setCreatingAdSet(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Create ad set ({selectedAdIds.size})
                        </button>
                      )}
                      {adSets.length > 0 && (
                        <select
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white"
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
              </div>
            )}
          </>
        )}

        {/* ad sets */}
        {activeTab === 'ad_set' && (
          adSets.length === 0 ? (
            <EmptyGroupState message="No ad sets yet. Select 2+ ads in the Ads tab to create one." />
          ) : (
            <div className="space-y-2">
              {adSets.map((group) => {
                const isSel = selectedAdSetId === group.id
                return (
                  <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-all">
                    <button
                      onClick={() => setSelectedAdSetId(prev => prev === group.id ? null : group.id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 ${isSel ? 'bg-blue-50' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">{group.assets.length}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{group.name}</div>
                        <div className="text-xs text-gray-400 truncate">{group.assets.map(a => a.name).join(', ')}</div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await fetch(`/api/ad-sets/${group.id}`, { method: 'DELETE' })
                          await refreshAdSets()
                          if (selectedAdSetId === group.id) setSelectedAdSetId(null)
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </button>
                    {isSel && (
                      <div className="px-4 py-3 bg-blue-50 border-t border-gray-100 flex flex-col gap-2">
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
                          }} className="flex gap-2">
                            <input
                              autoFocus
                              value={abTestGroupName}
                              onChange={(e) => setAbTestGroupName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingAbTestGroup(null); setAbTestGroupName('') } }}
                              placeholder="AB test group name…"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-indigo-400"
                            />
                            <button type="submit" disabled={!abTestGroupName.trim()} className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-40 transition-colors">Create</button>
                            <button type="button" onClick={() => { setCreatingAbTestGroup(null); setAbTestGroupName('') }} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
                          </form>
                        ) : (
                          <button
                            onClick={() => { setCreatingAbTestGroup(group.id); setAbTestGroupName('') }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                          >
                            Create AB test group
                          </button>
                        )}
                        {abTestGroups.length > 0 && (
                          <select
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white"
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

        {/* ab test groups */}
        {activeTab === 'ab_test' && (
          abTestGroups.length === 0 ? (
            <EmptyGroupState message="No AB test groups yet. Create one from the Ad Sets tab." />
          ) : (
            <div className="space-y-2">
              {abTestGroups.map((testSet) => (
                <div key={testSet.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-all">
                  <div className="w-full text-left px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold">{testSet.adSets.length}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{testSet.name}</div>
                      <div className="text-xs text-gray-400 truncate">{testSet.adSets.map(g => g.name).join(', ')}</div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/ab-test-groups/${testSet.id}`, { method: 'DELETE' })
                        await refreshAbTestGroups()
                      }}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <input
        ref={contentInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f, 'content', null)
          e.target.value = ''
        }}
      />
      <input
        ref={adInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          const folder = pendingFolderRef.current
          pendingFolderRef.current = null
          if (f) handleUpload(f, 'ad', folder)
          e.target.value = ''
        }}
      />

      {uploadFolderDialogOpen && (
        <UploadFolderDialog
          folders={adFolders}
          onCancel={() => setUploadFolderDialogOpen(false)}
          onPick={startAdUpload}
        />
      )}
    </div>
  )
}

function FolderFilterStrip({
  folders, value, onChange, counts, onRename, onDelete,
}: {
  folders: string[]
  value: FolderSelection
  onChange: (v: FolderSelection) => void
  counts: { all: number; none: number; byFolder: Record<string, number> }
  onRename: (oldName: string, newName: string) => Promise<void>
  onDelete: (folder: string) => Promise<void>
}) {
  return (
    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
      <FolderPill active={value === '__all__'} onClick={() => onChange('__all__')}>
        Redmen TV <span className="ml-1 text-[10px] text-gray-400">{counts.all}</span>
      </FolderPill>
      {folders.map(f => (
        <FolderPillWithMenu
          key={f}
          name={f}
          count={counts.byFolder[f] ?? 0}
          active={value === f}
          onClick={() => onChange(f)}
          onRename={(newName) => onRename(f, newName)}
          onDelete={() => onDelete(f)}
        />
      ))}
    </div>
  )
}

function FolderPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

function FolderPillWithMenu({
  name, count, active, onClick, onRename, onDelete,
}: {
  name: string; count: number; active: boolean; onClick: () => void
  onRename: (newName: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  if (editing) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const n = draft.trim()
          if (n && n !== name) await onRename(n)
          setEditing(false)
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(name); setEditing(false) } }}
          className="px-2 py-1 rounded-full text-xs border border-gray-300 focus:outline-none focus:border-gray-500 w-28"
        />
      </form>
    )
  }
  return (
    <div className={`group inline-flex items-center rounded-full text-xs font-medium transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
      <button onClick={onClick} className="pl-2.5 pr-1.5 py-1">
        {name} <span className={`ml-1 text-[10px] ${active ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setDraft(name); setEditing(true) }}
        className={`px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
        title="Rename folder"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
      <button
        onClick={async (e) => {
          e.stopPropagation()
          if (confirm(`Clear folder "${name}"? Ads will be moved to Redmen TV.`)) await onDelete()
        }}
        className={`px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}
        title="Delete folder (keeps ads)"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

function UploadFolderDialog({
  folders, onCancel, onPick,
}: {
  folders: string[]
  onCancel: () => void
  onPick: (folder: string | null) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Upload ad</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pick a folder to organize this ad.</p>
        </div>
        <div className="px-5 py-3 max-h-80 overflow-y-auto flex flex-col gap-1">
          <button
            onClick={() => onPick(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span className="flex-1">Redmen TV</span>
          </button>
          {folders.map(f => (
            <button
              key={f}
              onClick={() => onPick(f)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <span className="flex-1">{f}</span>
            </button>
          ))}
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (newName.trim()) onPick(newName.trim())
              }}
              className="flex items-center gap-1.5 px-3 py-2"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
                placeholder="Folder name…"
                className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-400"
              />
              <button type="submit" disabled={!newName.trim()} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-40">Use</button>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors border border-dashed border-blue-200 mt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New folder
            </button>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  count,
  accent,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[clamp(0.9375rem,0.85vw,1.25rem)] font-medium transition-colors ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          active
            ? accent
              ? 'bg-orange-100 text-orange-600'
              : 'bg-gray-100 text-gray-600'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function AssetCard({
  asset,
  selectable,
  selected,
  folders,
  onToggleSelect,
  onSetFolder,
}: {
  asset: Asset
  selectable?: boolean
  selected?: boolean
  folders?: string[]
  onToggleSelect?: () => void
  onSetFolder?: (folder: string | null) => void
}) {
  const isAd = asset.contentType === 'ad'
  const [folderMenuOpen, setFolderMenuOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  return (
    <div
      className={`relative bg-white rounded-xl border overflow-hidden group hover:border-gray-300 hover:shadow-sm transition-all ${
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
      } ${selectable ? 'cursor-pointer' : ''}`}
      onClick={selectable ? onToggleSelect : undefined}
    >
      <div className="aspect-video bg-gray-900 relative overflow-hidden">
        <video
          src={asset.filePath}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          playsInline
        />
        {isAd && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wide">
            Ad
          </span>
        )}
        {selectable && (
          <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-blue-500 border-blue-500' : 'bg-white/80 border-gray-300'
          }`}>
            {selected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium text-gray-900 truncate">{asset.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {asset.duration > 0 && (
            <p className="text-[11px] text-gray-400">{formatTimestamp(asset.duration)}</p>
          )}
          {isAd && onSetFolder && (
            <>
              {asset.duration > 0 && <span className="text-gray-300">·</span>}
              <button
                onClick={(e) => { e.stopPropagation(); setFolderMenuOpen(v => !v) }}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors inline-flex items-center gap-0.5"
                title="Change folder"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <span className="truncate max-w-[10rem]">{asset.folder ?? 'Redmen TV'}</span>
              </button>
            </>
          )}
        </div>
      </div>
      {folderMenuOpen && onSetFolder && (
        <div
          className="absolute inset-x-2 bottom-2 z-10 bg-white rounded-lg shadow-xl border border-gray-200 max-h-56 overflow-y-auto p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onSetFolder(null); setFolderMenuOpen(false) }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-gray-50 ${!asset.folder ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
          >
            Redmen TV
          </button>
          {(folders ?? []).map(f => (
            <button
              key={f}
              onClick={() => { onSetFolder(f); setFolderMenuOpen(false) }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-gray-50 ${asset.folder === f ? 'text-orange-700 font-medium' : 'text-gray-600'}`}
            >
              {f}
            </button>
          ))}
          {creatingNew ? (
            <form onSubmit={(e) => {
              e.preventDefault()
              if (newName.trim()) { onSetFolder(newName.trim()); setFolderMenuOpen(false); setCreatingNew(false); setNewName('') }
            }} className="flex items-center gap-1 px-1 py-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingNew(false); setNewName('') } }}
                placeholder="New folder…"
                className="flex-1 px-2 py-1 rounded border border-gray-300 text-xs focus:outline-none focus:border-blue-400"
              />
              <button type="submit" disabled={!newName.trim()} className="px-2 py-1 rounded bg-blue-500 text-white text-[10px] font-medium disabled:opacity-40">Add</button>
            </form>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs text-blue-600 hover:bg-blue-50 border border-dashed border-blue-200 mt-1"
            >
              + New folder
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ type, onUpload }: { type: AssetContentType; onUpload: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">
        No {type === 'ad' ? 'ad' : 'content'} clips yet
      </h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        {type === 'ad'
          ? 'Upload ad creatives to insert into episode timelines.'
          : 'Upload video clips to compose your episodes.'}
      </p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Upload {type === 'ad' ? 'ad' : 'content clip'}
      </button>
    </div>
  )
}

function EmptyGroupState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

function uploadWithProgress(form: FormData, onProgress: (pct: number) => void): Promise<{ filePath: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/uploads')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else reject(new Error(xhr.responseText))
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(form)
  })
}
