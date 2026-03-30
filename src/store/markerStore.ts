'use client'

import { create } from 'zustand'
import type { AdMarker } from '@/types'

interface HistoryEntry {
  markers: AdMarker[]
}

interface MarkerState {
  markers: AdMarker[]
  past: HistoryEntry[]
  future: HistoryEntry[]

  initialize: (markers: AdMarker[]) => void

  addMarker: (marker: AdMarker) => void
  updateMarker: (id: string, changes: Partial<AdMarker>) => void
  deleteMarker: (id: string) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

const MAX_HISTORY = 50

function snapshot(markers: AdMarker[]): AdMarker[] {
  return markers.map(m => ({ ...m, ads: [...m.ads] }))
}

export const useMarkerStore = create<MarkerState>((set, get) => ({
  markers: [],
  past: [],
  future: [],

  initialize(markers) {
    set({ markers: snapshot(markers), past: [], future: [] })
  },

  addMarker(marker) {
    set((s) => ({
      markers: [...s.markers, marker],
      past: [...s.past.slice(-MAX_HISTORY), { markers: snapshot(s.markers) }],
      future: [],
    }))
  },

  updateMarker(id, changes) {
    set((s) => ({
      markers: s.markers.map((m) => (m.id === id ? { ...m, ...changes } : m)),
      past: [...s.past.slice(-MAX_HISTORY), { markers: snapshot(s.markers) }],
      future: [],
    }))
  },

  deleteMarker(id) {
    set((s) => ({
      markers: s.markers.filter((m) => m.id !== id),
      past: [...s.past.slice(-MAX_HISTORY), { markers: snapshot(s.markers) }],
      future: [],
    }))
  },

  undo() {
    const { past, markers } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set((s) => ({
      markers: prev.markers,
      past: s.past.slice(0, -1),
      future: [{ markers: snapshot(markers) }, ...s.future.slice(0, MAX_HISTORY - 1)],
    }))
  },

  redo() {
    const { future, markers } = get()
    if (future.length === 0) return
    const next = future[0]
    set((s) => ({
      markers: next.markers,
      future: s.future.slice(1),
      past: [...s.past.slice(-MAX_HISTORY), { markers: snapshot(markers) }],
    }))
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}))
