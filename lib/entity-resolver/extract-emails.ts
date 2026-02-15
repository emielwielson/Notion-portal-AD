import type { NotionPage, NotionProperty } from '@/lib/notion/types'

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

function extractEmailsFromString(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || []
  return [...new Set(matches.map((e) => e.toLowerCase().trim()))]
}

function getProp(page: NotionPage, id: string): NotionProperty | undefined {
  if (page.properties[id]) return page.properties[id] as NotionProperty
  try {
    const decoded = decodeURIComponent(id)
    if (decoded !== id && page.properties[decoded]) return page.properties[decoded] as NotionProperty
  } catch {
    /* ignore */
  }
  try {
    const encoded = encodeURIComponent(id)
    if (encoded !== id && page.properties[encoded]) return page.properties[encoded] as NotionProperty
  } catch {
    /* ignore */
  }
  return undefined
}

function extractFromProp(prop: NotionProperty | Record<string, unknown>): string[] {
  if (!prop || typeof prop !== 'object') return []
  const emails: string[] = []
  const p = prop as Record<string, unknown>

  switch (p.type) {
    case 'email':
      if (typeof p.email === 'string') emails.push(p.email.toLowerCase().trim())
      break
    case 'rich_text':
      const richText = Array.isArray(p.rich_text)
        ? (p.rich_text as { plain_text?: string }[]).map((t) => t.plain_text ?? '').join(' ')
        : ''
      emails.push(...extractEmailsFromString(richText))
      break
    case 'multi_select':
      for (const opt of (p.multi_select as { name: string }[]) || []) {
        const text = opt.name
        emails.push(...(text.includes('@') ? extractEmailsFromString(text) : [text.toLowerCase().trim()]))
      }
      break
    case 'title':
      const title = Array.isArray(p.title)
        ? (p.title as { plain_text?: string }[]).map((t) => t.plain_text ?? '').join(' ')
        : ''
      emails.push(...extractEmailsFromString(title))
      break
    case 'url':
      if (typeof p.url === 'string') emails.push(...extractEmailsFromString(p.url))
      break
    case 'formula':
      const f = p.formula as { string?: string } | undefined
      if (f?.string) emails.push(...extractEmailsFromString(f.string))
      break
    case 'phone_number':
      if (typeof p.phone_number === 'string') emails.push(...extractEmailsFromString(p.phone_number))
      break
    default:
      break
  }
  return [...new Set(emails)].filter((e) => e.length > 0)
}

export function extractEmailsFromPage(
  page: NotionPage,
  emailPropertyId: string | null
): string[] {
  if (emailPropertyId) {
    const prop = getProp(page as NotionPage, emailPropertyId)
    if (prop) {
      const result = extractFromProp(prop)
      if (result.length > 0) return result
    }
  }

  for (const [, prop] of Object.entries(page.properties)) {
    const result = extractFromProp(prop as NotionProperty)
    if (result.length > 0) return result
  }
  return []
}
