'use client'

import { create } from 'zustand'

interface PlayerState {
  currentTime: number
  duration: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  setPlaying: (p: boolean) => void
  setVolume: (v: number) => void
  toggleMute: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  volume: 1,
  isMuted: false,
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
}))
