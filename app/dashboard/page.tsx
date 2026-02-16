import { unstable_noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { getCurrentUser } from '@/app/actions/auth'
import { runSync, refreshAndRevalidate } from '@/app/actions/sync'
import { signOut } from '@/app/actions/auth'
import { getUniqueProjects } from '@/lib/permissions/data'
import { ProjectList } from '@/app/components/dashboard/ProjectList'
import { getAccessDiagnostics } from '@/lib/entity-resolver/email-to-entity'
import { getProjectSyncDiagnostic } from '@/lib/sync/sync'

export default async function DashboardPage() {
  unstable_noStore()
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.email) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-red-600">No email associated with your account.</p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Sign Out
          </button>
        </form>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: linksPre } = await supabase
    .from('user_entity_link')
    .select('entity_type, entity_notion_id')
    .eq('user_id', user.id)

  const shouldSync = !linksPre?.length
  const syncResult = shouldSync ? await runSync() : { success: true }

  const isNotionAccessError =
    syncResult.error?.includes('object_not_found') ||
    syncResult.error?.toLowerCase().includes('shared with your integration')

  const { data: links } = await supabase
    .from('user_entity_link')
    .select('entity_type, entity_notion_id')
    .eq('user_id', user.id)

  const hasAccess = links && links.length > 0

  if (!hasAccess) {
    const diag = await getAccessDiagnostics(user.id, user.email!)

    return (
      <div className="bg-white shadow rounded-lg p-6">
        {isNotionAccessError && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-2">Notion integration access required</h3>
            <p className="text-sm text-amber-800 mb-2">
              The Contacten or Contacten (pro) database is not shared with your Notion integration.
              In Notion: open the database → <strong>•••</strong> → <strong>Add connections</strong> → select your
              integration.
            </p>
            <p className="text-xs text-amber-700">Error: {syncResult.error}</p>
          </div>
        )}
        <h2 className="text-xl font-bold text-gray-900 mb-4">No Access</h2>
        <p className="text-gray-600 mb-2">
          Your email ({user.email}) is not linked to any Customer or Contractor
          record. If you just added it in Notion, click Refresh to sync again.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          In Notion, the email must be in a property named &quot;E-mail&quot; or
          &quot;Email&quot; (or configure{' '}
          <code className="bg-gray-100 px-1">EMAIL_PROPERTY_NAME</code> /
          <code className="bg-gray-100 px-1 ml-1">EMAIL_PROPERTY_ID</code> in
          .env.local).
        </p>

        <details className="mb-6 rounded border border-gray-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            Diagnostic info
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-gray-600">
            {diag.error
              ? `Error: ${diag.error}`
              : `Contacten pages: ${diag.customerPagesCount}
Contacten (pro) pages: ${diag.contractorPagesCount}
Contacten data source: ${diag.contactenDataSourceId ?? 'unknown'}
Contacten Pro data source: ${diag.contactenProDataSourceId ?? 'unknown'}
Email property ID: ${diag.emailPropertyIdUsed ?? 'none'}
Emails extracted: ${diag.mappingsCount}
Your email found: ${diag.userEmailInMappings ? 'yes' : 'no'}
entity_email_mapping: ${diag.entityMappingCount} rows
user_entity_link: ${diag.userEntityLinkCount} rows`}
          </pre>
        </details>

        <div className="flex gap-4">
          <form action={refreshAndRevalidate}>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Full refresh
            </button>
          </form>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    )
  }

  const projects = await getUniqueProjects(supabase)
  const projectDiag =
    projects.length === 0 ? await getProjectSyncDiagnostic(user.id) : null

  if (projects.length === 1) {
    redirect(`/dashboard/projects/${encodeURIComponent(projects[0].notion_page_id)}`)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {isNotionAccessError && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <h3 className="font-semibold text-amber-900 mb-2">Notion integration access required</h3>
          <p className="text-sm text-amber-800 mb-2">
            The Contacten database is not shared with your Notion integration. In Notion: open{' '}
            <strong>AD Contacten</strong> → <strong>•••</strong> → <strong>Add connections</strong> →
            select your integration.
          </p>
          <p className="text-xs text-amber-700">Error: {syncResult.error}</p>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">Welcome, {user.email}</p>
        </div>
        <form action={refreshAndRevalidate}>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Full refresh
          </button>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Projects</h3>
        <ProjectList projects={projects} />
        {projectDiag && (
          <details className="mt-4 rounded border border-gray-200 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-gray-700">
              Project sync info
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-gray-600">
              {projectDiag.error
                ? `Error: ${projectDiag.error}`
                : `Projecten property ID (Contacten Pro): ${projectDiag.projectenPropertyIdPro ?? 'not found'}
Project IDs from your contacts: ${projectDiag.projectIdsFromContacts}
Projects in cache: ${projectDiag.projectsCached}
${projectDiag.propertyNamesFromSchema ? `Properties in Contacten Pro schema: ${projectDiag.propertyNamesFromSchema}` : ''}

Important: The Projects database (that the Projecten relation links to) must be shared with your Notion integration. In Notion: open the Projects database → ••• → Add connections → select your integration. Relation properties are hidden from the API until the related database is shared.`}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
