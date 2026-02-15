'use server'

import {
  queryDatabase,
  getPage,
  getPropertyIdByName,
  setDataSourceOverride,
} from '@/lib/notion/client'
import type { NotionPage } from '@/lib/notion/types'
import { refreshEntityEmailMapping, refreshUserEntityLink } from '@/lib/entity-resolver/email-to-entity'
import { getPortalConfig } from '@/lib/config/portal'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertProjectCache } from './cache'
import {
  notionToAppProject,
  appProjectToPropertiesJson,
  type ProjectPropertyIds,
} from '@/lib/utils/notion-to-app'
import { normalizeNotionId } from '@/lib/utils/notion-id'
import type { EntityType } from '@/types/database'

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
      .from('notion_sync_cache')
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

/**
 * Sync projects from Notion into notion_sync_cache for the current user's contacts.
 * Call after refreshEntityEmailMapping and refreshUserEntityLink.
 */
export async function syncProjects(
  userId: string,
  email: string
): Promise<SyncResult> {
  try {
    const config = await getPortalConfig()
    if (!config.contactenDbId || !config.contactenProDbId) {
      return { success: false, error: 'Missing Contacten database IDs' }
    }

    setDataSourceOverride(config.contactenDbId, process.env.CONTACTEN_DATA_SOURCE_ID?.trim())
    setDataSourceOverride(config.contactenProDbId, process.env.CONTACTEN_PRO_DATA_SOURCE_ID?.trim())

    await refreshEntityEmailMapping()
    await refreshUserEntityLink(userId, email)

    const admin = createAdminClient()
    const { data: links } = await admin
      .from('user_entity_link')
      .select('entity_type, entity_notion_id')
      .eq('user_id', userId)

    if (!links || links.length === 0) {
      return { success: true, projectsSynced: 0 }
    }

    const envProjectenId = process.env.PROJECTEN_PROPERTY_ID?.trim()
      ? (() => {
          try {
            return decodeURIComponent(process.env.PROJECTEN_PROPERTY_ID!.trim())
          } catch {
            return process.env.PROJECTEN_PROPERTY_ID!.trim()
          }
        })()
      : null
    const projectenNames = [
      config.projectenPropertyName,
      'projecten',
      'Projecten',
      'Project',
      'project',
      'Projects',
    ]
    const getProjectenPropertyId = async (dbId: string) => {
      if (envProjectenId) return envProjectenId
      for (const name of projectenNames) {
        const id = await getPropertyIdByName(dbId, name)
        if (id) return id
      }
      return null
    }
    const contactenProjectenId = await getProjectenPropertyId(config.contactenDbId)
    const contactenProProjectenId = await getProjectenPropertyId(config.contactenProDbId)

    const [customerPages, contractorPages] = await Promise.all([
      queryDatabase(config.contactenDbId),
      queryDatabase(config.contactenProDbId),
    ])

    const linkSet = new Set(links.map((l) => `${l.entity_type}:${normalizeNotionId(l.entity_notion_id)}`))
    const contactsToSync: { contactNotionId: string; contactType: EntityType; page: NotionPage }[] = []

    for (const page of customerPages) {
      if (linkSet.has(`customer:${normalizeNotionId(page.id)}`)) {
        contactsToSync.push({ contactNotionId: page.id, contactType: 'customer', page })
      }
    }
    for (const page of contractorPages) {
      if (linkSet.has(`contractor:${normalizeNotionId(page.id)}`)) {
        contactsToSync.push({ contactNotionId: page.id, contactType: 'contractor', page })
      }
    }

    const projectenIdByType = {
      customer: contactenProjectenId,
      contractor: contactenProProjectenId,
    }

    const projectIdsWithContact = new Map<
      string,
      { contactNotionId: string; contactType: EntityType }[]
    >()

    for (const { contactNotionId, contactType, page } of contactsToSync) {
      const projIds = extractProjectIdsFromPage(
        page,
        projectenIdByType[contactType]
      )
      for (const pid of projIds) {
        const norm = normalizeNotionId(pid)
        if (!norm) continue
        const arr = projectIdsWithContact.get(norm) ?? []
        arr.push({ contactNotionId, contactType })
        projectIdsWithContact.set(norm, arr)
      }
    }

    const uniqueProjectIds = [...projectIdsWithContact.keys()]
    if (uniqueProjectIds.length === 0) {
      return { success: true, projectsSynced: 0 }
    }

    const BATCH_SIZE = 5
    const projectPages: NotionPage[] = []
    for (let i = 0; i < uniqueProjectIds.length; i += BATCH_SIZE) {
      const batch = uniqueProjectIds.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (pid) => {
          try {
            return await getPage(pid)
          } catch (e) {
            console.warn('[Sync] Failed to fetch project page:', pid, e)
            return null
          }
        })
      )
      projectPages.push(...results.filter((p): p is NotionPage => p != null))
      if (i + BATCH_SIZE < uniqueProjectIds.length) {
        await new Promise((r) => setTimeout(r, 150))
      }
    }

    let projectDbId: string | null = null
    for (const p of projectPages) {
      const parent = (p.parent as any)
      if (parent?.database_id) {
        projectDbId = normalizeNotionId(parent.database_id)
        break
      }
    }

    const propertyIds: ProjectPropertyIds = projectDbId
      ? await resolveProjectPropertyIds(projectDbId, config.projectTitlePropertyName)
      : {}

    let count = 0
    for (const notionPage of projectPages) {
      const normId = normalizeNotionId(notionPage.id)
      const contacts = projectIdsWithContact.get(normId)
      if (!contacts) continue

      for (const { contactNotionId, contactType } of contacts) {
        const project = notionToAppProject(
          notionPage,
          contactNotionId,
          contactType,
          propertyIds
        )
        const propertiesJson = appProjectToPropertiesJson(project)
        await upsertProjectCache(contactNotionId, contactType, notionPage.id, propertiesJson)
        count++
      }
    }

    return { success: true, projectsSynced: count }
  } catch (err: any) {
    console.error('[Sync] syncProjects error:', err)
    return { success: false, error: err?.message || 'Sync failed' }
  }
}
