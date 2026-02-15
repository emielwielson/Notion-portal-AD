-- Migration: Notion Sync Cache
-- Cached project data with contact linkage for RLS and permission resolution

CREATE TABLE IF NOT EXISTS public.notion_sync_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_notion_id TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('customer', 'contractor')),
    notion_page_id TEXT NOT NULL,
    properties_json JSONB NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_contact_page UNIQUE (contact_notion_id, contact_type, notion_page_id),
    CONSTRAINT non_empty_contact_notion_id CHECK (contact_notion_id != ''),
    CONSTRAINT non_empty_notion_page_id CHECK (notion_page_id != '')
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notion_sync_cache_contact ON public.notion_sync_cache(contact_notion_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_notion_sync_cache_notion_page_id ON public.notion_sync_cache(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_cache_last_synced_at ON public.notion_sync_cache(last_synced_at);

-- GIN index for JSONB queries on properties_json
CREATE INDEX IF NOT EXISTS idx_notion_sync_cache_properties_json ON public.notion_sync_cache USING GIN (properties_json);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_notion_sync_cache_updated_at
    BEFORE UPDATE ON public.notion_sync_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.notion_sync_cache IS 'Cached project data linked from Contacten and Contacten (pro)';
COMMENT ON COLUMN public.notion_sync_cache.contact_type IS 'customer = from Contacten, contractor = from Contacten (pro)';
