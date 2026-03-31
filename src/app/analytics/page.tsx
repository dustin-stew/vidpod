import { listPublishedAbTests } from '@/lib/db/repositories/publishedAbTests'
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs'

export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  const publishedTests = listPublishedAbTests()

  return <AnalyticsTabs publishedTests={publishedTests} />
}
