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
 * Fetch projects from notion_contact_project + notion_projects.
 * RLS restricts notion_contact_project to user's entities.
 */
export async function getFilteredProjects(
  supabase: SupabaseClient<Database>
): Promise<FilteredProject[]> {
  const { data: relationRows, error: relError } = await supabase
    .from('notion_contact_project')
    .select('contact_notion_id, contact_type, project_notion_id')

  if (relError) {
    throw new Error(`Failed to fetch project relations: ${relError.message}`)
  }

  if (!relationRows?.length) {
    return []
  }

  const projectIds = [...new Set(relationRows.map((r) => r.project_notion_id))]

  const { data: projectRows, error: projError } = await supabase
    .from('notion_projects')
    .select('notion_page_id, properties_json')
    .in('notion_page_id', projectIds)

  if (projError) {
    throw new Error(`Failed to fetch projects: ${projError.message}`)
  }

  const projectMap = new Map(
    (projectRows || []).map((p) => [
      p.notion_page_id,
      (p.properties_json || {}) as Record<string, unknown>,
    ])
  )

  const projects: FilteredProject[] = []
  for (const rel of relationRows) {
    const props = projectMap.get(rel.project_notion_id)
    if (!props) continue

    projects.push({
      contact_notion_id: rel.contact_notion_id,
      notion_page_id: rel.project_notion_id,
      contact_type: rel.contact_type,
      properties: filterProjectProperties(props, rel.contact_type),
    })
  }

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
