import type { EpisodeClip } from '@/types'
import { packClips, findPackedAtTime } from '@/lib/clipUtils'

/**
 * Analyze audio waveforms to find the quietest spots for ad insertion.
 *
 * Returns insertion points sorted descending by time (ready for splice from
 * the end so earlier indices stay valid).
 *
 * This is a pure analysis function — it does no fetching of clip data and no
 * state/API mutations. The caller supplies clips (already stripped of any ads
 * that should be re-placed) and the decoded audio is fetched internally via
 * AudioContext.
 */
export async function findQuietSpots(params: {
  clips: EpisodeClip[]
  assetDurations: Record<string, number>
  newAdAssetIds: string[]
  existingAdAssetIds: string[]
  mode: 'spread' | 'single'
}): Promise<{ time: number; assetId: string }[]> {
  const { clips, assetDurations, newAdAssetIds, existingAdAssetIds, mode } =
    params

  if (newAdAssetIds.length === 0) return []

  const packed = packClips(clips, assetDurations)
  if (packed.length === 0) return []

  const contentItems = packed.filter((i) => i.clip.clipType === 'content')
  if (contentItems.length === 0) return []

  const contentDur = contentItems.reduce((s, i) => s + i.dur, 0)
  if (contentDur < 1) return []

  // Build the ad asset queue: existing ads first, then newly requested ones
  const adAssetIdQueue = [...existingAdAssetIds, ...newAdAssetIds]
  const totalAds = adAssetIdQueue.length

  // Total timeline duration from the packed layout
  const totalDur = packed.length
    ? packed[packed.length - 1].start + packed[packed.length - 1].dur
    : 0

  // --- Determine zones ------------------------------------------------
  let zones: [number, number][]

  if (mode === 'single') {
    // Single zone — middle third of the timeline
    zones = [[totalDur * (1 / 3), totalDur * (2 / 3)]]
  } else if (existingAdAssetIds.length === 0 && newAdAssetIds.length === 1) {
    // First ad ever added — middle third
    zones = [[totalDur * (1 / 3), totalDur * (2 / 3)]]
  } else {
    // Spread ads evenly: divide timeline into (2*N+1) slices and place
    // each ad in the even-numbered slice
    zones = []
    for (let i = 0; i < totalAds; i++) {
      const zs = totalDur * ((2 * i + 1) / (2 * totalAds + 1))
      const ze = totalDur * ((2 * i + 2) / (2 * totalAds + 1))
      zones.push([zs, ze])
    }
  }

  // --- Decode audio ---------------------------------------------------
  const audioCtx = new AudioContext()
  const decodedAssets = new Map<
    string,
    { channel: Float32Array; sampleRate: number; duration: number }
  >()

  for (const item of contentItems) {
    const src = item.clip.asset?.filePath
    if (!src || decodedAssets.has(src)) continue
    try {
      const resp = await fetch(src)
      const buf = await resp.arrayBuffer()
      const audio = await audioCtx.decodeAudioData(buf)
      decodedAssets.set(src, {
        channel: audio.getChannelData(0),
        sampleRate: audio.sampleRate,
        duration: audio.duration,
      })
    } catch {
      /* skip undecodable assets */
    }
  }
  await audioCtx.close()

  // --- Compute energy levels ------------------------------------------
  const energy: { virtualTime: number; energy: number }[] = []

  for (const item of contentItems) {
    const src = item.clip.asset?.filePath
    if (!src) continue
    const decoded = decodedAssets.get(src)
    if (!decoded) continue

    const { channel, sampleRate, duration: assetDuration } = decoded
    const windowSamples = Math.floor(sampleRate * 0.5)
    const clipStart = item.clip.startOffset ?? 0
    const clipEnd =
      item.clip.endOffset >= 0 ? item.clip.endOffset : assetDuration
    const startSample = Math.floor(clipStart * sampleRate)
    const endSample = Math.min(
      Math.floor(clipEnd * sampleRate),
      channel.length,
    )
    const stepSamples = Math.floor(sampleRate * 0.25)

    for (let s = startSample; s + windowSamples <= endSample; s += stepSamples) {
      let sum = 0
      for (let j = s; j < s + windowSamples; j++) sum += channel[j] * channel[j]
      energy.push({
        virtualTime: item.start + (s / sampleRate - clipStart),
        energy: Math.sqrt(sum / windowSamples),
      })
    }
  }

  if (energy.length === 0) return []

  // --- Pick quietest spots per zone -----------------------------------
  const bestInZone = (zoneStart: number, zoneEnd: number): number | null => {
    const candidates = energy
      .filter((e) => e.virtualTime >= zoneStart && e.virtualTime <= zoneEnd)
      .filter((e) => {
        const item = findPackedAtTime(e.virtualTime, packed)
        if (!item || item.clip.clipType !== 'content') return false
        const posInClip = e.virtualTime - item.start
        return posInClip > 0.1 && posInClip < item.dur - 0.1
      })
      .sort((a, b) => a.energy - b.energy)
    return candidates.length > 0 ? candidates[0].virtualTime : null
  }

  const insertions: { time: number; assetId: string }[] = []

  if (mode === 'single') {
    const t = bestInZone(zones[0][0], zones[0][1])
    if (t !== null) {
      insertions.push({ time: t, assetId: adAssetIdQueue[0] })
    }
  } else {
    for (let i = 0; i < zones.length; i++) {
      const t = bestInZone(zones[i][0], zones[i][1])
      if (t !== null) {
        insertions.push({
          time: t,
          assetId: adAssetIdQueue[i] ?? newAdAssetIds[0],
        })
      }
    }
  }

  // Sort descending by time so the caller can splice from the end
  insertions.sort((a, b) => b.time - a.time)

  return insertions
}
