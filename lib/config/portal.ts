import { createClient } from '@/lib/supabase/server'

/**
 * Fetch portal config from Supabase or use env fallbacks.
 * Env vars take precedence over portal_config for local development.
 */
export async function getPortalConfig() {
  const supabase = await createClient()
  const { data } = await supabase.from('portal_config').select('*').limit(1).single()

  return {
    contactenDbId: process.env.CONTACTEN_DB_ID?.trim() || data?.contacten_db_id || '',
    contactenProDbId: process.env.CONTACTEN_PRO_DB_ID?.trim() || data?.contacten_pro_db_id || '',
    emailPropertyName: data?.email_property_name || process.env.EMAIL_PROPERTY_NAME || 'Email',
    projectenPropertyName: process.env.PROJECTEN_PROPERTY_NAME?.trim() || data?.projecten_property_name || 'projecten',
    projectTitlePropertyName: process.env.PROJECT_TITLE_PROPERTY_NAME?.trim() || 'Naam',
  }
}
