import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVaccineLibraryEntry } from '../services/vaccineLibraryService'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'
import { LibraryDetail } from '../components/library/LibraryDetail'
import { FullPageSpinner } from '../components/ui/Spinner'
import { useTheme } from '../contexts/ThemeContext'

export function LibraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [entry, setEntry] = useState<VaccineLibraryEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getVaccineLibraryEntry(id).then(e => { setEntry(e); setLoading(false) })
  }, [id])

  if (loading) return <FullPageSpinner />
  if (!entry) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 dark:text-gray-500 dark:bg-gray-900">
      Not found.
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div
        className="sticky top-0 z-10 px-4 pt-safe border-b border-white/20 dark:border-white/10"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
        }}
      >
        <div className="flex items-center gap-3 h-14 max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900 dark:text-white flex-1 truncate">{entry.Vac_Name}</h1>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <LibraryDetail entry={entry} />
      </div>
    </div>
  )
}
