import type { RollupResponse } from '@/types/analytics'

const BUCKET = 'flightcast-data'
const PREFIX = 'rollups/v1'
const BASE_URL = `https://${BUCKET}.s3.us-east-1.amazonaws.com/${PREFIX}`

// 5-minute in-memory cache
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function fetchRollup<T>(graphName: string): Promise<RollupResponse<T>> {
  const cached = cache.get(graphName)
  if (cached && cached.expires > Date.now()) {
    return cached.data as RollupResponse<T>
  }

  const url = `${BASE_URL}/${graphName}.json`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch rollup ${graphName}: ${response.status}`)
  }

  const parsed = (await response.json()) as RollupResponse<T>
  cache.set(graphName, { data: parsed, expires: Date.now() + CACHE_TTL_MS })
  return parsed
}
