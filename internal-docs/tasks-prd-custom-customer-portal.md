# Task List: Custom Customer Portal

Based on PRD: `prd-custom-customer-portal.md`

## Relevant Files

### Configuration & Setup
- `package.json` - Project dependencies and scripts
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Example environment variables (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, NOTION_API_KEY)
- `.env.local` - Environment variables (to be populated with actual values)
- `vercel.json` - Vercel deployment configuration

### Database & Migrations
- `supabase/migrations/001_portal_config.sql` - Portal configuration table (Notion DB IDs, property names)
- `supabase/migrations/002_entity_email_mapping.sql` - Cached email → Contacten/Contacten (pro) mapping
- `supabase/migrations/003_notion_sync_cache.sql` - Cached project data with contact linkage
- `supabase/migrations/004_user_entity_link.sql` - Optional user_id → entity mapping for faster lookups
- `supabase/migrations/005_rls_policies.sql` - Row Level Security policies

### Core Libraries
- `lib/supabase/client.ts` - Supabase client for client-side operations
- `lib/supabase/server.ts` - Supabase client for server-side operations
- `lib/supabase/middleware.ts` - Auth middleware
- `lib/notion/client.ts` - Notion API client wrapper
- `lib/notion/types.ts` - Notion API type definitions
- `lib/sync/sync.ts` - Sync logic for Contacten, Contacten (pro), and linked projects
- `lib/sync/cache.ts` - Cache management utilities
- `lib/entity-resolver/email-to-entity.ts` - Email → Customer/Contractor contact lookup
- `lib/permissions/filter.ts` - Role-based column filtering (Customer vs Contractor)
- `lib/permissions/check.ts` - Row access validation
- `lib/utils/errors.ts` - Error handling utilities
- `lib/utils/notion-to-app.ts` - Normalize Notion properties to app models

### Type Definitions
- `types/database.ts` - Database schema type definitions
- `types/notion.ts` - Notion API type definitions
- `types/app.ts` - App-specific types (Contact, Project, entity types)

### API Routes & Server Actions
- `app/api/auth/callback/route.ts` - Supabase auth callback handler
- `app/api/notion/data/route.ts` - Fetch cached project data (filtered by user's entities)
- `app/actions/auth.ts` - Server actions for authentication
- `app/actions/sync.ts` - Server actions for triggering sync on login/refresh

### Pages & Components
- `app/page.tsx` - Root page (redirect to login or dashboard)
- `app/login/page.tsx` - Login page with email input and magic link
- `app/dashboard/page.tsx` - Main dashboard showing user's projects
- `app/dashboard/layout.tsx` - Dashboard layout with nav and sign-out
- `app/components/dashboard/ProjectTable.tsx` - Table displaying projects with role-based columns
- `app/components/dashboard/MeetingLink.tsx` - Renders Meeting property as clickable link (Contractor only)
- `app/components/auth/AuthForm.tsx` - Reusable email/magic-link form
- `app/components/ui/LoadingSpinner.tsx` - Loading indicator during sync
- `app/components/ui/ErrorMessage.tsx` - Error message display

### Middleware & Utilities
- `middleware.ts` - Auth protection and route guards

### Tests
- `lib/entity-resolver/email-to-entity.test.ts` - Unit tests for entity resolution
- `lib/sync/sync.test.ts` - Unit tests for sync logic
- `lib/permissions/filter.test.ts` - Unit tests for column filtering
- `app/components/dashboard/ProjectTable.test.tsx` - Component tests for ProjectTable

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- This project reuses the Notion Portals architecture (Next.js, Supabase, Notion); consider copying/adapting patterns from the parent `Notion portals` project.

## Tasks

- [ ] 1.0 Project Setup & Infrastructure
  - [ ] 1.1 Initialize Next.js project with App Router (`npx create-next-app@latest`)
  - [ ] 1.2 Install and configure Tailwind CSS
  - [ ] 1.3 Install Supabase client library (`@supabase/supabase-js`)
  - [ ] 1.4 Install Notion SDK (`@notionhq/client`)
  - [ ] 1.5 Set up TypeScript configuration
  - [ ] 1.6 Create `.env.example` with required variables (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, NOTION_API_KEY, CONTACTEN_DB_ID, CONTACTEN_PRO_DB_ID)
  - [ ] 1.7 Create basic folder structure (`app/`, `lib/`, `types/`, `supabase/migrations/`, `lib/entity-resolver/`)
  - [ ] 1.8 Initialize git repository and create `.gitignore`
  - [ ] 1.9 Configure Vercel project for deployment

- [ ] 2.0 Database Schema & Supabase Configuration
  - [ ] 2.1 Create `supabase/migrations/001_portal_config.sql` with `portal_config` table (Notion DB IDs for Contacten, Contacten (pro), email property name, projecten property name)
  - [ ] 2.2 Create `supabase/migrations/002_entity_email_mapping.sql` with `entity_email_mapping` table (id, email, entity_type, entity_notion_id, created_at, updated_at)
  - [ ] 2.3 Add indexes on `entity_email_mapping` (email, entity_type) for fast lookups
  - [ ] 2.4 Create `supabase/migrations/003_notion_sync_cache.sql` with `notion_sync_cache` table (id, contact_notion_id, contact_type, notion_page_id, properties_json, last_synced_at, created_at, updated_at)
  - [ ] 2.5 Add indexes on `notion_sync_cache` for (contact_notion_id, contact_type) and notion_page_id
  - [ ] 2.6 Create `supabase/migrations/004_user_entity_link.sql` with `user_entity_link` table (user_id, entity_type, entity_notion_id) for session-based caching
  - [ ] 2.7 Create `supabase/migrations/005_rls_policies.sql` — Enable RLS on all tables; policies must restrict rows to user's linked entities
  - [ ] 2.8 Create `types/database.ts` with TypeScript types for all tables
  - [ ] 2.9 Run migrations in Supabase and verify schema

- [ ] 3.0 Authentication & Entity Resolution
  - [ ] 3.1 Create `lib/supabase/client.ts` for client-side Supabase operations
  - [ ] 3.2 Create `lib/supabase/server.ts` for server-side Supabase operations
  - [ ] 3.3 Create `lib/supabase/middleware.ts` for auth
  - [ ] 3.4 Set up Supabase Auth (enable email/magic link, disable password)
  - [ ] 3.5 Create `lib/entity-resolver/email-to-entity.ts` — Fetch Contacten and Contacten (pro) from Notion, build email → (entity_type, entity_notion_id) mapping
  - [ ] 3.6 Implement function to extract email(s) from contact rows (handle single/multi-select/rich text properties)
  - [ ] 3.7 Implement function to populate/refresh `entity_email_mapping` in Supabase from Notion data
  - [ ] 3.8 Implement function to resolve current user's entities: given user email, return list of (entity_type, entity_notion_id)
  - [ ] 3.9 Create `app/login/page.tsx` with email input and "Send magic link" button
  - [ ] 3.10 Create `app/api/auth/callback/route.ts` to handle magic link redirect
  - [ ] 3.11 Create `app/actions/auth.ts` with signInWithOtp and signOut server actions
  - [ ] 3.12 Create `middleware.ts` — Protect /dashboard; redirect unauthenticated users to /login
  - [ ] 3.13 Add post-login check: if user's email is not in `entity_email_mapping`, show "No access" message and optionally sign out

- [ ] 4.0 Notion Integration & Data Sync
  - [ ] 4.1 Create `lib/notion/client.ts` — Notion API client (query databases, get page, normalize IDs)
  - [ ] 4.2 Create `lib/notion/types.ts` — Type definitions for Notion responses
  - [ ] 4.3 Implement function to query Contacten database and extract rows with email + projecten relation
  - [ ] 4.4 Implement function to query Contacten (pro) database and extract rows with email + projecten relation
  - [ ] 4.5 Implement function to fetch full project page data for each page ID in projecten relations
  - [ ] 4.6 Create `lib/sync/sync.ts` — Orchestrate sync: refresh entity_email_mapping, then sync projects for all contacts that have linked users
  - [ ] 4.7 Create `lib/sync/cache.ts` — Upsert into notion_sync_cache with contact_notion_id, contact_type, properties_json, last_synced_at
  - [ ] 4.8 Create `lib/utils/notion-to-app.ts` — Normalize Notion properties to app model (Status, Adres 1, Adres 2, Type, Meeting, Contract ondertekend, Factuur betaald)
  - [ ] 4.9 Create `app/actions/sync.ts` — Server action to trigger sync; call on dashboard load and on manual refresh
  - [ ] 4.10 Integrate sync trigger: call sync when user lands on dashboard after login and when user clicks refresh
  - [ ] 4.11 Add staleness check (optional): skip sync if last_synced_at is recent (e.g., < 1 min) to avoid redundant calls

- [ ] 5.0 Permissions & Row/Column Filtering
  - [ ] 5.1 Define Customer columns: Status, Adres 1, Adres 2, Contract ondertekend, Factuur betaald
  - [ ] 5.2 Define Contractor columns: Status, Adres 1, Adres 2, Type, Meeting
  - [ ] 5.3 Create `lib/permissions/filter.ts` — filterProjectProperties(properties, contactType) to return only allowed columns
  - [ ] 5.4 Create `lib/permissions/check.ts` — validateUserCanAccessProject(userEntities, projectContactId, projectContactType)
  - [ ] 5.5 Implement dual-role logic: for each project, determine contact_type (customer vs contractor) from which contact linked it; apply matching column set
  - [ ] 5.6 Create `app/api/notion/data/route.ts` — Fetch cached projects, filter by user's entities, apply column filtering per project
  - [ ] 5.7 Enforce RLS policies so users can only SELECT rows where (contact_notion_id, contact_type) matches their entity_email_mapping

- [ ] 6.0 User Interface (Login & Dashboard)
  - [ ] 6.1 Create `app/page.tsx` — Redirect to /login if unauthenticated, else /dashboard
  - [ ] 6.2 Create `app/components/auth/AuthForm.tsx` — Email input, "Send magic link" button, success/error messages
  - [ ] 6.3 Create `app/dashboard/layout.tsx` — Nav bar with "Customer Portal" title, user email, Sign Out button
  - [ ] 6.4 Create `app/dashboard/page.tsx` — Trigger sync on load, fetch projects from API, pass to ProjectTable
  - [ ] 6.5 Create `app/components/dashboard/ProjectTable.tsx` — Display projects in table; columns vary per row based on contact_type (Customer vs Contractor)
  - [ ] 6.6 Create `app/components/dashboard/MeetingLink.tsx` — Render Meeting property as link opening Notion page (new tab)
  - [ ] 6.7 Add loading state: show spinner while sync is in progress or data is fetching
  - [ ] 6.8 Add empty state: "No projects" when user has no linked projects
  - [ ] 6.9 Add optional role indicator: show "Customer" / "Contractor" badge per row for dual-role clarity
  - [ ] 6.10 Add manual "Refresh" button to re-trigger sync

- [ ] 7.0 Error Handling & Edge Cases
  - [ ] 7.1 Create `lib/utils/errors.ts` — PermissionError, NotionApiError, NoAccessError
  - [ ] 7.2 Handle "No access" — user email not in entity_email_mapping: show message "No access. Contact administrator."
  - [ ] 7.3 Handle Notion API down: show user-friendly message, optionally fall back to cached data if available
  - [ ] 7.4 Handle Notion API rate limits: implement retry with exponential backoff in sync
  - [ ] 7.5 Handle deleted contact/project in Notion: on next sync, remove stale cache entries; user loses access gracefully
  - [ ] 7.6 Add try-catch around Notion API calls and Supabase operations; log errors appropriately
  - [ ] 7.7 Add error boundaries for React components
