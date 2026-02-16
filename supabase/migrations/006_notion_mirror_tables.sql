-- Migration: Notion Mirror Tables
-- Mirror of Contacten, Contacten (pro), and Projecten for webhook-driven updates.
-- Fixes "removed project still visible" by replacing relations on each sync.

-- notion_contacts: all Contacten + Contacten (pro) rows
CREATE TABLE IF NOT EXISTS public.notion_contacts (
    notion_page_id TEXT PRIMARY KEY,
    source_db TEXT NOT NULL CHECK (source_db IN ('contacten', 'contacten_pro')),
    properties_json JSONB NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notion_contacts_source_db ON public.notion_contacts(source_db);
CREATE INDEX IF NOT EXISTS idx_notion_contacts_last_synced_at ON public.notion_contacts(last_synced_at);

CREATE TRIGGER update_notion_contacts_updated_at
    BEFORE UPDATE ON public.notion_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.notion_contacts IS 'Mirror of Contacten and Contacten (pro) pages for webhook reconciliation';

-- notion_projects: project rows from Projecten database
CREATE TABLE IF NOT EXISTS public.notion_projects (
    notion_page_id TEXT PRIMARY KEY,
    properties_json JSONB NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notion_projects_last_synced_at ON public.notion_projects(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_notion_projects_properties_json ON public.notion_projects USING GIN (properties_json);

CREATE TRIGGER update_notion_projects_updated_at
    BEFORE UPDATE ON public.notion_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.notion_projects IS 'Mirror of Projecten database for display';

-- notion_contact_project: relation linking contact -> project (replaced on each update)
CREATE TABLE IF NOT EXISTS public.notion_contact_project (
    contact_notion_id TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('customer', 'contractor')),
    project_notion_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contact_notion_id, contact_type, project_notion_id),
    CONSTRAINT ncp_contact_not_empty CHECK (contact_notion_id != ''),
    CONSTRAINT ncp_project_not_empty CHECK (project_notion_id != '')
);

CREATE INDEX IF NOT EXISTS idx_notion_contact_project_contact ON public.notion_contact_project(contact_notion_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_notion_contact_project_project ON public.notion_contact_project(project_notion_id);

COMMENT ON TABLE public.notion_contact_project IS 'Contact -> project relations; replaced on sync to reflect removals';

-- RLS
ALTER TABLE public.notion_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_accessible_contacts"
ON public.notion_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_entity_link uel
    WHERE uel.entity_notion_id = notion_contacts.notion_page_id
    AND uel.entity_type = (CASE notion_contacts.source_db WHEN 'contacten' THEN 'customer' WHEN 'contacten_pro' THEN 'contractor' END)
    AND uel.user_id = auth.uid()
  )
);

ALTER TABLE public.notion_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_accessible_projects"
ON public.notion_projects FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notion_contact_project ncp
    WHERE ncp.project_notion_id = notion_projects.notion_page_id
    AND public.user_can_access_entity(ncp.contact_notion_id, ncp.contact_type)
  )
);

ALTER TABLE public.notion_contact_project ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_accessible_relations"
ON public.notion_contact_project FOR SELECT
TO authenticated
USING (public.user_can_access_entity(contact_notion_id, contact_type));
