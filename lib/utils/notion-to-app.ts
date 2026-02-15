import type { NotionPage, NotionProperty } from '@/lib/notion/types'

/**
 * App model for project display.
 * Task 5 will filter columns by role (Customer vs Contractor).
 */
export type AppProject = {
  notionPageId: string
  contactNotionId: string
  contactType: 'customer' | 'contractor'
  title?: string
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
  title?: string | null
  status?: string | null
  adres1?: string | null
  adres2?: string | null
  type?: string | null
  meeting?: string | null
  contractOndertekend?: string | null
  factuurBetaald?: string | null
}

function extractTextFromRichTextArray(arr: unknown): string {
  if (!Array.isArray(arr)) return ''
  return arr
    .map((t: unknown) => {
      if (!t || typeof t !== 'object') return ''
      const o = t as Record<string, unknown>
      if (typeof o.plain_text === 'string') return o.plain_text
      if (o.text && typeof o.text === 'object') {
        const content = (o.text as { content?: string }).content
        if (typeof content === 'string') return content
      }
      if (typeof o.content === 'string') return o.content
      return ''
    })
    .join(' ')
    .trim()
}

function extractStringFromProperty(prop: NotionProperty | Record<string, unknown> | undefined): string | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const p = prop as Record<string, unknown>
  if (Array.isArray(p.title)) return extractTextFromRichTextArray(p.title) || undefined
  if (p.place && typeof p.place === 'object') {
    const place = p.place as Record<string, unknown>
    const addr = place.address ?? place.name
    if (typeof addr === 'string') return addr
  }
  switch (p.type) {
    case 'title':
      if (Array.isArray(p.title)) return extractTextFromRichTextArray(p.title) || undefined
      return undefined
    case 'rich_text':
      if (Array.isArray(p.rich_text)) return extractTextFromRichTextArray(p.rich_text) || undefined
      return undefined
    case 'select':
      return (p.select as { name?: string })?.name ?? undefined
    case 'status':
      return (p.status as { name?: string })?.name ?? undefined
    case 'url':
    case 'email':
      return typeof p.url === 'string' ? p.url : typeof p.email === 'string' ? (p as { email: string }).email : undefined
    case 'number':
      return p.number != null ? String(p.number) : undefined
    case 'place': {
      const place = p.place as { address?: string; name?: string } | undefined
      return place?.address ?? place?.name ?? undefined
    }
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

function getProp(props: Record<string, unknown>, id: string | null | undefined): unknown {
  if (!id) return undefined
  if (props[id]) return props[id]
  try {
    const decoded = decodeURIComponent(id)
    if (decoded !== id && props[decoded]) return props[decoded]
  } catch {
    /* ignore */
  }
  for (const [key, val] of Object.entries(props)) {
    try {
      if (decodeURIComponent(key) === id || key === id) return val
    } catch {
      /* ignore */
    }
  }
  return undefined
}

/** Fallback: try property by name (keys might be names in some API responses) */
function getByKeyOrName(props: Record<string, unknown>, keysToTry: string[]): unknown {
  for (const k of keysToTry) {
    if (props[k]) return props[k]
  }
  for (const key of Object.keys(props)) {
    if (keysToTry.some((k) => key.toLowerCase() === k.toLowerCase())) return props[key]
  }
  return undefined
}

/** Find first property of given type (e.g. 'title' for database page names) */
function findPropByType(props: Record<string, unknown>, type: string): unknown {
  for (const val of Object.values(props)) {
    if (val && typeof val === 'object' && (val as Record<string, unknown>).type === type) {
      return val
    }
  }
  return undefined
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
  const props = notionPage.properties as Record<string, unknown>

  const get = (id: string | null | undefined) => getProp(props, id) as NotionProperty | undefined

  const result: AppProject = {
    notionPageId: notionPage.id,
    contactNotionId,
    contactType,
  }

  // Notion API returns properties keyed by name (e.g. "Naam"), not ID – try name first
  const titleProp =
    getByKeyOrName(props, ['Naam', 'Name', 'title', 'Title', 'Project']) ??
    (process.env.PROJECT_TITLE_PROPERTY_ID && get(process.env.PROJECT_TITLE_PROPERTY_ID.trim())) ??
    get(propertyIds.title) ??
    findPropByType(props, 'title')
  result.title = extractStringFromProperty(titleProp as NotionProperty)

  if (!result.title) {
    for (const val of Object.values(props)) {
      if (val && typeof val === 'object') {
        const v = val as Record<string, unknown>
        if (Array.isArray(v.title)) {
          const t = extractTextFromRichTextArray(v.title)
          if (t) {
            result.title = t
            break
          }
        }
      }
    }
  }

  result.status =
    extractStringFromProperty(get(propertyIds.status)) ??
    extractStringFromProperty(getByKeyOrName(props, ['Status', 'status']) as NotionProperty)

  result.adres1 =
    extractStringFromProperty(getByKeyOrName(props, ['Adres 1', 'adres1', 'Adres1']) as NotionProperty) ??
    extractStringFromProperty(get(propertyIds.adres1))

  result.adres2 =
    extractStringFromProperty(getByKeyOrName(props, ['Adres 2', 'adres2', 'Adres2']) as NotionProperty) ??
    extractStringFromProperty(get(propertyIds.adres2))

  result.type =
    extractStringFromProperty(get(propertyIds.type)) ??
    extractStringFromProperty(getByKeyOrName(props, ['Type', 'type']) as NotionProperty)

  const meetingVal = get(propertyIds.meeting) ?? getByKeyOrName(props, ['Meeting', 'meeting'])
  result.meeting = extractStringFromProperty(meetingVal as NotionProperty)

  const coVal = get(propertyIds.contractOndertekend) ?? getByKeyOrName(props, ['Contract ondertekend', 'contract ondertekend'])
  if (coVal) {
    result.contractOndertekend =
      (coVal as { type?: string }).type === 'checkbox'
        ? extractBoolFromProperty(coVal as NotionProperty)
        : extractStringFromProperty(coVal as NotionProperty)
  }

  const fbVal = get(propertyIds.factuurBetaald) ?? getByKeyOrName(props, ['Factuur betaald', 'factuur betaald'])
  if (fbVal) {
    result.factuurBetaald =
      (fbVal as { type?: string }).type === 'checkbox'
        ? extractBoolFromProperty(fbVal as NotionProperty)
        : extractStringFromProperty(fbVal as NotionProperty)
  }

  return result
}

/**
 * Convert AppProject to JSON-serializable object for notion_sync_cache.properties_json.
 */
export function appProjectToPropertiesJson(project: AppProject): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (project.title != null) out.title = project.title
  if (project.status != null) out.status = project.status
  if (project.adres1 != null) out.adres1 = project.adres1
  if (project.adres2 != null) out.adres2 = project.adres2
  if (project.type != null) out.type = project.type
  if (project.meeting != null) out.meeting = project.meeting
  if (project.contractOndertekend != null) out.contractOndertekend = project.contractOndertekend
  if (project.factuurBetaald != null) out.factuurBetaald = project.factuurBetaald
  return out
}
