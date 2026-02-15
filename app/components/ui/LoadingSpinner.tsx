type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
}

export function LoadingSpinner({ size = 'md' }: { size?: Size }) {
  return (
    <div
      className={`animate-spin rounded-full border-gray-200 border-t-indigo-600 ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  )
}
