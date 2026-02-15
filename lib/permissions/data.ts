import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { filterProjectProperties } from './filter'

export type FilteredProject = {
  contact_notion_id: string
  notion_page_id: string
  contact_type: 'customer' | 'contractor'
  properties: Record<string, unknown>
}

/**
 * Fetch projects from notion_sync_cache and apply column filtering per row.
 * RLS restricts rows to user's entities; this filters properties by contact_type.
 */
export async function getFilteredProjects(
  supabase: SupabaseClient<Database>
): Promise<FilteredProject[]> {
  const { data: rows, error } = await supabase
    .from('notion_sync_cache')
    .select('contact_notion_id, notion_page_id, contact_type, properties_json')
    .order('last_synced_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`)
  }

  const projects: FilteredProject[] = (rows || []).map((row) => ({
    contact_notion_id: row.contact_notion_id,
    notion_page_id: row.notion_page_id,
    contact_type: row.contact_type,
    properties: filterProjectProperties(
      (row.properties_json || {}) as Record<string, unknown>,
      row.contact_type
    ),
  }))

  return projects
}
