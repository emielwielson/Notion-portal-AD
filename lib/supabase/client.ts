import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

/**
 * Browser/client-side Supabase client
 * Use this in Client Components for client-side operations
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
