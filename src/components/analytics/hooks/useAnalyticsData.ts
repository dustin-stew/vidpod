import { useState, useEffect } from 'react'
import type { RollupResponse } from '@/types/analytics'

export function useAnalyticsData<T>(endpoint: string) {
  const [data, setData] = useState<T[] | null>(null)
  const [meta, setMeta] = useState<{ generatedAt: string; rowCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/analytics/${endpoint}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: RollupResponse<T> = await res.json()
        if (!cancelled) {
          setData(json.data)
          setMeta({ generatedAt: json.generated_at, rowCount: json.row_count })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [endpoint])

  return { data, meta, loading, error }
}
