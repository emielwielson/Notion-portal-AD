'use server'

import {
  queryDatabase,
  getPropertyIdByName,
  setDataSourceOverride,
} from '@/lib/notion/client'
import { extractEmailsFromPage } from './extract-emails'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { EntityType } from '@/types/database'

export type UserEntity = { entityType: EntityType; entityNotionId: string }

/**
 * Fetch portal config from Supabase or use env fallbacks
 * Env vars (CONTACTEN_DB_ID, CONTACTEN_PRO_DB_ID) take precedence over portal_config
 * so .env.local always wins for local development.
 */
async function getPortalConfig() {
  const supabase = await createClient()
  const { data } = await supabase.from('portal_config').select('*').limit(1).single()

  return {
    contactenDbId: process.env.CONTACTEN_DB_ID?.trim() || data?.contacten_db_id || '',
    contactenProDbId: process.env.CONTACTEN_PRO_DB_ID?.trim() || data?.contacten_pro_db_id || '',
    emailPropertyName: data?.email_property_name || process.env.EMAIL_PROPERTY_NAME || 'Email',
  }
}

/**
 * Refresh entity_email_mapping from Notion Contacten and Contacten (pro)
 */
export async function refreshEntityEmailMapping(): Promise<{ count: number; error?: string }> {
  try {
    const config = await getPortalConfig()
    if (!config.contactenDbId || !config.contactenProDbId) {
      return { count: 0, error: 'Missing Contacten database IDs in portal_config or env' }
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
    let totalCount = 0

    const contactenEmailId = await getPropertyIdByName(config.contactenDbId, config.emailPropertyName)
    const contactenProEmailId = await getPropertyIdByName(config.contactenProDbId, config.emailPropertyName)

    const [customerPages, contractorPages] = await Promise.all([
      queryDatabase(config.contactenDbId),
      queryDatabase(config.contactenProDbId),
    ])

    const mappings: { email: string; entity_type: EntityType; entity_notion_id: string }[] = []

    for (const page of customerPages) {
      const emails = extractEmailsFromPage(page, contactenEmailId)
      for (const email of emails) {
        mappings.push({ email, entity_type: 'customer', entity_notion_id: page.id })
      }
    }

    for (const page of contractorPages) {
      const emails = extractEmailsFromPage(page, contactenProEmailId)
      for (const email of emails) {
        mappings.push({ email, entity_type: 'contractor', entity_notion_id: page.id })
      }
    }

    if (mappings.length === 0) {
      return { count: 0 }
    }

    await admin.from('entity_email_mapping').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { error } = await admin.from('entity_email_mapping').insert(
      mappings.map((m) => ({
        email: m.email,
        entity_type: m.entity_type,
        entity_notion_id: m.entity_notion_id,
      }))
    )

    if (error) {
      return { count: 0, error: error.message }
    }

    return { count: mappings.length }
  } catch (err: any) {
    console.error('[Entity Resolver] refreshEntityEmailMapping error:', err)
    return { count: 0, error: err.message || 'Failed to refresh entity mapping' }
  }
}

/**
 * Refresh user_entity_link for a user from entity_email_mapping
 */
export async function refreshUserEntityLink(
  userId: string,
  email: string
): Promise<{ count: number; error?: string }> {
  try {
    const admin = createAdminClient()

    await admin.from('user_entity_link').delete().eq('user_id', userId)

    const { data: mappings } = await admin
      .from('entity_email_mapping')
      .select('entity_type, entity_notion_id')
      .eq('email', email.toLowerCase())

    if (!mappings || mappings.length === 0) {
      return { count: 0 }
    }

    const { error } = await admin.from('user_entity_link').insert(
      mappings.map((m) => ({
        user_id: userId,
        entity_type: m.entity_type,
        entity_notion_id: m.entity_notion_id,
      }))
    )

    if (error) {
      return { count: 0, error: error.message }
    }

    return { count: mappings.length }
  } catch (err: any) {
    console.error('[Entity Resolver] refreshUserEntityLink error:', err)
    return { count: 0, error: err.message || 'Failed to refresh user entity link' }
  }
}

/**
 * Get user entities for an email (from entity_email_mapping)
 */
export async function getUserEntities(email: string): Promise<UserEntity[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('entity_email_mapping')
    .select('entity_type, entity_notion_id')
    .eq('email', email.toLowerCase())

  return (data || []).map((r) => ({
    entityType: r.entity_type,
    entityNotionId: r.entity_notion_id,
  }))
}
