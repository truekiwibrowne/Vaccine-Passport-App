export function Spinner({ size = 8 }: { size?: number }) {
  return (
    <div className={`w-${size} h-${size} border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin`} />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
      <Spinner size={10} />
    </div>
  )
}
