import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { QRCodeSVG } from 'qrcode.react'
import { getPets, getPetVaccines, deletePetVaccine } from '../services/petsService'
import type { Pet, PetVaccine } from '../types/pet'
import { PET_SPECIES_EMOJI, PET_SPECIES_LABELS } from '../types/pet'
// PET_SPECIES_EMOJI still used in the header title fallback below
import { formatDate } from '../utils/dateUtils'
import { ShareManageModal } from '../components/ui/ShareManageModal'
import { PetAvatar } from '../components/pets/PetAvatar'
import { PetFormModal } from '../components/pets/PetFormModal'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export function PetVaccinesPage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { petId } = useParams<{ petId: string }>()

  const [pet, setPet]         = useState<Pet | null>(null)
  const [vaccines, setVaccines] = useState<PetVaccine[]>([])
  const [loading, setLoading]   = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [editOpen, setEditOpen]   = useState(false)

  useEffect(() => {
    if (!user || !petId) return
    Promise.all([
      getPets(user.uid),
      getPetVaccines(user.uid, petId),
    ]).then(([pets, vaxes]) => {
      setPet(pets.find(p => p.id === petId) ?? null)
      setVaccines(vaxes)
    }).finally(() => setLoading(false))
  }, [user, petId])

  async function handleDelete(v: PetVaccine) {
    if (!user || !petId) return
    if (!window.confirm(`Remove ${v.vaccine_name}?`)) return
    try {
      await deletePetVaccine(user.uid, petId, v.pet_vaccine_id)
      setVaccines(prev => prev.filter(x => x.pet_vaccine_id !== v.pet_vaccine_id))
    } catch (e) {
      console.error(e)
      alert('Error deleting. Please try again.')
    }
  }

  function handleShare() {
    if (!user || !petId) return
    const url = `${APP_URL}/verify/pet/${user.uid}/${petId}`
    if (navigator.share) {
      navigator.share({ title: `${pet?.name ?? 'Pet'}'s Vaccination Passport`, url })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }

  const qrUrl = user && petId ? `${APP_URL}/verify/pet/${user.uid}/${petId}` : ''
  const emoji = pet ? PET_SPECIES_EMOJI[pet.species] : '🐾'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* Faint pet photo background */}
      {pet?.profileImage && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <img
            src={pet.profileImage}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.13, filter: 'blur(3px)', transform: 'scale(1.05)' }}
          />
        </div>
      )}
      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 px-4 pt-safe border-b border-white/10"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
        }}
      >
        <div className="flex items-center h-14 gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg truncate flex items-center gap-2">
            {pet?.profileImage ? (
              <span className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 inline-block">
                <img src={pet.profileImage} alt={pet.name} className="w-full h-full object-cover" />
              </span>
            ) : (
              <span>{emoji}</span>
            )}
            {pet ? pet.name : 'Pet'}
          </h1>
          {/* Edit pet */}
          <button
            onClick={() => setEditOpen(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Edit pet profile"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {/* Share access */}
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Manage shared access"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </button>
          {/* Add vaccine */}
          <button
            onClick={() => navigate(`/pets/${petId}/vaccines/add`)}
            className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative z-10 px-4 py-4 pb-32 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Pet info card */}
            {pet && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <PetAvatar pet={pet} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{pet.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {PET_SPECIES_LABELS[pet.species]}{pet.breed ? ` · ${pet.breed}` : ''}
                  </p>
                  {pet.chipId && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                      <span>📡</span>
                      <span className="font-mono tracking-wide">{pet.chipId}</span>
                    </p>
                  )}
                  {!pet.chipId && pet.identificationNumber && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      🏷️ {pet.identificationNumber}
                    </p>
                  )}
                  <span className="inline-block mt-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                    {vaccines.length} vaccine{vaccines.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Vaccine records */}
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Vaccine Records
              </p>
              {vaccines.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center">
                  <p className="font-medium text-gray-500 dark:text-gray-400">No vaccines yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Add their first vaccine record</p>
                  <button
                    onClick={() => navigate(`/pets/${petId}/vaccines/add`)}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 py-2 px-4 rounded-xl bg-blue-50 dark:bg-blue-900/20"
                  >
                    Add Vaccine
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                  {vaccines.map((v, i) => {
                    const isExpiringSoon = v.Expiration_date
                      ? (new Date(v.Expiration_date).getTime() - Date.now()) / 86_400_000 <= 30
                        && new Date(v.Expiration_date).getTime() > Date.now()
                      : false
                    const isExpired = v.Expiration_date
                      ? new Date(v.Expiration_date).getTime() < Date.now()
                      : false
                    return (
                      <div key={v.pet_vaccine_id}>
                        {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />}
                        <div
                          onClick={() => navigate(`/pets/${petId}/vaccines/${v.pet_vaccine_id}`)}
                          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-gray-50 dark:active:bg-gray-800/60 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{v.vaccine_name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300 dark:bg-gray-600" />
                              <span>{v.disease_target}</span>
                              {v.date_administration && <span>· {formatDate(v.date_administration)}</span>}
                              {isExpired && <span className="text-red-400 font-medium">· Expired</span>}
                              {!isExpired && isExpiringSoon && <span className="text-orange-400 font-medium">· Expiring soon</span>}
                            </p>
                            {v.Clinic && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{v.Clinic}</p>}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(v) }}
                            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 active:scale-90 transition-transform flex-shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pet Vaccination Passport QR — below the list */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center mb-3">
                  Pet Vaccination Passport
                </p>
              </div>
              <div className="px-4 pb-4 flex flex-col items-center gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                  <QRCodeSVG value={qrUrl} size={160} level="M" includeMargin />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  {pet?.name ?? 'Pet'} · {vaccines.length} vaccine{vaccines.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 py-2 px-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/40 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share QR
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit pet modal */}
      {pet && (
        <PetFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          editing={pet}
          userId={user?.uid ?? ''}
          onSaved={(updated) => setPet(updated)}
        />
      )}

      {/* Share access modal */}
      {pet && (
        <ShareManageModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          resourceType="pet"
          resourceId={pet.id}
          resourceName={pet.name}
          ownerId={pet.ownerId ?? user?.uid ?? ''}
        />
      )}
    </div>
  )
}
