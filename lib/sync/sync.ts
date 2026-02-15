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
  'Status',
  'Adres 1',
  'Adres 2',
  'Type',
  'Meeting',
  'Contract ondertekend',
  'Factuur betaald',
] as const

function extractProjectIdsFromPage(
  page: NotionPage,
  projectenPropertyId: string | null
): string[] {
  if (!projectenPropertyId) return []
  const prop = page.properties[projectenPropertyId]
  if (!prop || prop.type !== 'relation') return []
  return (prop.relation || []).map((r) => r.id)
}

const PROP_NAME_TO_KEY: Record<string, keyof ProjectPropertyIds> = {
  Status: 'status',
  'Adres 1': 'adres1',
  'Adres 2': 'adres2',
  Type: 'type',
  Meeting: 'meeting',
  'Contract ondertekend': 'contractOndertekend',
  'Factuur betaald': 'factuurBetaald',
}

async function resolveProjectPropertyIds(projectDbId: string): Promise<ProjectPropertyIds> {
  const ids: ProjectPropertyIds = {}
  for (const name of PROJECT_PROPERTY_NAMES) {
    const id = await getPropertyIdByName(projectDbId, name)
    if (id) {
      const key = PROP_NAME_TO_KEY[name]
      if (key) ids[key] = id
    }
  }
  return ids
}

export type SyncResult = { success: boolean; projectsSynced?: number; error?: string }

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

    const contactenProjectenId = await getPropertyIdByName(
      config.contactenDbId,
      config.projectenPropertyName
    )
    const contactenProProjectenId = await getPropertyIdByName(
      config.contactenProDbId,
      config.projectenPropertyName
    )

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

    const projectPages: NotionPage[] = []
    for (const pid of uniqueProjectIds) {
      try {
        const p = await getPage(pid)
        projectPages.push(p)
      } catch (e) {
        console.warn('[Sync] Failed to fetch project page:', pid, e)
      }
      await new Promise((r) => setTimeout(r, 200))
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
      ? await resolveProjectPropertyIds(projectDbId)
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
