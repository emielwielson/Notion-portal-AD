# Product Requirements Document: Custom Customer Portal (Single Customer)

## 1. Introduction/Overview

This document defines the requirements for building a **custom customer portal** on top of Notion, specifically tailored for **one customer**. The portal enables two distinct user types—**customers** and **contractors**—to access and interact with data stored in Notion, with access control driven entirely by the **email address(es)** linked to each customer or contractor record.

### Problem Statement

The customer needs a branded, custom web application that surfaces Notion data to external parties (their own customers and contractors) without exposing Notion directly. Access must be granular: each user sees only the information they are authorized to view, based on which customer or contractor entity their email address is associated with in Notion.

### Goal

Build a single-tenant customer portal that allows customers and contractors to securely log in, view, and optionally edit data from Notion—with row-level access strictly determined by email address matching against Customer and Contractor records in Notion.

---

## 2. Goals

1. **Single-customer deployment** — The portal is deployed for one specific customer (the "operator"), not a multi-tenant platform
2. **Email-based access control** — Users gain access via their email address, which must be linked to a Customer or Contractor record in Notion
3. **Strict data isolation** — Customers and contractors see only rows they are authorized to access (no cross-entity visibility)
4. **Two user types** — Support distinct roles: Customer and Contractor, each with access driven by their linked entity
5. **Reuse proven architecture** — Leverage the Notion Portals stack (Next.js, Supabase, Notion) for consistency and maintainability
6. **Performance** — Use Supabase as a cache layer to avoid slow, direct Notion API calls for reads

---

## 3. User Stories

### As a Customer (end user linked via Customer record)
- **US-1:** As a customer, I want to log in with my email (magic link), so that I can access the portal without managing passwords.
- **US-2:** As a customer, I want to see only the information associated with my customer record, so that I cannot view other customers' data.
- **US-3:** As a customer, I want to update fields I am allowed to edit, so that I can keep my information current.

### As a Contractor (end user linked via Contractor record)
- **US-4:** As a contractor, I want to log in with my email (magic link), so that I can access the portal without managing passwords.
- **US-5:** As a contractor, I want to see only the information associated with my contractor record, so that I cannot view other contractors' or unrelated customers' data.
- **US-6:** As a contractor, I want to update fields I am allowed to edit, so that I can perform my work through the portal.

### As a Dual-Role User (linked as both Customer and Contractor)
- **US-6b:** As a user linked to both Contacten and Contacten (pro), I want to see all my projects in one view, so that I have a single place to track both customer and contractor work. I expect customer-appropriate columns on customer projects and contractor-appropriate columns (including Meeting link) on contractor projects.

### As a Portal Operator (customer company admin)
- **US-7:** As a portal operator, I want to manage access by adding or removing email addresses on Contacten and Contacten (pro) records in Notion, so that I can control who sees what without using a separate admin tool.
- **US-8:** As a portal operator, I want data changes in Notion to appear in the portal when users log in or refresh, so that I can manage content in familiar tools.

### As a Company Operator (internal team)
- **US-9:** As a company operator, I want to define schemas, relationships, and content in Notion, so that the portal reflects the current data model and content.

---

## 4. Functional Requirements

### 4.1 Authentication

**FR-1:** The system must allow users to authenticate via Supabase Auth using email and magic link.

**FR-2:** The system must associate each authenticated user with one or more Contact records (Customer and/or Contractor) based on their email address.

**FR-3:** The system must reject login or restrict access if the user's email is not linked to any Contact record in the configured Notion databases.

### 4.2 Access Model (Email-Based)

**FR-4:** The system must integrate with two Notion databases for access control:
   - **Contacten** — Customer contacts; each row has one or more email(s) and a `projecten` (relation) property linking to projects.
   - **Contacten (pro)** — Contractor contacts; each row has one or more email(s) and a `projecten` (relation) property linking to projects.

**FR-5:** The system must determine a user's linked contacts by matching their authenticated email against Contacten and Contacten (pro) records in Notion.

**FR-6:** The system must support users linked as both Customer and Contractor (same email in both databases). In that case: the user sees **all** projects they are linked to; on projects linked via their **Customer** contact apply Customer column permissions; on projects linked via their **Contractor** contact apply Contractor column permissions.

### 4.3 Row-Level Access

**FR-9:** The system must filter projects so that a **Customer** sees only projects linked to their Contacten record via the `projecten` property.

**FR-10:** The system must filter projects so that a **Contractor** sees only projects linked to their Contacten (pro) record via the `projecten` property.

**FR-11:** The system must enforce row-level access at both the application layer and, where possible, at the database layer (e.g., RLS in Supabase) so users cannot access rows they are not authorized to see.

**FR-12:** Projects are sourced from the relation property `projecten` on Contacten and Contacten (pro); no separate Projecten database configuration is required beyond these links.

### 4.4 Column-Level Permissions

**FR-13:** The system must show the following properties per project for **Customers**: Status, Adres 1, Adres 2, Contract ondertekend, Factuur betaald.

**FR-14:** The system must show the following properties per project for **Contractors**: Status, Adres 1, Adres 2, Type, Meeting. The Meeting property is a Notion page link; the system must render it as a link that opens the meeting page (e.g., in a new tab or embedded view).

### 4.5 Notion Integration

**FR-15:** The system must use a single Notion integration (or integration per deployment) with access to the configured databases.

**FR-16:** The system must read from Contacten, Contacten (pro), and linked project pages in Notion.

**FR-17:** The system must filter Notion rows by Customer/Contractor relation identifiers when syncing.

**FR-18:** The system must create and update pages in Notion when users submit changes (where allowed).

**FR-19:** The system must normalize Notion properties into app models and route all Notion API calls through server actions or API routes (no client-side Notion access).

### 4.6 Data Sync & Caching

**FR-20:** The system must use Supabase as a cache for Notion data to improve read performance.

**FR-21:** The system must sync Contacten and Contacten (pro) data (including email mappings and linked projects) from Notion on **login** and on **page refresh**.

**FR-22:** The system must sync projects linked via the `projecten` property when syncing contacts; no separate cron-based sync is required for the main flow.

**FR-23:** The system must store `last_synced_at` for cached records and support staleness checks.

**FR-24:** The system must update Supabase immediately on user edits and propagate changes to Notion asynchronously.

### 4.7 Security

**FR-25:** The system must enforce Row Level Security (RLS) in Supabase so that users can only read data associated with their Customer or Contractor entity.

**FR-26:** The system must validate email→entity mapping and row access on every request before returning or mutating data.

**FR-27:** The system must prevent cross-entity access even if a user provides valid-looking IDs.

**FR-28:** The system must store Notion API tokens securely (e.g., environment variables or Supabase secrets).

### 4.8 User Experience

**FR-29:** The system must provide a login page for email-based magic link authentication.

**FR-30:** The system must provide a dashboard showing data the user is authorized to see.

**FR-31:** The system must display loading indicators during sync and data fetch operations.

**FR-32:** The system must display clear error messages when the user has no linked entity, when Notion is unavailable, or when access is denied.

### 4.9 Error Handling & Edge Cases

**FR-33:** The system must handle users whose email is not linked to any Customer or Contractor (e.g., show "No access" or "Contact administrator").

**FR-34:** The system must handle Notion API downtime or rate limits gracefully, using cached data when available.

**FR-35:** The system must handle schema changes in Notion (e.g., renamed properties) without breaking the portal, with appropriate logging or admin alerts.

**FR-36:** The system must handle cases where a Customer or Contractor record is deleted in Notion (user loses access on next sync).

---

## 5. Non-Goals (Out of Scope)

1. **Multi-tenant platform** — This portal serves one customer; no organization switcher or multi-org logic
2. **Admin UI** — All access management and configuration is done in Notion; no admin panel or separate user management interface is required or built
3. **OAuth / social login** — Initial version uses email + magic link only
4. **Real-time collaborative editing** — Notion handles that; the portal is read/update focused
5. **Custom design system / heavy branding** — Prototype or MVP styling is acceptable; deep branding can be a follow-up
6. **Audit logs and activity feeds** — Future consideration
7. **AI-powered features** — Out of scope
8. **Cron-based sync** — Sync is triggered on login and page refresh; no scheduled cron jobs for the main data flow

---

## 6. Design Considerations

### 6.1 Data Model (Notion)

**Notion structure:**

- **Contacten** — Customer contacts database. Each row has email(s) and a `projecten` (relation) property linking to project pages.
- **Contacten (pro)** — Contractor contacts database. Each row has email(s) and a `projecten` (relation) property linking to project pages.
- **Projects** — Project pages are linked from contacts via the `projecten` relation (direction: contact → projects).

**Access logic:**

- User logs in with `user@example.com`.
- System looks up: is `user@example.com` in any Contacten row? → User has Customer access; linked contact(s) define which projects they see.
- System looks up: is `user@example.com` in any Contacten (pro) row? → User has Contractor access; linked contact(s) define which projects they see.
- If same email in both: user sees all projects from both contexts; column permissions (FR-13, FR-14) apply per project based on how that project is linked (via Customer contact vs Contractor contact).

### 6.2 UI/UX

- **Login:** Simple email input + "Send magic link" button.
- **Dashboard:** Table or card view of main data, filtered by user's entity. Option to edit allowed fields in place or via a form.
- **No org selector:** Single-tenant; no organization picker.
- **Role indicator:** Optional badge or label showing "Customer" or "Contractor".

### 6.3 Responsive Design

- The application should work on desktop and mobile.
- Loading and error states should be clear and consistent.

---

## 7. Technical Considerations

### 7.1 Architecture

```
Browser (Next.js – Vercel)
   ↓
Server Actions / API Routes
   ↓
Supabase
   ├─ Auth (users)
   ├─ Entity mapping (email → customer_id / contractor_id)
   ├─ Cached Notion data (with RLS)
   ├─ Permissions (role-based: Customer vs Contractor columns)
   └─ Configuration (Notion DB IDs, property names)
   ↓
Notion API
```

### 7.2 Differences from Notion Portals (Multi-Tenant)

| Aspect | Notion Portals | Custom Customer Portal |
|--------|----------------|------------------------|
| Tenancy | Multi-org | Single customer |
| Access key | `organization_members` (user_id → org_id) | Email → Customer/Contractor |
| Row filter | Organization property | Customer/Contractor relation |
| User types | Admin, End user | Customer, Contractor |
| Admin UI | Users, permissions | Managed in Notion |

### 7.3 Technology Stack

**Frontend:** Next.js (App Router), Tailwind CSS, Server Actions  
**Backend:** Supabase (Postgres, Auth, RLS)  
**External:** Notion API  
**Deployment:** Vercel  
**Sync:** On login and page refresh

### 7.4 Database Schema (Supabase) — Proposed

- **`portal_config`** — Single row or small table: Notion database IDs for Contacten, Contacten (pro), property names for email and `projecten` relation.
- **`entity_email_mapping`** — Cached mapping: `(email, entity_type, entity_notion_id)` where entity_type is 'customer' or 'contractor'. Refreshed on login/refresh.
- **`notion_sync_cache`** — Cached project data linked from Contacten and Contacten (pro), with `contact_notion_id` and `contact_type` for RLS and per-project permission resolution.
- **`user_entity_link`** (optional) — `(user_id, entity_type, entity_notion_id)` derived from `entity_email_mapping` after login for faster lookups.
- **Column permissions** — Fixed per role (Customer vs Contractor) as defined in FR-13/FR-14; no per-user permission table needed.

### 7.5 Folder Structure (Aligned with Notion Portals)

```
app/
  login/
  dashboard/
  api/
    auth/
    notion/
    cron/

lib/
  notion/
  supabase/
  sync/
  permissions/
  entity-resolver/   # Email → Customer/Contractor lookup

types/
```

### 7.6 Security

- **RLS:** All cached tables must have policies that restrict rows to the user's linked Customer or Contractor.
- **Server-side checks:** Always validate entity linkage and row access before returning or mutating data.
- **Secrets:** Notion API key in env vars, never exposed to client.

---

## 8. Open Questions

1. **Email property name:** What is the exact property name for email(s) in Contacten and Contacten (pro)? (e.g., "Email", "E-mail", "Contact Email")

2. **Meeting page link:** For the Contractor "Meeting" property: should it open the Notion page in a new tab, or is an embedded view preferred?

3. **Branding:** Any specific branding, logo, or color requirements for the portal?

4. **Deployment:** Single Vercel project per customer, or one project with env-based config for multiple deployments?

5. **Edit permissions:** Can Customers and/or Contractors edit any of their visible columns (e.g., Contract ondertekend, Factuur betaald), or is everything read-only?

---

## 9. Success Metrics

1. **Access correctness** — 100% of row access decisions match the intended policy (no leakage, no over-restriction).
2. **Performance** — Dashboard load &lt; 2 seconds (from cache).
3. **Sync reliability** — Sync success rate &gt; 99%.
4. **User experience** — Users can log in and see their data without needing Notion knowledge.
5. **Maintainability** — Align with Notion Portals patterns for ease of future changes.

---

## 10. Future Considerations

1. Event-based sync via Notion webhooks  
2. Admin UI for access overview, sync triggers, and basic config  
3. Optional OAuth (e.g., Google)  
4. Audit logs for access and edits  
5. Custom branding and design system  
6. Support for multiple "main" databases with different visibility rules

---

## Appendix: Reference — Notion Portals Architecture

This PRD is based on the existing **Notion Portals** project, which provides:

- Next.js App Router + Supabase Auth  
- Supabase as cache for Notion data  
- RLS for organization-scoped access  
- Role-based column permissions (Customer vs Contractor)  
- Sync on login and page refresh  
- Notion client, sync, and permission utilities in `lib/`

The Custom Customer Portal adapts this by replacing organization-based access with **email-based Customer/Contractor access** and simplifying to a single-tenant model.
