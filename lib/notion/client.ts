import { Client } from '@notionhq/client'
import { normalizeNotionId } from '@/lib/utils/notion-id'
import { NotionPage, NotionQueryFilter } from './types'

let notionClient: Client | null = null

function getClient(): Client {
  if (!notionClient) {
    const raw =
      process.env.NOTION_API_KEY?.trim() || process.env.NOTION_TOKEN?.trim()
    if (!raw) {
      throw new Error(
        'Notion API key missing. Set NOTION_API_KEY (or NOTION_TOKEN) in .env.local'
      )
    }
    if (!raw.startsWith('secret_') && !raw.startsWith('ntn_')) {
      throw new Error(
        'Invalid Notion API key format. Use internal integration secret (secret_ or ntn_)'
      )
    }
    notionClient = new Client({
      auth: raw,
      notionVersion: '2025-09-03',
    })
  }
  return notionClient
}

const DATA_SOURCE_OVERRIDES: Record<string, string> = {}

function getDataSourceOverride(dbId: string): string | null {
  const id = normalizeNotionId(dbId)
  return DATA_SOURCE_OVERRIDES[id] ?? null
}

/**
 * Register data source IDs from env (CONTACTEN_DATA_SOURCE_ID, CONTACTEN_PRO_DATA_SOURCE_ID)
 */
export function setDataSourceOverride(databaseId: string, dataSourceId: string | undefined) {
  if (!dataSourceId?.trim()) return
  const id = normalizeNotionId(databaseId)
  if (id) DATA_SOURCE_OVERRIDES[id] = dataSourceId.trim()
}

export async function getDataSourceIdFromDatabase(databaseId: string): Promise<string> {
  const override = getDataSourceOverride(databaseId)
  if (override) return override

  const client = getClient()
  const normalizedId = normalizeNotionId(databaseId)
  const database = await client.databases.retrieve({ database_id: normalizedId })
  const dataSources = (database as any).data_sources

  if (Array.isArray(dataSources) && dataSources.length > 0) {
    return dataSources[0].id
  }
  if ((database as any).data_source_id) {
    return (database as any).data_source_id
  }
  throw new Error(
    `No data source for database ${normalizedId}. Set CONTACTEN_DATA_SOURCE_ID / CONTACTEN_PRO_DATA_SOURCE_ID in .env.local (from Notion → ••• → Manage data sources → Copy data source ID).`
  )
}

export async function queryDatabase(
  databaseId: string,
  filter?: NotionQueryFilter
): Promise<NotionPage[]> {
  const client = getClient()
  const normalizedId = normalizeNotionId(databaseId)
  const dataSourceId = await getDataSourceIdFromDatabase(normalizedId)
  const pages: NotionPage[] = []
  let cursor: string | undefined = undefined

  do {
    try {
      const response = await (client as any).dataSources.query({
        data_source_id: dataSourceId,
        filter: filter ?? undefined,
        start_cursor: cursor,
      })
      pages.push(...(response.results || []))
      cursor = response.next_cursor ?? undefined
      if (cursor) await new Promise((r) => setTimeout(r, 350))
    } catch (error: any) {
      if (error.code === 'rate_limit_exceeded') {
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      throw error
    }
  } while (cursor)

  return pages
}

export async function getPage(pageId: string): Promise<NotionPage> {
  const client = getClient()
  const response = await client.pages.retrieve({ page_id: pageId })
  return response as NotionPage
}

export async function getPropertyIdByName(
  databaseId: string,
  propertyName: string
): Promise<string | null> {
  const client = getClient()
  const normalizedId = normalizeNotionId(databaseId)
  const dataSourceId = await getDataSourceIdFromDatabase(normalizedId)

  const dataSource = await (client as any).dataSources.retrieve({
    data_source_id: dataSourceId,
  })
  const props = dataSource?.properties
  if (!props) return null

  for (const [id, def] of Object.entries(props)) {
    if ((def as any).name?.toLowerCase() === propertyName.toLowerCase()) {
      return id
    }
  }
  return null
}
