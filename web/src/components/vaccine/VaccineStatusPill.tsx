interface Props {
  authenticated: boolean | null
  pending: boolean
  level?: number
}

export function VaccineStatusPill({ authenticated, pending, level }: Props) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        Pending Review
      </span>
    )
  }
  if (authenticated === true) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Verified {level ? `· L${level}` : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Self-Reported
    </span>
  )
}
