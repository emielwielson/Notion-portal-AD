-- Migration: User Entity Link
-- Session cache linking auth.users.id to entities for RLS

CREATE TABLE IF NOT EXISTS public.user_entity_link (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'contractor')),
    entity_notion_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, entity_type, entity_notion_id)
);

-- Index for lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_entity_link_user_id ON public.user_entity_link(user_id);

-- Add comments for documentation
COMMENT ON TABLE public.user_entity_link IS 'Links auth.users to their Contacten/Contacten (pro) entities; populated by sync from entity_email_mapping';
