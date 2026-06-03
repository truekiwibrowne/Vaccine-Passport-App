import { useNavigate } from 'react-router-dom'
import type { VaccineLibraryEntry } from '../../types/vaccineLibrary'
import { RelevanceBadge } from './RelevanceBadge'

interface Props {
  entry: VaccineLibraryEntry
  contraindication?: string | null
  alreadyAdded?: boolean
  /** When provided, clicking calls this instead of navigating (split-pane desktop mode) */
  onSelect?: (id: string) => void
  /** Highlight this card as selected (split-pane) */
  selected?: boolean
}

export function LibraryCard({ entry, contraindication, alreadyAdded, onSelect, selected }: Props) {
  const navigate = useNavigate()
  const handleClick = () => onSelect ? onSelect(entry.id) : navigate(`/library/${entry.id}`)
  return (
    <div
      onClick={handleClick}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border cursor-pointer active:scale-[0.98] transition-all ${
        selected
          ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500'
          : 'border-gray-100 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{entry.Vac_Name}</p>
            {alreadyAdded && (
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">✓ Added</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {entry['Disease Target']} · {entry.Manufacturer}
          </p>
        </div>
        {entry.relevanceScore !== undefined && (
          <RelevanceBadge score={entry.relevanceScore} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {entry['Type/Technology'] && (
          <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{entry['Type/Technology']}</span>
        )}
        {entry['Age Group'] && (
          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{entry['Age Group']}</span>
        )}
      </div>

      {contraindication && (
        <div className="mt-2.5 flex items-start gap-1.5 bg-red-50 dark:bg-red-900/20 rounded-xl px-2.5 py-2">
          <svg className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-red-600">{contraindication}</p>
        </div>
      )}
    </div>
  )
}
