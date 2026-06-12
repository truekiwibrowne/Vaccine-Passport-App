import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVaccineLibraryEntry } from '../services/vaccineLibraryService'
import { getPets } from '../services/petsService'
import { getFarmAnimals } from '../services/farmService'
import { getDependents } from '../services/dependentsService'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'
import type { Pet } from '../types/pet'
import { PET_SPECIES_EMOJI, PET_SPECIES_LABELS } from '../types/pet'
import type { FarmAnimal } from '../types/farm'
import { FARM_SPECIES_EMOJI, FARM_SPECIES_LABELS } from '../types/farm'
import type { Dependent } from '../types/dependent'
import { LibraryDetail } from '../components/library/LibraryDetail'
import type { AddDestination } from '../components/library/LibraryDetail'
import { FullPageSpinner } from '../components/ui/Spinner'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

export function LibraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user, profile } = useAuth()
  const isFarmMode = profile?.appMode === 'farm'

  const [entry,          setEntry]          = useState<VaccineLibraryEntry | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [allPets,        setAllPets]        = useState<Pet[]>([])
  const [allFarmAnimals, setAllFarmAnimals] = useState<FarmAnimal[]>([])
  const [dependants,     setDependants]     = useState<Dependent[]>([])

  useEffect(() => {
    if (!id) return
    getVaccineLibraryEntry(id).then(e => { setEntry(e); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!user) return
    getPets(user.uid).then(setAllPets).catch(() => {})
    getFarmAnimals(user.uid).then(setAllFarmAnimals).catch(() => {})
    getDependents(user.uid).then(setDependants).catch(() => {})
  }, [user])

  // Build destination list based on vaccine category
  const destinations = useMemo((): AddDestination[] => {
    if (!entry) return []
    const cat = entry.category

    if (cat === 'animal') {
      // Farm profile → herds first, then individual animals; personal profile → pets only
      if (isFarmMode) {
        const herdMap = new Map<string, typeof allFarmAnimals>()
        const ungrouped: typeof allFarmAnimals = []
        for (const a of allFarmAnimals) {
          if (a.herd) {
            if (!herdMap.has(a.herd)) herdMap.set(a.herd, [])
            herdMap.get(a.herd)!.push(a)
          } else {
            ungrouped.push(a)
          }
        }
        void ungrouped // available for future ungrouped-herd handling
        const herdDests: AddDestination[] = Array.from(herdMap.entries()).map(([herdName, animals]) => ({
          type: 'farm_herd' as const,
          herdAnimalIds: animals.map(a => a.id),
          label: herdName,
          sublabel: `${animals.length} animal${animals.length !== 1 ? 's' : ''}`,
          emoji: FARM_SPECIES_EMOJI[animals[0].species] ?? '🐄',
        }))
        const individualDests: AddDestination[] = allFarmAnimals.map(a => ({
          type: 'farm' as const,
          id: a.id,
          label: a.name || `Tag: ${a.tagNumber}`,
          sublabel: FARM_SPECIES_LABELS[a.species] + (a.herd ? ` · ${a.herd}` : ''),
          emoji: FARM_SPECIES_EMOJI[a.species],
        }))
        return [...herdDests, ...individualDests]
      }
      return allPets.map(p => ({
        type: 'pet' as const,
        id: p.id,
        label: p.name,
        sublabel: PET_SPECIES_LABELS[p.species],
        emoji: PET_SPECIES_EMOJI[p.species],
      }))
    }

    if (cat === 'human_child') {
      return dependants.map(d => ({
        type: 'dependent' as const,
        id: d.id,
        label: d.name,
        emoji: '👶',
      }))
    }

    // human_adult or no category → user + dependants
    return [
      { type: 'self' as const, label: 'My Vaccines', emoji: '💉' },
      ...dependants.map(d => ({
        type: 'dependent' as const,
        id: d.id,
        label: d.name,
        emoji: '👶',
      })),
    ]
  }, [entry, allPets, allFarmAnimals, dependants, isFarmMode])

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
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 truncate">{entry.Vac_Name}</h1>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <LibraryDetail entry={entry} destinations={destinations} />
      </div>
    </div>
  )
}
