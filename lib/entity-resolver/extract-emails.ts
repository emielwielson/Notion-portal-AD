import { NotionPage } from '@/lib/notion/types'

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

function extractEmailsFromString(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || []
  return [...new Set(matches.map((e) => e.toLowerCase().trim()))]
}

/**
 * Extract email addresses from a Notion page property
 * Handles email, rich_text, and multi_select types
 */
export function extractEmailsFromPage(
  page: NotionPage,
  emailPropertyId: string | null
): string[] {
  if (!emailPropertyId) return []

  const prop = page.properties[emailPropertyId]
  if (!prop) return []

  const emails: string[] = []

  switch (prop.type) {
    case 'email':
      if (prop.email) {
        emails.push(prop.email.toLowerCase().trim())
      }
      break

    case 'rich_text':
      const richText = prop.rich_text?.map((t) => t.plain_text).join(' ') || ''
      emails.push(...extractEmailsFromString(richText))
      break

    case 'multi_select':
      for (const opt of prop.multi_select || []) {
        const text = opt.name
        if (text.includes('@')) {
          emails.push(...extractEmailsFromString(text))
        } else {
          emails.push(text.toLowerCase().trim())
        }
      }
      break

    case 'title':
      const title = prop.title?.map((t) => t.plain_text).join(' ') || ''
      emails.push(...extractEmailsFromString(title))
      break

    default:
      break
  }

  return [...new Set(emails)].filter((e) => e.length > 0)
}
