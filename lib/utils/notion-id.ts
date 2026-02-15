/**
 * Normalize a Notion ID to the dashed UUID format expected by the Notion API.
 * Notion URLs use 32 hex chars without dashes; the API expects 8-4-4-4-12.
 */
export function normalizeNotionId(id: string | null | undefined): string {
  if (!id || typeof id !== 'string') return ''
  const trimmed = id.trim().replace(/-/g, '')
  if (trimmed.length !== 32 || !/^[0-9a-fA-F]+$/.test(trimmed)) {
    return id
  }
  return `${trimmed.slice(0, 8)}-${trimmed.slice(8, 12)}-${trimmed.slice(12, 16)}-${trimmed.slice(16, 20)}-${trimmed.slice(20, 32)}`
}
