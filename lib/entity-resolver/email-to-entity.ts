'use server'

import {
  queryDatabase,
  getPropertyIdByName,
  setDataSourceOverride,
} from '@/lib/notion/client'
import { getPortalConfig } from '@/lib/config/portal'
import { extractEmailsFromPage } from './extract-emails'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EntityType } from '@/types/database'

export type UserEntity = { entityType: EntityType; entityNotionId: string }

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

    const EMAIL_PROPERTY_FALLBACKS = [
      config.emailPropertyName,
      'Email',
      'E-mail',
      'E-mailadres',
      'email',
    ]
    const rawEnvId = process.env.EMAIL_PROPERTY_ID?.trim()
    const envPropertyId = rawEnvId
      ? (() => {
          try {
            return decodeURIComponent(rawEnvId)
          } catch {
            return rawEnvId
          }
        })()
      : null
    const getEmailPropertyId = async (dbId: string) => {
      if (envPropertyId) return envPropertyId
      for (const name of EMAIL_PROPERTY_FALLBACKS) {
        const id = await getPropertyIdByName(dbId, name)
        if (id) return id
      }
      return null
    }

    const contactenEmailId = await getEmailPropertyId(config.contactenDbId)
    const contactenProEmailId = await getEmailPropertyId(config.contactenProDbId)

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

export type AccessDiagnostic = {
  customerPagesCount: number
  contractorPagesCount: number
  contactenDataSourceId: string | null
  contactenProDataSourceId: string | null
  emailPropertyIdUsed: string | null
  mappingsCount: number
  userEmailInMappings: boolean
  entityMappingCount: number
  userEntityLinkCount: number
  error?: string
}

/**
 * Run diagnostic to debug "No Access" - fetches from Notion, checks DB state.
 */
export async function getAccessDiagnostics(
  userId: string,
  userEmail: string
): Promise<AccessDiagnostic> {
  const empty: AccessDiagnostic = {
    customerPagesCount: 0,
    contractorPagesCount: 0,
    contactenDataSourceId: null,
    contactenProDataSourceId: null,
    emailPropertyIdUsed: null,
    mappingsCount: 0,
    userEmailInMappings: false,
    entityMappingCount: 0,
    userEntityLinkCount: 0,
  }
  try {
    const config = await getPortalConfig()
    if (!config.contactenDbId || !config.contactenProDbId) {
      return { ...empty, error: 'Missing Contacten database IDs' }
    }

    setDataSourceOverride(
      config.contactenDbId,
      process.env.CONTACTEN_DATA_SOURCE_ID?.trim()
    )
    setDataSourceOverride(
      config.contactenProDbId,
      process.env.CONTACTEN_PRO_DATA_SOURCE_ID?.trim()
    )

    const rawEnvId = process.env.EMAIL_PROPERTY_ID?.trim()
    const envPropertyId = rawEnvId
      ? (() => {
          try {
            return decodeURIComponent(rawEnvId)
          } catch {
            return rawEnvId
          }
        })()
      : null

    const getEmailPropertyId = async (dbId: string) => {
      if (envPropertyId) return envPropertyId
      const names = [config.emailPropertyName, 'E-mail', 'Email']
      for (const name of names) {
        const id = await getPropertyIdByName(dbId, name)
        if (id) return id
      }
      return null
    }

    const contactenEmailId = await getEmailPropertyId(config.contactenDbId)

    const { getDataSourceIdFromDatabase } = await import('@/lib/notion/client')
    let contactenDataSourceId: string | null = null
    let contactenProDataSourceId: string | null = null
    try {
      contactenDataSourceId = await getDataSourceIdFromDatabase(config.contactenDbId)
    } catch {
      /* ignore */
    }
    try {
      contactenProDataSourceId = await getDataSourceIdFromDatabase(config.contactenProDbId)
    } catch {
      /* ignore */
    }

    const [customerPages, contractorPages] = await Promise.all([
      queryDatabase(config.contactenDbId),
      queryDatabase(config.contactenProDbId),
    ])

    const mappings: { email: string }[] = []
    for (const page of customerPages) {
      const emails = extractEmailsFromPage(page, contactenEmailId)
      for (const e of emails) {
        mappings.push({ email: e })
      }
    }
    for (const page of contractorPages) {
      const emails = extractEmailsFromPage(page, contactenEmailId)
      for (const e of emails) {
        mappings.push({ email: e })
      }
    }

    const normalizedUserEmail = userEmail.toLowerCase().trim()
    const userEmailInMappings = mappings.some((m) => m.email.toLowerCase() === normalizedUserEmail)

    const admin = createAdminClient()
    const { count: entityMappingCount } = await admin
      .from('entity_email_mapping')
      .select('*', { count: 'exact', head: true })

    const { count: userEntityLinkCount } = await admin
      .from('user_entity_link')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return {
      customerPagesCount: customerPages.length,
      contractorPagesCount: contractorPages.length,
      contactenDataSourceId,
      contactenProDataSourceId,
      emailPropertyIdUsed: contactenEmailId,
      mappingsCount: mappings.length,
      userEmailInMappings,
      entityMappingCount: entityMappingCount ?? 0,
      userEntityLinkCount: userEntityLinkCount ?? 0,
    }
  } catch (err: any) {
    return { ...empty, error: err?.message || String(err) }
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
