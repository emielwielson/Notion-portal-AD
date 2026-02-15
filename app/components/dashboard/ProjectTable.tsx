import type { ReactNode } from 'react'
import type { FilteredProject } from '@/lib/permissions/data'
import { MeetingLink } from './MeetingLink'

type ProjectTableProps = {
  projects: FilteredProject[]
}

const COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'adres1', label: 'Adres 1' },
  { key: 'adres2', label: 'Adres 2' },
  { key: 'type', label: 'Type' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'contractOndertekend', label: 'Contract ondertekend' },
  { key: 'factuurBetaald', label: 'Factuur betaald' },
] as const

function formatValue(key: string, value: unknown): ReactNode {
  if (value == null || value === '') return '—'

  if (key === 'meeting') {
    return <MeetingLink url={typeof value === 'string' ? value : undefined} />
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

function hasColumn(
  key: string,
  contactType: 'customer' | 'contractor'
): boolean {
  if (contactType === 'customer') {
    return ['status', 'adres1', 'adres2', 'contractOndertekend', 'factuurBetaald'].includes(key)
  }
  return ['status', 'adres1', 'adres2', 'type', 'meeting'].includes(key)
}

export function ProjectTable({ projects }: ProjectTableProps) {
  if (projects.length === 0) {
    return <p className="text-gray-500">No projects found.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Role
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {projects.map((p) => (
            <tr key={`${p.contact_notion_id}-${p.contact_type}-${p.notion_page_id}`}>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    p.contact_type === 'customer'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {p.contact_type}
                </span>
              </td>
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3 text-sm text-gray-900"
                >
                  {hasColumn(col.key, p.contact_type)
                    ? formatValue(col.key, p.properties[col.key])
                    : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
