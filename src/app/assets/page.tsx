import { listAssets, listAdFolders } from '@/lib/db/repositories/assets'
import { listAdSets } from '@/lib/db/repositories/adSets'
import { listAbTestGroups } from '@/lib/db/repositories/abTestGroups'
import { AssetsLibrary } from '@/components/assets/AssetsLibrary'

export const dynamic = 'force-dynamic'

export default function AssetsPage() {
  const contentAssets = listAssets({ contentType: 'content' })
  const adAssets = listAssets({ contentType: 'ad' })
  const adSets = listAdSets()
  const abTestGroups = listAbTestGroups()
  const adFolders = listAdFolders()

  return (
    <AssetsLibrary
      initialContent={contentAssets}
      initialAds={adAssets}
      initialAdSets={adSets}
      initialAbTestGroups={abTestGroups}
      initialAdFolders={adFolders}
    />
  )
}
