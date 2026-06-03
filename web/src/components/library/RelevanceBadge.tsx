import { relevanceLabel } from '../../utils/relevanceScore'

export function RelevanceBadge({ score }: { score: number }) {
  const label = relevanceLabel(score)
  const styles = {
    High: 'bg-green-100 text-green-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[label]}`}>
      {label} relevance
    </span>
  )
}
