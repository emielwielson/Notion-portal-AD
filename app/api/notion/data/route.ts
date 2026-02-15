import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFilteredProjects } from '@/lib/permissions/data'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projects = await getFilteredProjects(supabase)
    return NextResponse.json({ projects })
  } catch (err: any) {
    console.error('[API] /api/notion/data error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
