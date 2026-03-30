'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatTimestamp } from '@/lib/utils'
import type { Episode } from '@/types'

interface EpisodesListClientProps {
  initialEpisodes: Episode[]
}

export function EpisodesListClient({ initialEpisodes }: EpisodesListClientProps) {
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this episode? This cannot be undone.')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/episodes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEpisodes((prev) => prev.filter((ep) => ep.id !== id))
    } catch {
      alert('Could not delete episode.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled episode', videoPath: '' }),
      })
      if (!res.ok) throw new Error()
      const episode: Episode = await res.json()
      router.push(`/episodes/${episode.id}`)
    } catch {
      setCreating(false)
      alert('Could not create episode. Please try again.')
    }
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Episodes</h1>
            <p className="text-sm text-gray-500 mt-0.5">All your podcast episodes</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {creating ? 'Creating…' : 'New episode'}
          </button>
        </div>

        {episodes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">No episodes yet</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">Create your first episode to get started.</p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New episode
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                href={`/episodes/${episode.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-24 h-14 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                  {episode.thumbnailPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={episode.thumbnailPath} alt={episode.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 truncate">{episode.title}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    {episode.duration > 0 && (
                      <span className="text-xs text-gray-400">{formatTimestamp(episode.duration)}</span>
                    )}
                    {episode.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(episode.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(ev) => handleDelete(ev, episode.id)}
                  disabled={deleting === episode.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                  title="Delete episode"
                >
                  {deleting === episode.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
