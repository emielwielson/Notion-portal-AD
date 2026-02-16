'use server'

import {
  queryDatabase,
  getPage,
  getPropertyIdByName,
  setDataSourceOverride,
} from '@/lib/notion/client'
import type { NotionPage } from '@/lib/notion/types'
import {
  refreshEntityEmailMapping,
  refreshUserEntityLink,
} from '@/lib/entity-resolver/email-to-entity'
import { getPortalConfig } from '@/lib/config/portal'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  notionToAppProject,
  appProjectToPropertiesJson,
  type ProjectPropertyIds,
} from '@/lib/utils/notion-to-app'
import { normalizeNotionId } from '@/lib/utils/notion-id'
import type { EntityType } from '@/types/database'
import type { Json } from '@/types/database'

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

export type SyncResult = {
  success: boolean
  projectsSynced?: number
  contactsSynced?: number
  relationsSynced?: number
  error?: string
}

/**
 * Full sync: populate notion_contacts, notion_projects, notion_contact_project.
 * Replaces relations (delete + insert) to reflect removals correctly.
 */
export async function syncMirror(
  userId: string,
  email: string
): Promise<SyncResult> {
  try {
    const config = await getPortalConfig()
    if (!config.contactenDbId || !config.contactenProDbId) {
      return { success: false, error: 'Missing Contacten database IDs' }
    }

    setDataSourceOverride(
      config.contactenDbId,
      process.env.CONTACTEN_DATA_SOURCE_ID?.trim()
    )
    setDataSourceOverride(
      config.contactenProDbId,
      process.env.CONTACTEN_PRO_DATA_SOURCE_ID?.trim()
    )

    await refreshEntityEmailMapping()
    await refreshUserEntityLink(userId, email)

    const admin = createAdminClient()

    const envProjectenId = process.env.PROJECTEN_PROPERTY_ID?.trim()
      ? (() => {
          try {
            return decodeURIComponent(
              process.env.PROJECTEN_PROPERTY_ID!.trim()
            )
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
    const contactenProjectenId = await getProjectenPropertyId(
      config.contactenDbId
    )
    const contactenProProjectenId = await getProjectenPropertyId(
      config.contactenProDbId
    )

    const [customerPages, contractorPages] = await Promise.all([
      queryDatabase(config.contactenDbId),
      queryDatabase(config.contactenProDbId),
    ])

    const now = new Date().toISOString()

    // 1. Contacts: upsert ALL from both DBs
    let contactsSynced = 0
    for (const page of customerPages) {
      const { error } = await admin
        .from('notion_contacts')
        .upsert(
          {
            notion_page_id: page.id,
            source_db: 'contacten',
            properties_json: page.properties as unknown as Json,
            last_synced_at: now,
            updated_at: now,
          },
          {
            onConflict: 'notion_page_id',
            ignoreDuplicates: false,
          }
        )
      if (!error) contactsSynced++
    }
    for (const page of contractorPages) {
      const { error } = await admin
        .from('notion_contacts')
        .upsert(
          {
            notion_page_id: page.id,
            source_db: 'contacten_pro',
            properties_json: page.properties as unknown as Json,
            last_synced_at: now,
            updated_at: now,
          },
          {
            onConflict: 'notion_page_id',
            ignoreDuplicates: false,
          }
        )
      if (!error) contactsSynced++
    }

    // 2. Relations: for each contact, delete existing and insert current
    const projectenIdByType = {
      customer: contactenProjectenId,
      contractor: contactenProProjectenId,
    }

    const allContacts: { page: NotionPage; contactType: EntityType }[] = [
      ...customerPages.map((p) => ({ page: p, contactType: 'customer' as const })),
      ...contractorPages.map((p) => ({
        page: p,
        contactType: 'contractor' as const,
      })),
    ]

    const projectIdsWithContact = new Map<
      string,
      { contactNotionId: string; contactType: EntityType }[]
    >()

    let relationsSynced = 0
    for (const { page, contactType } of allContacts) {
      const projectenId = projectenIdByType[contactType]
      const projIds = extractProjectIdsFromPage(page, projectenId)

      await admin
        .from('notion_contact_project')
        .delete()
        .eq('contact_notion_id', page.id)
        .eq('contact_type', contactType)

      for (const pid of projIds) {
        const norm = normalizeNotionId(pid)
        if (!norm) continue

        const { error } = await admin
          .from('notion_contact_project')
          .upsert(
            {
              contact_notion_id: page.id,
              contact_type: contactType,
              project_notion_id: norm,
            },
            {
              onConflict: 'contact_notion_id,contact_type,project_notion_id',
              ignoreDuplicates: false,
            }
          )
        if (!error) relationsSynced++

        const arr = projectIdsWithContact.get(norm) ?? []
        if (!arr.some((c) => c.contactNotionId === page.id && c.contactType === contactType)) {
          arr.push({ contactNotionId: page.id, contactType })
          projectIdsWithContact.set(norm, arr)
        }
      }
    }

    const uniqueProjectIds = [...projectIdsWithContact.keys()]
    if (uniqueProjectIds.length === 0) {
      return {
        success: true,
        contactsSynced,
        relationsSynced,
        projectsSynced: 0,
      }
    }

    // 3. Projects: fetch and upsert
    const BATCH_SIZE = 5
    const projectPages: NotionPage[] = []
    for (let i = 0; i < uniqueProjectIds.length; i += BATCH_SIZE) {
      const batch = uniqueProjectIds.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (pid) => {
          try {
            return await getPage(pid)
          } catch (e) {
            console.warn('[MirrorSync] Failed to fetch project page:', pid, e)
            return null
          }
        })
      )
      projectPages.push(
        ...results.filter((p): p is NotionPage => p != null)
      )
      if (i + BATCH_SIZE < uniqueProjectIds.length) {
        await new Promise((r) => setTimeout(r, 150))
      }
    }

    let projectDbId: string | null = null
    for (const p of projectPages) {
      const parent = p.parent as { database_id?: string }
      if (parent?.database_id) {
        projectDbId = normalizeNotionId(parent.database_id)
        break
      }
    }

    const propertyIds: ProjectPropertyIds = projectDbId
      ? await resolveProjectPropertyIds(
          projectDbId,
          config.projectTitlePropertyName
        )
      : {}

    let projectsSynced = 0
    for (const notionPage of projectPages) {
      const normId = normalizeNotionId(notionPage.id)
      const contacts = projectIdsWithContact.get(normId)
      const contactType: EntityType = contacts?.[0]?.contactType ?? 'customer'
      const contactNotionId = contacts?.[0]?.contactNotionId ?? ''

      const project = notionToAppProject(
        notionPage,
        contactNotionId,
        contactType,
        propertyIds
      )
      const propertiesJson = appProjectToPropertiesJson(project)

      const { error } = await admin
        .from('notion_projects')
        .upsert(
          {
            notion_page_id: notionPage.id,
            properties_json: propertiesJson as Json,
            last_synced_at: now,
            updated_at: now,
          },
          {
            onConflict: 'notion_page_id',
            ignoreDuplicates: false,
          }
        )
      if (!error) projectsSynced++
    }

    return {
      success: true,
      contactsSynced,
      relationsSynced,
      projectsSynced,
    }
  } catch (err: any) {
    console.error('[MirrorSync] syncMirror error:', err)
    return { success: false, error: err?.message || 'Sync failed' }
  }
}
