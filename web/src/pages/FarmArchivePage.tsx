import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getArchivedFarmAnimals, restoreFarmAnimal, permanentlyDeleteFarmAnimal } from '../services/farmService'
import type { FarmAnimal } from '../types/farm'
import { FARM_SPECIES_LABELS } from '../types/farm'
import { SpeciesBadge, StatusBadge } from './FarmPage'
import { formatDate } from '../utils/dateUtils'

export function FarmArchivePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [animals, setAnimals] = useState<FarmAnimal[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getArchivedFarmAnimals(user.uid)
      .then(setAnimals)
      .finally(() => setLoading(false))
  }, [user])

  async function handleRestore(animal: FarmAnimal) {
    if (!user) return
    const label = animal.name ?? `#${animal.tagNumber}`
    if (!window.confirm(`Restore ${label} to the active herd?`)) return
    setActionId(animal.id)
    try {
      await restoreFarmAnimal(user.uid, animal.id)
      setAnimals(prev => prev.filter(a => a.id !== animal.id))
    } catch {
      alert('Error restoring. Please try again.')
    } finally {
      setActionId(null)
    }
  }

  async function handlePermanentDelete(animal: FarmAnimal) {
    if (!user) return
    const label = animal.name ?? `#${animal.tagNumber}`
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone and will also remove all vaccine records for this animal.`)) return
    setActionId(animal.id)
    try {
      await permanentlyDeleteFarmAnimal(user.uid, animal.id)
      setAnimals(prev => prev.filter(a => a.id !== animal.id))
    } catch {
      alert('Error deleting. Please try again.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="flex items-center gap-2 px-4 pt-safe h-14">
          <button onClick={() => navigate('/farm')} className="p-2 -ml-2" aria-label="Back">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">Archived Animals</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 -mt-0.5">Records removed from active herd</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin" />
        </div>
      ) : animals.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-24">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-sm">Archive is Empty</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
            Archived animals will appear here. You can restore them or permanently delete them.
          </p>
          <button
            onClick={() => navigate('/farm')}
            className="mt-6 px-5 py-2.5 rounded-lg bg-green-700 text-white text-sm font-semibold"
          >
            Back to Farm
          </button>
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-semibold">{animals.length} archived animal{animals.length !== 1 ? 's' : ''}.</span>{' '}
              Restore to return a record to your active herd, or permanently delete to remove it entirely (cannot be undone).
            </p>
          </div>

          {/* Animal list */}
          <div className="mx-4 mt-4 mb-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {animals.map(animal => (
              <div key={animal.id} className="px-4 py-4">
                {/* Animal identity */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{animal.tagNumber}</span>
                      {animal.name && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">— {animal.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <SpeciesBadge species={animal.species} />
                      <StatusBadge status={animal.status} />
                      {animal.breed && (
                        <span className="text-xs text-gray-400">{animal.breed}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {animal.herd && (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Herd: {animal.herd}
                        </span>
                      )}
                      {animal.archivedAt && (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Archived: {formatDate(animal.archivedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {FARM_SPECIES_LABELS[animal.species]}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(animal)}
                    disabled={actionId === animal.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-700 text-white text-xs font-semibold disabled:opacity-50 active:bg-green-800"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    {actionId === animal.id ? 'Restoring…' : 'Restore'}
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(animal)}
                    disabled={actionId === animal.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-300 dark:border-red-700 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-50 active:bg-red-50 dark:active:bg-red-900/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {actionId === animal.id ? 'Deleting…' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
