import { NextResponse } from 'next/server'
import { plugins } from '@/plugins/registry'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(plugins.map(p => p.manifest))
}
