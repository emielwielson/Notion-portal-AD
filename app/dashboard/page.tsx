import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import {
  refreshEntityEmailMapping,
  refreshUserEntityLink,
} from '@/lib/entity-resolver/email-to-entity'
import { signOut } from '@/app/actions/auth'

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

  await refreshEntityEmailMapping()
  await refreshUserEntityLink(user.id, user.email)

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

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h2>
      <p className="text-sm text-gray-600 mb-2">Welcome, {user.email}</p>
      <p className="text-sm text-gray-600">
        You have access to {links!.length} contact
        {links!.length === 1 ? '' : 's'}.
      </p>
      <p className="text-sm text-gray-500 mt-4">
        Projects will appear here (Task 4).
      </p>
    </div>
  )
}
