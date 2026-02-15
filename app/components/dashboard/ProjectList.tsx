import Link from 'next/link'
import type { UniqueProject } from '@/lib/permissions/data'
import { MeetingLink } from './MeetingLink'

type ProjectListProps = {
  projects: UniqueProject[]
}

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

export function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return <p className="text-gray-500">No projects found.</p>
  }

  return (
    <ul className="divide-y divide-gray-200">
      {projects.map((p) => (
        <li key={p.notion_page_id}>
          <Link
            href={`/dashboard/projects/${encodeURIComponent(p.notion_page_id)}`}
            className="block px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-gray-900">
                {(p.properties.title && String(p.properties.title).trim())
                  ? String(p.properties.title).trim()
                  : '—'}
              </span>
              <span className="text-gray-600">
                {formatValue('status', p.properties.status)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
