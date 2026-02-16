# Design: Notion Database Copy Approach

**Branch:** `feature/notion-db-copy`  
**Problem:** When a project is removed from a contact's Projecten relation in Notion, the project still appears after refresh. The current `notion_sync_cache` only upserts—it never deletes rows for projects no longer linked.

## Approach: Mirror Notion databases in our DB

Instead of caching only the intersection of (user's contacts × their projects), store full copies of the relevant Notion databases and their relations. On each sync, reconcile with Notion: add/update new data, **remove** rows that no longer exist in Notion.

### Proposed schema (additions)

| Table | Purpose |
|-------|---------|
| `notion_contacts` | All Contacten + Contacten (pro) rows we have access to. Columns: notion_page_id, source_db (contacten / contacten_pro), properties_json, last_synced_at |
| `notion_projects` | All project rows from the Projecten database. Columns: notion_page_id, properties_json, last_synced_at |
| `notion_contact_project` | **Relation** linking contact → project. Columns: contact_notion_id, contact_type, project_notion_id. Primary key (contact_notion_id, contact_type, project_notion_id). **Deleted when relation removed in Notion.** |

### Sync logic (changes)

1. **Contacts**: Query Contacten + Contacten (pro), upsert into `notion_contacts`. Delete contacts that no longer exist in Notion (optional, or full truncate+reload).
2. **Relations**: For each contact, get Projecten relation IDs from Notion. Delete all `notion_contact_project` rows for that contact, then insert current relations. This ensures removals are reflected.
3. **Projects**: For each project ID in the current relations, fetch and upsert into `notion_projects`. Optionally: delete projects that are no longer linked by any contact (orphan cleanup).

### Advantages

- **Correct removals**: Deleting relations and re-inserting only current ones fixes the "removed project still visible" bug
- **Clear data model**: Contacts, projects, and relations are explicit
- **Easier debugging**: Can inspect raw DB state
- **Potential for incremental sync**: Could track Notion last_edited for smarter updates (future)

### Migration path

1. Add new tables (006_)
2. Implement new sync that populates them
3. Update `getUniqueProjects` etc. to read from new tables instead of `notion_sync_cache`
4. Deprecate/remove `notion_sync_cache`
5. Update RLS policies for new tables (user sees projects via contact → project relation where contact's email matches user)
