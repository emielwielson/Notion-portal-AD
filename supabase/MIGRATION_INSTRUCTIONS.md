# Database Migration Instructions

This guide explains how to apply the database migrations to your Supabase project.

## Prerequisites

- Access to your Supabase project dashboard
- Project URL: `https://fggicmepxylgspegsszd.supabase.co`
- SQL Editor access in Supabase Dashboard

## Option A: Supabase CLI (Recommended)

```bash
supabase login
supabase link --project-ref fggicmepxylgspegsszd
supabase db push
```

## Option B: Manual via SQL Editor

Apply migrations in the following order:

1. `001_portal_config.sql` - Creates portal_config table and seed row
2. `002_entity_email_mapping.sql` - Creates entity_email_mapping table
3. `003_notion_sync_cache.sql` - Creates notion_sync_cache table
4. `004_user_entity_link.sql` - Creates user_entity_link table
5. `005_rls_policies.sql` - Enables Row Level Security and creates policies
6. `006_notion_mirror_tables.sql` - Creates notion_contacts, notion_projects, notion_contact_project (mirror for webhooks)

### Steps to Apply Migrations

1. Log into your Supabase Dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. For each migration file:
   - Open the file in your code editor
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`)
   - Verify success message appears before proceeding to the next migration

### Expected Results

**001_portal_config.sql**
- `portal_config` table created
- `update_updated_at_column()` function and trigger created
- One seed row inserted with placeholder values

**002_entity_email_mapping.sql**
- `entity_email_mapping` table created
- Indexes on email and (email, entity_type)
- Trigger for updated_at

**003_notion_sync_cache.sql**
- `notion_sync_cache` table created
- Indexes including GIN on properties_json
- Trigger for updated_at

**004_user_entity_link.sql**
- `user_entity_link` table created with FK to auth.users

**005_rls_policies.sql**
- RLS enabled on all four tables
- `user_can_access_entity()` helper function
- Policies restrict access by user's linked entities

**006_notion_mirror_tables.sql**
- `notion_contacts`, `notion_projects`, `notion_contact_project` tables
- RLS policies for mirror tables

## Verification

### 1. Check Tables

1. Navigate to **Table Editor** in Supabase Dashboard
2. Verify you see these tables:
   - `portal_config`
   - `entity_email_mapping`
   - `notion_sync_cache`
   - `user_entity_link`
   - `notion_contacts`
   - `notion_projects`
   - `notion_contact_project`

### 2. Update Portal Config

1. Open the `portal_config` table in Table Editor
2. Update the seed row with your Notion database IDs from `.env.local`:
   - `contacten_db_id` → CONTACTEN_DB_ID
   - `contacten_pro_db_id` → CONTACTEN_PRO_DB_ID
   - `email_property_name` → name of email property in Notion (if different from "Email")
   - `projecten_property_name` → "projecten" (or your relation property name)

### 3. Check RLS

1. Navigate to **Database** → **Tables** → select each table
2. Verify RLS is enabled (shield icon)
3. Verify policies are listed under each table

## Troubleshooting

### Error: "relation already exists"

The table already exists. Skip the migration if the structure matches, or drop the table first (only if safe).

### Error: "function already exists"

`update_updated_at_column()` is created in migration 001. Safe to ignore if running migrations out of order.

### Error: "duplicate key value"

The portal_config seed insert may fail if a row already exists. Safe to ignore.

## Next Steps

After migrations are applied:

1. Update `portal_config` with your Notion database IDs
2. Proceed to Task 3.0: Authentication & Entity Resolution
