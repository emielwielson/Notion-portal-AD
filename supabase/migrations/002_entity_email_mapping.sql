-- Migration: Entity Email Mapping
-- Cached mapping from email to Contacten/Contacten (pro) entities

CREATE TABLE IF NOT EXISTS public.entity_email_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'contractor')),
    entity_notion_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_email_entity_contact UNIQUE (email, entity_type, entity_notion_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_entity_email_mapping_email ON public.entity_email_mapping(email);
CREATE INDEX IF NOT EXISTS idx_entity_email_mapping_email_entity ON public.entity_email_mapping(email, entity_type);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_entity_email_mapping_updated_at
    BEFORE UPDATE ON public.entity_email_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.entity_email_mapping IS 'Cached mapping: email -> (entity_type, entity_notion_id) from Contacten and Contacten (pro)';
COMMENT ON COLUMN public.entity_email_mapping.entity_type IS 'customer = Contacten, contractor = Contacten (pro)';
