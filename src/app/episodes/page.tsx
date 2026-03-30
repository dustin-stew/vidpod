import { listEpisodes } from '@/lib/db/repositories/episodes'
import { EpisodesListClient } from './EpisodesListClient'

export const dynamic = 'force-dynamic'

export default function EpisodesPage() {
  const episodes = listEpisodes()
  return <EpisodesListClient initialEpisodes={episodes} />
}

export const metadata = { title: 'Episodes — Vidpod' }
