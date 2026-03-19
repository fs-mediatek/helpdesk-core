import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()
  if (!session?.role.includes('admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delay slightly so the response is delivered before the process exits.
  // In dev: Next.js/nodemon restarts automatically.
  // In production: PM2 / systemd restarts the process.
  setTimeout(() => process.exit(0), 300)

  return NextResponse.json({ success: true, message: 'Server wird neu gestartet...' })
}
