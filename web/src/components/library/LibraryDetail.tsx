import { useNavigate } from 'react-router-dom'
import type { VaccineLibraryEntry } from '../../types/vaccineLibrary'
import { VACCINE_CATEGORY_LABELS, VACCINE_CATEGORY_COLOURS } from '../../types/vaccineLibrary'
import { Button } from '../ui/Button'

interface Props {
  entry: VaccineLibraryEntry
  /** If true, renders the "Add to My Vaccines" button */
  showAddButton?: boolean
  /** Called when user clicks the add button (defaults to navigating to /vaccines/add) */
  onAdd?: () => void
  /** Compact mode — removes sticky header, used when embedded in split pane */
  embedded?: boolean
}

export function LibraryDetail({ entry, showAddButton = true, onAdd, embedded = false }: Props) {
  const navigate = useNavigate()

  const rows = [
    { label: 'Disease Target',      value: entry['Disease Target'] },
    { label: 'Brand Name',          value: entry['Brand Name'] },
    { label: 'Manufacturer',        value: entry.Manufacturer },
    { label: 'Type / Technology',   value: entry['Type/Technology'] },
    { label: 'Administration',      value: entry.Administration },
    { label: 'Dosing Schedule',     value: entry['Dosing Schedule'] },
    { label: 'Storage Requirements',value: entry['Storage Requirements'] },
    { label: 'Efficacy Rate',       value: entry['Efficacy Rate'] },
    { label: 'Age Group',           value: entry['Age Group'] },
    { label: 'Target Population',   value: entry['Target Population'] },
    { label: 'Geographic Priority', value: entry['Geographic Priority'] },
    { label: 'Disease Prevalence',  value: entry['Disease Prevalence'] },
  ]

  const handleAdd = onAdd ?? (() => navigate('/vaccines/add', { state: { preselected: entry } }))

  return (
    <div className={`space-y-3 ${embedded ? 'pb-6' : 'pb-32'}`}>
      {/* Title card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug flex-1">{entry.Vac_Name}</h2>
          {entry.category && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${VACCINE_CATEGORY_COLOURS[entry.category]}`}>
              {VACCINE_CATEGORY_LABELS[entry.category]}
            </span>
          )}
        </div>
        {entry['Short Description'] && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{entry['Short Description']}</p>
        )}
        {entry['Long Description'] && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{entry['Long Description']}</p>
        )}
      </div>

      {/* Data rows */}
      <div className="grid grid-cols-1 gap-2">
        {rows.filter(r => r.value).map(row => (
          <div key={row.label} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{row.label}</p>
            <p className="text-sm text-gray-900 dark:text-white mt-0.5">{row.value}</p>
          </div>
        ))}
      </div>

      {/* Special notes */}
      {entry['Special Notes'] && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-700">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Special Notes</p>
          <p className="text-sm text-amber-800 dark:text-amber-200">{entry['Special Notes']}</p>
        </div>
      )}

      {/* Add button */}
      {showAddButton && (
        <Button size="lg" fullWidth onClick={handleAdd}>
          Add to My Vaccines
        </Button>
      )}
    </div>
  )
}
