// Types for Flightcast analytics rollup data

export interface RollupResponse<T> {
  graph: string
  generated_at: string
  row_count: number
  data: T[]
}

export interface EpisodeOverlapRow {
  episode_a: string
  episode_b: string
  shared_users: number
  users_in_a: number
  overlap_percent: number
}

export interface RetentionFunnelRow {
  episodes_watched_bucket: string
  users: number
  percent_of_total_users: number
}

export interface NewVsReturningRow {
  day: string
  new_users: number
  returning_users: number
}

export interface RelativePerformanceRow {
  episode_id: string
  metric: string
  window_days: number
  value: number
  rank: number
  out_of: number
}

export interface DailyPerformanceRow {
  day: string
  views: number
  listens: number
  streams: number
  watch_time: number
}

export interface AudienceSourceRow {
  day: string
  source: string
  views: number
  share_percent: number
}

export interface GeoBreakdownRow {
  country: string
  views: number
  listens: number
  unique_users: number
}

export interface DeviceBreakdownRow {
  device_type: string
  platform: string
  views: number
  watch_time: number
}

export interface AdDeliveryFunnelRow {
  day: string
  opportunities: number
  impressions: number
  completions: number
  fill_rate: number
}

export interface TopVideoRow {
  video_id: string
  views: number
  listens: number
  watch_time: number
  rank: number
}
