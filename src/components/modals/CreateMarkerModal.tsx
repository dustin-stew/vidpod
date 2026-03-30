'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { AdLibraryPicker } from './AdLibraryPicker'
import { Button } from '@/components/ui/Button'
import { useMarkerStore } from '@/store/markerStore'
import { usePlayerStore } from '@/store/playerStore'
import { formatTimestamp } from '@/lib/utils'
import type { AdMarker, MarkerType } from '@/types'

type Step = 'type' | 'picker'

interface CreateMarkerModalProps {
  open: boolean
  onClose: () => void
  episodeId: string
  /** When editing an existing marker, pass it here */
  editingMarker?: AdMarker | null
}

const MARKER_TYPE_OPTIONS: { type: MarkerType; label: string; description: string }[] = [
  {
    type: 'AUTO',
    label: 'Auto',
    description: 'Automatic ad insertions',
  },
  {
    type: 'STATIC',
    label: 'Static',
    description: 'A marker for a specific ad that you select',
  },
  {
    type: 'AB_TEST',
    label: 'A/B test',
    description: 'Compare the performance of multiple ads',
  },
]

export function CreateMarkerModal({ open, onClose, episodeId, editingMarker }: CreateMarkerModalProps) {
  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<MarkerType>(editingMarker?.type ?? 'AUTO')
  const [saving, setSaving] = useState(false)

  const addMarker = useMarkerStore((s) => s.addMarker)
  const updateMarker = useMarkerStore((s) => s.updateMarker)
  const currentTime = usePlayerStore((s) => s.currentTime)

  const isEditing = !!editingMarker
  const timestamp = editingMarker?.timestamp ?? currentTime

  function handleClose() {
    setStep('type')
    setSelectedType(editingMarker?.type ?? 'AUTO')
    onClose()
  }

  async function handleTypeConfirm() {
    if (selectedType === 'AUTO') {
      await saveMarker(selectedType, [])
    } else {
      setStep('picker')
    }
  }

  async function handlePickerConfirm(adIds: string[]) {
    await saveMarker(selectedType, adIds)
  }

  async function saveMarker(type: MarkerType, adIds: string[]) {
    setSaving(true)
    try {
      if (isEditing && editingMarker) {
        // Update existing
        const res = await fetch(`/api/markers/${editingMarker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, adIds }),
        })
        if (!res.ok) throw new Error('Update failed')
        const updated: AdMarker = await res.json()
        updateMarker(editingMarker.id, updated)
      } else {
        // Create new
        const res = await fetch('/api/markers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeId, timestamp, type, adIds }),
        })
        if (!res.ok) throw new Error('Create failed')
        const marker: AdMarker = await res.json()
        addMarker(marker)
      }
      handleClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const title = step === 'type'
    ? isEditing ? 'Edit ad marker' : 'Create ad marker'
    : selectedType === 'STATIC' ? 'Select ad' : 'A/B test'

  const description = step === 'type'
    ? `At ${formatTimestamp(timestamp)} — select which ads you'd like to ${isEditing ? 'update to' : 'A/B test'}`
    : undefined

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      maxWidth={step === 'picker' ? 'lg' : 'sm'}
    >
      {step === 'type' && (
        <div className="px-6 py-4">
          <div className="space-y-2">
            {MARKER_TYPE_OPTIONS.map(({ type, label, description: desc }) => (
              <label
                key={type}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === type
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="markerType"
                  value={type}
                  checked={selectedType === type}
                  onChange={() => setSelectedType(type)}
                  className="mt-0.5 accent-gray-900"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" size="md" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleTypeConfirm} loading={saving && selectedType === 'AUTO'}>
              {selectedType === 'AUTO' ? 'Create marker' : 'Select marker'}
            </Button>
          </div>
        </div>
      )}

      {step === 'picker' && (
        <AdLibraryPicker
          mode={selectedType === 'STATIC' ? 'single' : 'multi'}
          initialSelection={editingMarker?.ads.map((a) => a.adId) ?? []}
          onConfirm={handlePickerConfirm}
          onCancel={() => setStep('type')}
        />
      )}
    </Dialog>
  )
}
