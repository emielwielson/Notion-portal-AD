import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import { getProjectById } from '@/lib/permissions/data'
import { MeetingLink } from '@/app/components/dashboard/MeetingLink'

const DETAIL_FIELDS = [
  { key: 'status', label: 'Status' },
  { key: 'adres1', label: 'Adres 1' },
  { key: 'adres2', label: 'Adres 2' },
  { key: 'type', label: 'Type' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'contractOndertekend', label: 'Contract ondertekend' },
  { key: 'factuurBetaald', label: 'Factuur betaald' },
] as const

function formatValue(key: string, value: unknown): React.ReactNode {
  if (value == null || value === '') return '—'
  if (key === 'meeting') {
    return <MeetingLink url={typeof value === 'string' ? value : undefined} />
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object' && value !== null && 'place' in value) {
    const place = (value as { place?: { address?: string; name?: string } }).place
    if (place && typeof place === 'object') {
      const addr = place.address ?? place.name
      if (typeof addr === 'string') return addr
    }
  }
  return String(value)
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const supabase = await createClient()
  const project = await getProjectById(supabase, id)

  if (!project) notFound()

  const projectName =
    project.properties.title && String(project.properties.title).trim()
      ? String(project.properties.title).trim()
      : 'Project details'

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Back to projects
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">{projectName}</h2>

      <dl className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {DETAIL_FIELDS.map(({ key, label }) => (
          <div key={key} className="border-b border-gray-100 pb-3">
            <dt className="text-sm font-medium text-gray-500">{label}</dt>
            <dd className="mt-1 text-gray-900">
              {formatValue(key, project.properties[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
