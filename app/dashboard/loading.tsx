import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  )
}
