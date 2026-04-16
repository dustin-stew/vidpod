export type MarkerType = 'AUTO' | 'STATIC' | 'AB_TEST'
export type AssetContentType = 'content' | 'ad'

export interface Asset {
  id: string
  name: string
  filePath: string
  type: 'video' | 'audio'
  contentType: AssetContentType
  duration: number
  folder: string | null
  createdAt: string
}

export interface EpisodeClip {
  id: string
  episodeId: string
  assetId: string
  clipType: AssetContentType
  orderIndex: number
  startOffset: number   // seconds into the asset where this clip starts
  endOffset: number     // seconds into the asset where this clip ends (-1 = full asset)
  createdAt: string
  asset: Asset
  abTestGroupId?: string | null      // if this clip is an AB test, the group ID
  abTestVariantIds?: string | null  // JSON array of variant asset IDs
  abTestGroupName?: string | null   // display name for the AB test
}

export interface Episode {
  id: string
  title: string
  videoPath: string
  duration: number
  thumbnailPath: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Ad {
  id: string
  name: string
  folder: string | null
  filePath: string
  duration: number
  thumbnailPath: string | null
  createdAt: string
}

export interface AdMarker {
  id: string
  episodeId: string
  timestamp: number
  type: MarkerType
  winnerId: string | null
  createdAt: string
  updatedAt: string
  ads: AdMarkerAd[]
}

export interface AdMarkerAd {
  id: string
  markerId: string
  adId: string
  position: number
  ad: Ad
}

export interface EpisodeWithMarkers extends Episode {
  markers: AdMarker[]
}

export type AssetPanelTab = 'content' | 'ad' | 'ad_set' | 'ab_test'

export interface AdSet {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  assets: Asset[]  // ordered by position
}

export interface AbTestGroup {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  adSets: AdSet[]  // ordered by position
}

export interface PublishedAbTest {
  id: string
  episodeId: string
  abTestGroupId: string
  abTestGroupName: string
  episodeTitle: string
  clipTimestamp: number
  publishedAt: string
  variantNames: string[]
}
