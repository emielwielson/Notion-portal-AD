import { getPage, setDataSourceOverride } from '@/lib/notion/client'
import { getPortalConfig } from '@/lib/config/portal'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshEntityEmailMapping } from '@/lib/entity-resolver/email-to-entity'
import {
  notionToAppProject,
  appProjectToPropertiesJson,
  type ProjectPropertyIds,
} from '@/lib/utils/notion-to-app'
import { normalizeNotionId } from '@/lib/utils/notion-id'
import type { NotionPage } from '@/lib/notion/types'
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

async function getProjectenPropertyId(
  dbId: string,
  config: { projectenPropertyName: string }
): Promise<string | null> {
  const { getPropertyIdByName } = await import('@/lib/notion/client')
  const names = [
    config.projectenPropertyName,
    'projecten',
    'Projecten',
    'Project',
    'project',
  ]
  for (const name of names) {
    const id = await getPropertyIdByName(dbId, name)
    if (id) return id
  }
  return null
}

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
  if (relation?.length) return relation.map((r) => r.id)
  for (const [, prop] of Object.entries(page.properties)) {
    const p = prop as { type?: string; relation?: Array<{ id: string }> }
    if (p?.type === 'relation' && p.relation?.length) {
      return p.relation.map((r) => r.id)
    }
  }
  return []
}

async function resolveProjectPropertyIds(
  projectDbId: string,
  projectTitlePropertyName?: string
): Promise<ProjectPropertyIds> {
  const { getPropertyIdByName } = await import('@/lib/notion/client')
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

type PageClassification = 'contacten' | 'contacten_pro' | 'project'

function classifyPage(
  parentDbId: string,
  config: { contactenDbId: string; contactenProDbId: string }
): PageClassification {
  const norm = normalizeNotionId(parentDbId)
  const contactenNorm = normalizeNotionId(config.contactenDbId)
  const contactenProNorm = normalizeNotionId(config.contactenProDbId)
  if (norm === contactenNorm) return 'contacten'
  if (norm === contactenProNorm) return 'contacten_pro'
  return 'project'
}

export async function processWebhookPageEvent(
  pageId: string,
  eventType: string
): Promise<void> {
  const config = await getPortalConfig()
  if (!config.contactenDbId || !config.contactenProDbId) {
    console.warn('[Webhook] Missing Contacten database IDs')
    return
  }

  setDataSourceOverride(
    config.contactenDbId,
    process.env.CONTACTEN_DATA_SOURCE_ID?.trim()
  )
  setDataSourceOverride(
    config.contactenProDbId,
    process.env.CONTACTEN_PRO_DATA_SOURCE_ID?.trim()
  )

  const admin = createAdminClient()

  if (eventType === 'page.deleted') {
    await admin.from('notion_contact_project').delete().eq('contact_notion_id', pageId)
    await admin.from('notion_contact_project').delete().eq('project_notion_id', pageId)
    const { data: contact } = await admin
      .from('notion_contacts')
      .select('notion_page_id')
      .eq('notion_page_id', pageId)
      .maybeSingle()
    if (contact) {
      await admin.from('notion_contacts').delete().eq('notion_page_id', pageId)
      await refreshEntityEmailMapping()
    } else {
      await admin.from('notion_projects').delete().eq('notion_page_id', pageId)
    }
    return
  }

  let page: NotionPage
  try {
    page = await getPage(pageId)
  } catch (e) {
    console.warn('[Webhook] Failed to fetch page:', pageId, e)
    return
  }

  const parent = page.parent as { database_id?: string }
  const parentDbId = parent?.database_id
  if (!parentDbId) {
    console.warn('[Webhook] Page has no parent database_id:', pageId)
    return
  }

  const classification = classifyPage(parentDbId, config)
  const now = new Date().toISOString()

  if (classification === 'contacten' || classification === 'contacten_pro') {
    const sourceDb = classification === 'contacten' ? 'contacten' : 'contacten_pro'
    const contactType: EntityType = classification === 'contacten' ? 'customer' : 'contractor'

    await admin.from('notion_contacts').upsert(
      {
        notion_page_id: page.id,
        source_db: sourceDb,
        properties_json: page.properties as unknown as Json,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: 'notion_page_id', ignoreDuplicates: false }
    )

    const dbId = classification === 'contacten' ? config.contactenDbId : config.contactenProDbId
    const projectenId = await getProjectenPropertyId(dbId, config)
    const projIds = extractProjectIdsFromPage(page, projectenId)

    await admin
      .from('notion_contact_project')
      .delete()
      .eq('contact_notion_id', page.id)
      .eq('contact_type', contactType)

    for (const pid of projIds) {
      const norm = normalizeNotionId(pid)
      if (!norm) continue
      await admin.from('notion_contact_project').upsert(
        {
          contact_notion_id: page.id,
          contact_type: contactType,
          project_notion_id: norm,
        },
        { onConflict: 'contact_notion_id,contact_type,project_notion_id', ignoreDuplicates: false }
      )
    }

    await refreshEntityEmailMapping()
    return
  }

  if (classification === 'project') {
    const projectDbId = normalizeNotionId(parentDbId)
    const propertyIds = await resolveProjectPropertyIds(
      projectDbId,
      config.projectTitlePropertyName
    )

    const project = notionToAppProject(
      page,
      '',
      'customer',
      propertyIds
    )
    const propertiesJson = appProjectToPropertiesJson(project)

    await admin.from('notion_projects').upsert(
      {
        notion_page_id: page.id,
        properties_json: propertiesJson as Json,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: 'notion_page_id', ignoreDuplicates: false }
    )
  }
}
