/**
 * TypeScript types for Notion API responses
 * Based on @notionhq/client types
 */

export type NotionPage = {
  id: string
  created_time: string
  last_edited_time: string
  created_by: {
    object: string
    id: string
  }
  last_edited_by: {
    object: string
    id: string
  }
  cover: any | null
  icon: any | null
  parent: {
    type: string
    database_id?: string
    page_id?: string
  }
  archived: boolean
  properties: Record<string, NotionProperty>
  url: string
}

export type NotionProperty =
  | { type: 'title'; title: Array<{ plain_text: string }> }
  | { type: 'rich_text'; rich_text: Array<{ plain_text: string }> }
  | { type: 'number'; number: number | null }
  | { type: 'select'; select: { id: string; name: string; color: string } | null }
  | { type: 'multi_select'; multi_select: Array<{ id: string; name: string; color: string }> }
  | { type: 'date'; date: { start: string; end: string | null } | null }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'relation'; relation: Array<{ id: string }> }
  | { type: 'people'; people: Array<{ id: string; object: string }> }
  | { type: 'files'; files: Array<any> }
  | { type: 'url'; url: string | null }
  | { type: 'email'; email: string | null }
  | { type: 'phone_number'; phone_number: string | null }
  | { type: 'formula'; formula: any }
  | { type: 'rollup'; rollup: any }
  | { type: 'created_time'; created_time: string }
  | { type: 'created_by'; created_by: { id: string; object: string } }
  | { type: 'last_edited_time'; last_edited_time: string }
  | { type: 'last_edited_by'; last_edited_by: { id: string; object: string } }
  | { type: 'status'; status: { id: string; name: string; color: string } | null }

export type NotionQueryFilter =
  | {
      property: string
      relation?: { contains?: string }
      select?: { equals?: string }
      rich_text?: { equals?: string }
      title?: { equals?: string }
    }
  | {
      and?: NotionQueryFilter[]
      or?: NotionQueryFilter[]
    }
