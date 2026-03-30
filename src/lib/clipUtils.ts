import type { EpisodeClip } from '@/types'

export interface PackedClip {
  clip: EpisodeClip
  start: number
  dur: number
}

/**
 * Compute packed start times from clip order, respecting start/end offsets.
 */
export function packClips(
  clips: EpisodeClip[],
  durations: Record<string, number>,
): PackedClip[] {
  let cursor = 0
  return clips.map((clip) => {
    const assetDur = durations[clip.assetId] ?? clip.asset?.duration ?? 0
    const startOff = clip.startOffset ?? 0
    const endOff =
      clip.endOffset != null && clip.endOffset >= 0
        ? clip.endOffset
        : assetDur
    const dur = Math.max(endOff - startOff, 0)
    const start = cursor
    cursor += dur
    return { clip, start, dur }
  })
}

/**
 * Find packed item at a virtual time.
 */
export function findPackedAtTime(
  t: number,
  packed: PackedClip[],
): PackedClip | null {
  for (const item of packed) {
    if (t >= item.start && t < item.start + Math.max(item.dur, 0.001))
      return item
  }
  return packed[packed.length - 1] ?? null
}
