import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { NewVsReturningRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<NewVsReturningRow>('new_vs_returning')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/new-vs-returning]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
