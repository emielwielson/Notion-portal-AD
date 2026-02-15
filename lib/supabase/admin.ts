import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Admin Supabase client with service role (bypasses RLS)
 * Use ONLY in server-side code for sync operations
 * Never expose to client
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase admin env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY)')
  }
  return createClient<Database>(url, key)
}
