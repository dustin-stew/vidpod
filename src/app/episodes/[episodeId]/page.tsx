import { notFound } from 'next/navigation'
import { getEpisodeWithMarkers } from '@/lib/db/repositories/episodes'
import { listClips } from '@/lib/db/repositories/clips'
import { listAssets, listAdFolders } from '@/lib/db/repositories/assets'
import { listAdSets } from '@/lib/db/repositories/adSets'
import { listAbTestGroups } from '@/lib/db/repositories/abTestGroups'
import { EpisodeDesigner } from '@/components/episode/EpisodeDesigner'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ episodeId: string }>
}

export default async function EpisodeRoute({ params }: Props) {
  const { episodeId } = await params
  const episode = getEpisodeWithMarkers(episodeId)
  if (!episode) notFound()

  const clips = listClips(episodeId)
  const contentAssets = listAssets({ contentType: 'content' })
  const adAssets = listAssets({ contentType: 'ad' })
  const adSets = listAdSets()
  const abTestGroups = listAbTestGroups()
  const adFolders = listAdFolders()

  return (
    <EpisodeDesigner
      episode={episode}
      initialClips={clips}
      contentAssets={contentAssets}
      adAssets={adAssets}
      initialAdSets={adSets}
      initialAbTestGroups={abTestGroups}
      initialAdFolders={adFolders}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  const { episodeId } = await params
  const episode = getEpisodeWithMarkers(episodeId)
  return { title: episode?.title ?? 'Episode' }
}
