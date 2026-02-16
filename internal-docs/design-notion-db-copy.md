# Design: Notion Database Copy + Webhooks

**Branch:** `feature/notion-db-copy`  
**Problem:** When a project is removed from a contact's Projecten relation in Notion, the project still appears after refresh. The current `notion_sync_cache` only upserts—it never deletes rows for projects no longer linked. Also: we run Notion sync on every dashboard load, which is slow and hits rate limits.

## Approach: Mirror Notion in our DB + Webhooks for live updates

1. **Mirror** Contacten, Contacten (pro), and Projecten in our DB with explicit relations.
2. **Webhooks** notify us when Notion data changes; we update our mirror incrementally.
3. **Dashboard** reads only from our DB—no Notion API calls on page load.

### Proposed schema (additions)

| Table | Purpose |
|-------|---------|
| `notion_contacts` | All Contacten + Contacten (pro) rows. Columns: notion_page_id, source_db (contacten / contacten_pro), properties_json, last_synced_at |
| `notion_projects` | All project rows from Projecten. Columns: notion_page_id, properties_json, last_synced_at |
| `notion_contact_project` | **Relation** contact → project. Primary key (contact_notion_id, contact_type, project_notion_id). Deleted when relation removed in Notion. |

### Data flow

```
Notion (source of truth)
    ↓ webhooks on change
Our API: POST /api/notion/webhook
    ↓ fetch full page, reconcile
Supabase (mirror)
    ↑ read-only
Dashboard (fast: no Notion calls)
```

### Initial sync (one-time or manual "Full refresh")

1. Query Contacten + Contacten (pro) → upsert `notion_contacts`
2. For each contact: get Projecten relation IDs → delete all relations for that contact, insert current ones
3. For each project ID in relations: fetch page → upsert `notion_projects`
4. Refresh `entity_email_mapping` and `user_entity_link` for auth

### Webhook handler: event → action

Configure webhooks in **Notion Integration → Webhooks** tab. Subscribe to:

- `page.properties_updated` — property change (including relation add/remove)
- `page.deleted` — page trashed
- `page.created` — new page
- `page.undeleted` — page restored
- `data_source.content_updated` — DB content changes (API 2025-09-03+)

**Event handling logic:**

| Event | entity.type | Action |
|-------|-------------|--------|
| `page.properties_updated` | page | If page is in Contacten/Contacten Pro: re-fetch, upsert contact, refresh relations (delete+insert). If page is in Projecten: re-fetch, upsert project. |
| `page.deleted` | page | Remove from `notion_contacts`, `notion_projects`, or `notion_contact_project` as applicable. |
| `page.created` | page | Re-fetch page; if in our DBs, upsert. New relations come from `page.properties_updated` on the parent. |
| `page.undeleted` | page | Re-fetch and upsert. |
| `data_source.content_updated` | data_source | Database child list changed; may need to reconcile affected pages. |

Webhook payload includes `entity.id` (page/database ID). We must determine which of our DBs it belongs to (Contacten, Contacten Pro, Projecten) using `portal_config`. If unknown, we can ignore or do a lightweight lookup.

**Note:** Events contain minimal data. We must call Notion API (retrieve page, etc.) to get full content.

### Dashboard load (no sync)

- Read projects from Supabase via `getUniqueProjects` (backed by `notion_contact_project` + `notion_projects`)
- No `runSync()` on load
- Optional: "Refresh" button triggers manual full sync for edge cases / webhook misses

### Advantages

- **Correct removals**: Relations are replaced on each contact update; removals are reflected
- **Fast dashboard**: No Notion API on page load; reads from Supabase only
- **Lower rate limits**: Updates only when Notion actually changes
- **Clear model**: Contacts, projects, relations are explicit
- **Easier debugging**: Inspect mirror tables directly

### Migration path

1. Add new tables (006_)
2. Implement full sync that populates mirror
3. Add `POST /api/notion/webhook` handler (verify Notion token, process events)
4. Configure webhooks in Notion integration settings
5. Update `getUniqueProjects` to read from new tables
6. Remove sync-from-dashboard; keep optional manual "Full refresh"
7. Deprecate `notion_sync_cache`
8. Update RLS for new tables
