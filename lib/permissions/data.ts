import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { filterProjectProperties } from './filter'
import { CUSTOMER_COLUMNS, CONTRACTOR_COLUMNS } from './filter'

export type FilteredProject = {
  contact_notion_id: string
  notion_page_id: string
  contact_type: 'customer' | 'contractor'
  properties: Record<string, unknown>
}

export type UniqueProject = {
  notion_page_id: string
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

const ALL_PROJECT_KEYS = [
  'title',
  ...new Set([...CUSTOMER_COLUMNS, ...CONTRACTOR_COLUMNS]),
] as const

/**
 * Fetch unique projects (one per notion_page_id), merging properties from all
 * access paths (customer + contractor). For list/detail view.
 */
export async function getUniqueProjects(
  supabase: SupabaseClient<Database>
): Promise<UniqueProject[]> {
  const rows = await getFilteredProjects(supabase)

  const byPage = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const existing = byPage.get(row.notion_page_id) ?? {}
    for (const key of ALL_PROJECT_KEYS) {
      const v = row.properties[key]
      if (v !== undefined) existing[key] = v
    }
    byPage.set(row.notion_page_id, existing)
  }

  return Array.from(byPage.entries(), ([notion_page_id, properties]) => ({
    notion_page_id,
    properties,
  }))
}

const CACHE_FRESH_SECONDS = 5 * 60 // 5 minutes

/**
 * Check if the user has fresh cached projects (skip Notion sync if so).
 */
export async function hasFreshCache(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('notion_sync_cache')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.last_synced_at) return false
  const last = new Date(data.last_synced_at).getTime()
  return (Date.now() - last) / 1000 < CACHE_FRESH_SECONDS
}

/**
 * Fetch a single project by notion_page_id for the detail view.
 */
export async function getProjectById(
  supabase: SupabaseClient<Database>,
  notionPageId: string
): Promise<UniqueProject | null> {
  const projects = await getUniqueProjects(supabase)
  return projects.find((p) => p.notion_page_id === notionPageId) ?? null
}
