import type { NotionPage, NotionProperty } from '@/lib/notion/types'

/**
 * App model for project display.
 * Task 5 will filter columns by role (Customer vs Contractor).
 */
export type AppProject = {
  notionPageId: string
  contactNotionId: string
  contactType: 'customer' | 'contractor'
  status?: string
  adres1?: string
  adres2?: string
  type?: string
  meeting?: string
  contractOndertekend?: string | boolean
  factuurBetaald?: string | boolean
}

/**
 * Map of app field names to Notion property IDs.
 * Resolved from project database schema.
 */
export type ProjectPropertyIds = {
  status?: string | null
  adres1?: string | null
  adres2?: string | null
  type?: string | null
  meeting?: string | null
  contractOndertekend?: string | null
  factuurBetaald?: string | null
}

function extractStringFromProperty(prop: NotionProperty | undefined): string | undefined {
  if (!prop) return undefined
  switch (prop.type) {
    case 'title':
      return prop.title?.map((t) => t.plain_text).join(' ') || undefined
    case 'rich_text':
      return prop.rich_text?.map((t) => t.plain_text).join(' ') || undefined
    case 'select':
      return prop.select?.name ?? undefined
    case 'status':
      return prop.status?.name ?? undefined
    case 'url':
      return prop.url ?? undefined
    case 'number':
      return prop.number != null ? String(prop.number) : undefined
    default:
      return undefined
  }
}

function extractBoolFromProperty(prop: NotionProperty | undefined): boolean | undefined {
  if (!prop) return undefined
  switch (prop.type) {
    case 'checkbox':
      return prop.checkbox
    case 'select':
      return prop.select?.name != null ? true : undefined
    case 'status':
      return prop.status?.name != null ? true : undefined
    default:
      return undefined
  }
}

/**
 * Normalize a Notion project page to AppProject.
 * Uses propertyIds to look up values (resolved from project database schema).
 */
export function notionToAppProject(
  notionPage: NotionPage,
  contactNotionId: string,
  contactType: 'customer' | 'contractor',
  propertyIds: ProjectPropertyIds
): AppProject {
  const props = notionPage.properties
  const get = (id: string | null | undefined) => (id ? props[id] : undefined)

  const result: AppProject = {
    notionPageId: notionPage.id,
    contactNotionId,
    contactType,
  }

  if (propertyIds.status) {
    result.status = extractStringFromProperty(get(propertyIds.status))
  }
  if (propertyIds.adres1) {
    result.adres1 = extractStringFromProperty(get(propertyIds.adres1))
  }
  if (propertyIds.adres2) {
    result.adres2 = extractStringFromProperty(get(propertyIds.adres2))
  }
  if (propertyIds.type) {
    result.type = extractStringFromProperty(get(propertyIds.type))
  }
  if (propertyIds.meeting) {
    result.meeting = extractStringFromProperty(get(propertyIds.meeting))
  }
  if (propertyIds.contractOndertekend) {
    const val = get(propertyIds.contractOndertekend)
    result.contractOndertekend = val?.type === 'checkbox' ? extractBoolFromProperty(val) : extractStringFromProperty(val)
  }
  if (propertyIds.factuurBetaald) {
    const val = get(propertyIds.factuurBetaald)
    result.factuurBetaald = val?.type === 'checkbox' ? extractBoolFromProperty(val) : extractStringFromProperty(val)
  }

  return result
}

/**
 * Convert AppProject to JSON-serializable object for notion_sync_cache.properties_json.
 */
export function appProjectToPropertiesJson(project: AppProject): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (project.status != null) out.status = project.status
  if (project.adres1 != null) out.adres1 = project.adres1
  if (project.adres2 != null) out.adres2 = project.adres2
  if (project.type != null) out.type = project.type
  if (project.meeting != null) out.meeting = project.meeting
  if (project.contractOndertekend != null) out.contractOndertekend = project.contractOndertekend
  if (project.factuurBetaald != null) out.factuurBetaald = project.factuurBetaald
  return out
}
