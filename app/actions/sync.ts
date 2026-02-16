'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { syncMirror } from '@/lib/sync/mirror-sync'

export async function runSync(): Promise<{ success: boolean; projectsSynced?: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { success: false, error: 'Not authenticated' }
  }

  const result = await syncMirror(user.id, user.email)
  return {
    success: result.success,
    projectsSynced: result.projectsSynced,
    error: result.error,
  }
}

/**
 * Refresh sync and revalidate dashboard.
 * Use as form action for the Refresh button.
 */
export async function refreshAndRevalidate() {
  await runSync()
  revalidatePath('/dashboard')
}
