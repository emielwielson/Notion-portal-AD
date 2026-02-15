-- Migration: Portal Config
-- Creates portal_config table for Notion database IDs and property names

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create portal_config table
CREATE TABLE IF NOT EXISTS public.portal_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contacten_db_id TEXT NOT NULL DEFAULT '',
    contacten_pro_db_id TEXT NOT NULL DEFAULT '',
    email_property_name TEXT NOT NULL DEFAULT 'Email',
    projecten_property_name TEXT NOT NULL DEFAULT 'projecten',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_portal_config_updated_at
    BEFORE UPDATE ON public.portal_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert seed row with placeholders (user updates via Dashboard with actual Notion DB IDs)
INSERT INTO public.portal_config (
    contacten_db_id,
    contacten_pro_db_id,
    email_property_name,
    projecten_property_name
)
SELECT '', '', 'Email', 'projecten'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_config LIMIT 1);

-- Add comments for documentation
COMMENT ON TABLE public.portal_config IS 'Single-row config: Notion database IDs for Contacten, Contacten (pro), and property names';
