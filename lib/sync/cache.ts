import { createAdminClient } from '@/lib/supabase/admin'
import type { EntityType, Json } from '@/types/database'

/**
 * @deprecated Use mirror-sync.ts and notion_projects/notion_contact_project instead.
 * Upsert a project into notion_sync_cache.
 * Uses on conflict to update last_synced_at and properties_json when row exists.
 */
export async function upsertProjectCache(
  contactNotionId: string,
  contactType: EntityType,
  notionPageId: string,
  propertiesJson: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('notion_sync_cache')
    .upsert(
      {
        contact_notion_id: contactNotionId,
        contact_type: contactType,
        notion_page_id: notionPageId,
        properties_json: propertiesJson as Json,
        last_synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'contact_notion_id,contact_type,notion_page_id',
        ignoreDuplicates: false,
      }
    )

  if (error) {
    throw new Error(`Failed to upsert notion_sync_cache: ${error.message}`)
  }
}
