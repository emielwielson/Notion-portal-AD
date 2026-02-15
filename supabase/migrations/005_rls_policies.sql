-- Migration: Row Level Security Policies
-- Enables RLS and creates security policies for all tables

-- Helper function: check if current user can access a project by contact_notion_id and contact_type
CREATE OR REPLACE FUNCTION public.user_can_access_entity(
    p_contact_notion_id TEXT, p_contact_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_entity_link
    WHERE user_id = auth.uid()
    AND entity_notion_id = p_contact_notion_id
    AND entity_type = p_contact_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on portal_config
ALTER TABLE public.portal_config ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read portal config (config only, no secrets)
CREATE POLICY "authenticated_read_portal_config"
ON public.portal_config FOR SELECT
TO authenticated
USING (true);

-- Enable RLS on entity_email_mapping
ALTER TABLE public.entity_email_mapping ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read rows matching their own email
CREATE POLICY "users_read_own_email_mapping"
ON public.entity_email_mapping FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Enable RLS on user_entity_link
ALTER TABLE public.user_entity_link ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own entity links
CREATE POLICY "users_read_own_entity_links"
ON public.user_entity_link FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Enable RLS on notion_sync_cache
ALTER TABLE public.notion_sync_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read cached data for entities they are linked to
CREATE POLICY "users_read_accessible_cache"
ON public.notion_sync_cache FOR SELECT
TO authenticated
USING (
  public.user_can_access_entity(contact_notion_id, contact_type)
);

-- Add comments for documentation
COMMENT ON FUNCTION public.user_can_access_entity IS 'Checks if current user has access to an entity via user_entity_link';
