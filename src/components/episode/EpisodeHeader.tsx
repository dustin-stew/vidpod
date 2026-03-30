'use client'

import type { Episode } from '@/types'

interface EpisodeHeaderProps {
  episode: Episode
}

export function EpisodeHeader({ episode }: EpisodeHeaderProps) {
  const publishedDate = episode.publishedAt
    ? new Date(episode.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="mb-5">
      <div className="text-xs text-gray-400 mb-2">← Ads</div>
      <h1 className="text-2xl font-bold text-gray-900 leading-snug">{episode.title}</h1>
      {publishedDate && (
        <p className="mt-1.5 text-sm text-gray-500">{publishedDate}</p>
      )}
    </div>
  )
}
