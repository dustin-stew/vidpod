import { listPublishedAbTests } from '@/lib/db/repositories/publishedAbTests'
import { AbTestAnalytics } from '@/components/analytics/AbTestAnalytics'

export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  const publishedTests = listPublishedAbTests()

  return <AbTestAnalytics publishedTests={publishedTests} />
}
