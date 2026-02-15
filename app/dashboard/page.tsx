import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import { runSync, refreshAndRevalidate } from '@/app/actions/sync'
import { signOut } from '@/app/actions/auth'
import { getFilteredProjects } from '@/lib/permissions/data'

export default async function DashboardPage() {
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

  await runSync()

  const supabase = await createClient()
  const { data: links } = await supabase
    .from('user_entity_link')
    .select('entity_type, entity_notion_id')
    .eq('user_id', user.id)

  const hasAccess = links && links.length > 0

  if (!hasAccess) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">No Access</h2>
        <p className="text-gray-600">
          Your email is not linked to any Customer or Contractor record. Please
          contact your administrator.
        </p>
        <form action={signOut} className="mt-6">
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

  const projects = await getFilteredProjects(supabase)

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">Welcome, {user.email}</p>
          <p className="text-sm text-gray-600">
            You have access to {links!.length} contact
            {links!.length === 1 ? '' : 's'}.
          </p>
        </div>
        <form action={refreshAndRevalidate}>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Projects</h3>
        {!projects || projects.length === 0 ? (
          <p className="text-gray-500">No projects found.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {projects.map((p) => {
              const props = p.properties
              const title =
                (props.adres1 as string) ||
                (props.status as string) ||
                p.notion_page_id
              return (
                <li key={`${p.contact_notion_id}-${p.contact_type}-${p.notion_page_id}`} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {title}
                      </span>
                      <span
                        className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          p.contact_type === 'customer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {p.contact_type}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    {Object.entries(props)
                      .filter(([, v]) => v != null && v !== '')
                      .map(([k, v]) => (
                        <div key={k}>
                          <span className="font-medium capitalize">
                            {k.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>{' '}
                          {k === 'meeting' && typeof v === 'string' && v.startsWith('http') ? (
                            <a
                              href={v}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              Open Meeting
                            </a>
                          ) : typeof v === 'boolean' ? (
                            v ? 'Yes' : 'No'
                          ) : (
                            String(v)
                          )}
                        </div>
                      ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
