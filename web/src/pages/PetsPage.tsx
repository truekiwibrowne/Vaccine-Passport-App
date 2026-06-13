import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPets, deletePet, getPetVaccines } from '../services/petsService'
import type { Pet } from '../types/pet'
import { PET_SPECIES_LABELS } from '../types/pet'
import { PetAvatar } from '../components/pets/PetAvatar'
import { PetFormModal } from '../components/pets/PetFormModal'

interface PetStats {
  total: number
  expiringSoon: number
  expired: number
}

export function PetsPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [pets, setPets]             = useState<Pet[]>([])
  const [loading, setLoading]       = useState(true)
  const [petStats, setPetStats]     = useState<Record<string, PetStats>>({})
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Pet | null>(null)

  useEffect(() => {
    if (!user) return
    getPets(user.uid)
      .then(fetchedPets => {
        setPets(fetchedPets)
        fetchedPets.forEach(pet => {
          getPetVaccines(user.uid, pet.id).then(vaxes => {
            const now = Date.now()
            const expiringSoon = vaxes.filter(v => {
              if (!v.Expiration_date) return false
              const diff = new Date(v.Expiration_date).getTime() - now
              return diff >= 0 && diff <= 30 * 86_400_000
            }).length
            const expired = vaxes.filter(v => {
              if (!v.Expiration_date) return false
              return new Date(v.Expiration_date).getTime() < now
            }).length
            setPetStats(prev => ({
              ...prev,
              [pet.id]: { total: vaxes.length, expiringSoon, expired },
            }))
          })
        })
      })
      .finally(() => setLoading(false))
  }, [user])

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(pet: Pet) {
    setEditing(pet)
    setModalOpen(true)
  }

  function handlePetSaved(pet: Pet, isNew: boolean) {
    if (isNew) {
      setPets(prev => [pet, ...prev])
    } else {
      setPets(prev => prev.map(p => p.id === pet.id ? pet : p))
    }
  }

  async function handleDelete(pet: Pet) {
    if (!user) return
    if (!window.confirm(`Remove ${pet.name}? This will not delete their vaccine records.`)) return
    try {
      await deletePet(user.uid, pet.id)
      setPets(prev => prev.filter(p => p.id !== pet.id))
    } catch (e) {
      console.error(e)
      alert('Error deleting. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 pt-safe">
        <div className="flex items-center h-14 gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg">My Pets</h1>
          <button
            onClick={() => navigate('/transfer/claim')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Claim a code"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </button>
          <button
            onClick={openAdd}
            className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-32 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : pets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🐾</p>
            <p className="font-medium text-gray-500 dark:text-gray-400">No pets yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Tap + to add your first pet</p>
          </div>
        ) : (
          pets.map(pet => {
            const stats = petStats[pet.id]
            return (
              <div
                key={pet.id}
                onClick={() => navigate(`/pets/${pet.id}`)}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm cursor-pointer active:opacity-80 transition-opacity"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <PetAvatar pet={pet} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-base">{pet.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {PET_SPECIES_LABELS[pet.species]}{pet.breed ? ` · ${pet.breed}` : ''}
                      </p>
                      {pet.chipId && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>📡</span> {pet.chipId}
                        </p>
                      )}
                      {!pet.chipId && pet.identificationNumber && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>🏷️</span> {pet.identificationNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(pet) }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:scale-90 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(pet) }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 active:scale-90 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Vaccine mini-dashboard ───────────────────────────── */}
                {!stats ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="h-5 w-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-2 w-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : stats.total === 0 ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">No vaccine records yet</p>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Total</span>
                      </div>
                      <div className="w-px h-7 bg-gray-100 dark:bg-gray-700" />
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <span className={`text-lg font-bold ${stats.total - stats.expired > 0 ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`}>
                          {stats.total - stats.expired}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Active</span>
                      </div>
                      <div className="w-px h-7 bg-gray-100 dark:bg-gray-700" />
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <span className={`text-lg font-bold ${stats.expired > 0 ? 'text-red-500' : 'text-gray-400 dark:text-gray-600'}`}>
                          {stats.expired}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Expired</span>
                      </div>
                    </div>
                    {stats.expiringSoon > 0 && (
                      <p className="text-xs text-orange-500 font-medium mt-2">
                        ⚠️ {stats.expiringSoon} vaccine{stats.expiringSoon !== 1 ? 's' : ''} expiring within 30 days
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <PetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        userId={user?.uid ?? ''}
        onSaved={handlePetSaved}
      />
    </div>
  )
}
