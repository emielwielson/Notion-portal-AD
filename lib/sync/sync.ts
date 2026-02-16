'use server'

import {
  queryDatabase,
  getPropertyIdByName,
  setDataSourceOverride,
} from '@/lib/notion/client'
import type { NotionPage } from '@/lib/notion/types'
import { getPortalConfig } from '@/lib/config/portal'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProjectPropertyIds } from '@/lib/utils/notion-to-app'
import { normalizeNotionId } from '@/lib/utils/notion-id'

const PROJECT_PROPERTY_NAMES = [
  'Naam',
  'Name',
  'title',
  'Title',
  'Project',
  'Projectnaam',
  'Status',
  'Adres 1',
  'Adres 2',
  'Type',
  'Meeting',
  'Contract ondertekend',
  'Factuur betaald',
] as const

function getRelationProp(
  page: NotionPage,
  propertyId: string | null
): Array<{ id: string }> | null {
  if (!propertyId) return null
  let prop = page.properties[propertyId]
  if (!prop) {
    try {
      prop = page.properties[decodeURIComponent(propertyId)]
    } catch {
      /* ignore */
    }
  }
  if (!prop || (prop as { type?: string }).type !== 'relation') return null
  return (prop as { relation?: Array<{ id: string }> }).relation || null
}

function extractProjectIdsFromPage(
  page: NotionPage,
  projectenPropertyId: string | null
): string[] {
  const relation = getRelationProp(page, projectenPropertyId)
  if (relation && relation.length > 0) return relation.map((r) => r.id)

  for (const [, prop] of Object.entries(page.properties)) {
    const p = prop as { type?: string; relation?: Array<{ id: string }> }
    if (p?.type === 'relation' && p.relation?.length) {
      return p.relation.map((r) => r.id)
    }
  }
  return []
}

const PROP_NAME_TO_KEY: Record<string, keyof ProjectPropertyIds> = {
  Naam: 'title',
  Name: 'title',
  title: 'title',
  Title: 'title',
  Project: 'title',
  Projectnaam: 'title',
  Status: 'status',
  'Adres 1': 'adres1',
  'Adres 2': 'adres2',
  Type: 'type',
  Meeting: 'meeting',
  'Contract ondertekend': 'contractOndertekend',
  'Factuur betaald': 'factuurBetaald',
}

async function resolveProjectPropertyIds(
  projectDbId: string,
  projectTitlePropertyName?: string
): Promise<ProjectPropertyIds> {
  const ids: ProjectPropertyIds = {}
  const titleNames = [
    ...(projectTitlePropertyName ? [projectTitlePropertyName] : []),
    ...PROJECT_PROPERTY_NAMES,
  ]
  const seenKeys = new Set<string>()
  for (const name of titleNames) {
    const id = await getPropertyIdByName(projectDbId, name)
    if (id) {
      const key =
        name === projectTitlePropertyName
          ? 'title'
          : PROP_NAME_TO_KEY[name as keyof typeof PROP_NAME_TO_KEY]
      if (key && !seenKeys.has(key)) {
        ids[key as keyof ProjectPropertyIds] = id
        seenKeys.add(key)
      }
    }
  }
  return ids
}

export type SyncResult = { success: boolean; projectsSynced?: number; error?: string }

export type ProjectSyncDiagnostic = {
  projectenPropertyIdPro: string | null
  projectIdsFromContacts: number
  projectsFetched: number
  projectsCached: number
  propertyNamesFromSchema: string | null
  error?: string
}

/**
 * Run project sync diagnostic for debugging "No projects found".
 */
export async function getProjectSyncDiagnostic(userId: string): Promise<ProjectSyncDiagnostic> {
  const empty: ProjectSyncDiagnostic = {
    projectenPropertyIdPro: null,
    projectIdsFromContacts: 0,
    projectsFetched: 0,
    projectsCached: 0,
    propertyNamesFromSchema: null,
  }
  try {
    const config = await getPortalConfig()
    setDataSourceOverride(config.contactenDbId, process.env.CONTACTEN_DATA_SOURCE_ID?.trim())
    setDataSourceOverride(config.contactenProDbId, process.env.CONTACTEN_PRO_DATA_SOURCE_ID?.trim())

    const admin = createAdminClient()
    const { data: links } = await admin
      .from('user_entity_link')
      .select('entity_type, entity_notion_id')
      .eq('user_id', userId)
    if (!links?.length) return empty

    const getProjectenPropertyId = async (dbId: string) => {
      for (const name of [config.projectenPropertyName, 'Projecten', 'projecten', 'Project', 'project']) {
        const id = await getPropertyIdByName(dbId, name)
        if (id) return id
      }
      return null
    }
    const contactenProProjectenId = await getProjectenPropertyId(config.contactenProDbId)

    const [, contractorPages] = await Promise.all([
      queryDatabase(config.contactenDbId),
      queryDatabase(config.contactenProDbId),
    ])

    const linkSet = new Set(links.map((l) => `${l.entity_type}:${normalizeNotionId(l.entity_notion_id)}`))
    let projectIdsFromContacts = 0
    for (const page of contractorPages) {
      if (linkSet.has(`contractor:${normalizeNotionId(page.id)}`)) {
        const ids = extractProjectIdsFromPage(page, contactenProProjectenId)
        projectIdsFromContacts += ids.length
      }
    }

    const { count: cachedCount } = await admin
      .from('notion_projects')
      .select('*', { count: 'exact', head: true })

    let propertyNamesFromSchema: string | null = null
    if (!contactenProProjectenId) {
      try {
        const { getDataSourceIdFromDatabase, getDataSourcePropertyNames } = await import(
          '@/lib/notion/client'
        )
        const dsId = await getDataSourceIdFromDatabase(config.contactenProDbId)
        const names = await getDataSourcePropertyNames(dsId)
        if (names.length) propertyNamesFromSchema = names.join(', ')
      } catch {
        /* ignore */
      }
    }

    return {
      projectenPropertyIdPro: contactenProProjectenId,
      projectIdsFromContacts,
      projectsFetched: 0,
      projectsCached: cachedCount ?? 0,
      propertyNamesFromSchema,
    }
  } catch (err: any) {
    return { ...empty, error: err?.message }
  }
}

