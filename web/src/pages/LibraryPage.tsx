import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVaccineLibrary } from '../hooks/useVaccineLibrary'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { useAuth } from '../contexts/AuthContext'
import { useIpLocation } from '../hooks/useIpLocation'
import { useIsLg } from '../hooks/useMediaQuery'
import { searchLibrary } from '../services/vaccineLibraryService'
import { computeRelevanceScore } from '../utils/relevanceScore'
import { getPets } from '../services/petsService'
import { getFarmAnimals } from '../services/farmService'
import { getContraindication } from '../utils/contraindications'
import type { HealthCondition } from '../utils/contraindications'
import type { VaccineCategory, AnimalVaccineType } from '../types/vaccineLibrary'
import { VACCINE_CATEGORY_LABELS, VACCINE_CATEGORY_COLOURS } from '../types/vaccineLibrary'
import { LibraryCard } from '../components/library/LibraryCard'
import { LibraryDetail } from '../components/library/LibraryDetail'
import { CountryPicker } from '../components/ui/CountryPicker'
import { Spinner } from '../components/ui/Spinner'
import { useTheme } from '../contexts/ThemeContext'

type VaccineTypeFilter = 'all' | 'mRNA' | 'live' | 'inactivated' | 'subunit' | 'viral_vector'
const TYPE_KEYWORDS: Record<Exclude<VaccineTypeFilter, 'all'>, string[]> = {
  mRNA:         ['mrna'],
  live:         ['live attenuated', 'live-attenuated'],
  inactivated:  ['inactivated', 'killed'],
  subunit:      ['subunit', 'protein', 'polysaccharide', 'conjugate', 'recombinant'],
  viral_vector: ['viral vector', 'adenovirus'],
}

const ALL_CATEGORIES: { value: VaccineCategory | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'human_adult', label: 'Human — Adult' },
  { value: 'human_child', label: 'Human — Child' },
  { value: 'animal',      label: 'Animal / Vet' },
]

export function LibraryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile, user } = useAuth()
  const { isDark } = useTheme()
  const { library, loading } = useVaccineLibrary()
  const { vaccines } = useUserVaccines(user?.uid)
  const ipLocation = useIpLocation()
  const isDesktop = useIsLg()

  const initialCategory = (searchParams.get('category') as VaccineCategory | null) ?? 'all'

  const [searchQ, setSearchQ] = useState('')
  const [travelDest, setTravelDest] = useState(profile?.travelDestination ?? '')
  const [typeFilter, setTypeFilter] = useState<VaccineTypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<VaccineCategory | 'all'>(initialCategory)
  const [animalTypeFilter, setAnimalTypeFilter] = useState<AnimalVaccineType | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [hideOwned, setHideOwned] = useState(false)
  // Split-pane state: which vaccine is selected in the detail panel (desktop only)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const healthConditions = (profile?.healthConditions ?? []) as HealthCondition[]
  const isFarmMode = profile?.appMode === 'farm'

  // ── Species sets for relevance gating ────────────────────────────────────
  const [petSpecies, setPetSpecies] = useState<Set<string>>(new Set())
  const [farmSpecies, setFarmSpecies] = useState<Set<string> | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    if (!isFarmMode) {
      getPets(user.uid).then(pets => {
        setPetSpecies(new Set(pets.map(p => p.species)))
      }).catch(() => {/* non-fatal */})
    } else {
      getFarmAnimals(user.uid).then(animals => {
        setFarmSpecies(new Set(animals.map(a => a.species)))
      }).catch(() => {/* non-fatal */})
    }
  }, [user, isFarmMode])

  const scoredAndFiltered = useMemo(() => {
    let results = searchLibrary(library, searchQ)

    if (categoryFilter !== 'all') {
      if (categoryFilter === 'human_adult') {
        results = results.filter(e => !e.category || e.category === 'human_adult')
      } else {
        results = results.filter(e => e.category === categoryFilter)
      }
    }

    if (categoryFilter === 'animal' && animalTypeFilter !== 'all') {
      results = results.filter(e => {
        if (!e.animalTypes) return animalTypeFilter === 'general'
        const types = e.animalTypes.split(',').map(t => t.trim()) as AnimalVaccineType[]
        if (animalTypeFilter === 'general') return types.includes('general')
        return types.includes(animalTypeFilter) || types.includes('general')
      })
    }

    if (typeFilter !== 'all') {
      const keywords = TYPE_KEYWORDS[typeFilter]
      results = results.filter(e =>
        keywords.some(k => (e['Type/Technology'] ?? '').toLowerCase().includes(k))
      )
    }

    if (hideOwned) {
      results = results.filter(e => !vaccines.some(v => v.vaccine_id === e.id))
    }

    const ipCountry = ipLocation.loading ? undefined : ipLocation.country

    return results
      .map(e => ({
        ...e,
        relevanceScore: computeRelevanceScore(e, {
          profile,
          userVaccines: vaccines,
          travelDestination: travelDest || undefined,
          currentCountry: profile?.currentCountry || undefined,
          ipCountry,
          isFarmMode,
          petSpecies,
          farmSpecies,
        }),
        contraindication: getContraindication(e, healthConditions),
      }))
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
  }, [library, searchQ, categoryFilter, animalTypeFilter, typeFilter, hideOwned, profile, vaccines, travelDest, healthConditions, ipLocation, isFarmMode, petSpecies, farmSpecies])

  // Auto-select first result on desktop when list changes
  const selectedEntry = useMemo(
    () => scoredAndFiltered.find(e => e.id === selectedId) ?? null,
    [scoredAndFiltered, selectedId]
  )

  function handleCardClick(id: string) {
    if (isDesktop) {
      setSelectedId(id)
    } else {
      navigate(`/library/${id}`)
    }
  }

  const typeLabels: Record<VaccineTypeFilter, string> = {
    all: 'All Types', mRNA: 'mRNA', live: 'Live', inactivated: 'Inactivated',
    subunit: 'Subunit', viral_vector: 'Viral Vector',
  }

  const categoryTitle = categoryFilter === 'all'
    ? 'Vaccine Library'
    : categoryFilter === 'animal'
      ? 'Animal Vaccine Library'
      : categoryFilter === 'human_child'
        ? 'Paediatric Vaccine Library'
        : 'Vaccine Library'

  // ── Shared header / filter UI (used in both layouts) ──────────────────────
  const filterBar = (
    <div className="space-y-2">
      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
        {ALL_CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setCategoryFilter(value); setAnimalTypeFilter('all'); setSelectedId(null) }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              categoryFilter === value
                ? value === 'all'
                  ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                  : `${VACCINE_CATEGORY_COLOURS[value as VaccineCategory]} border-current`
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Animal species chips — visible only when Animal category is selected */}
      {categoryFilter === 'animal' && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {([
            { value: 'all' as const,      label: 'All Species' },
            { value: 'dog' as const,      label: '🐕 Dog' },
            { value: 'cat' as const,      label: '🐈 Cat' },
            { value: 'horse' as const,    label: '🐴 Horse' },
            { value: 'rabbit' as const,   label: '🐇 Rabbit' },
            { value: 'fish' as const,     label: '🐟 Fish' },
            { value: 'cattle' as const,   label: '🐄 Cattle' },
            { value: 'sheep' as const,    label: '🐑 Sheep' },
            { value: 'pig' as const,      label: '🐷 Swine' },
            { value: 'poultry' as const,  label: '🐔 Poultry' },
            { value: 'general' as const,  label: '🌿 General' },
          ] as { value: AnimalVaccineType | 'all'; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setAnimalTypeFilter(value); setSelectedId(null) }}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                animalTypeFilter === value
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={categoryFilter === 'animal' ? 'Search animal vaccines, diseases…' : 'Search vaccines, diseases…'}
            className="w-full pl-9 pr-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`px-3 rounded-xl border text-sm font-medium transition-colors ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
        >
          Filters
        </button>
      </div>

      {/* Travel picker */}
      {categoryFilter !== 'animal' && (
        <CountryPicker
          value={travelDest}
          onChange={setTravelDest}
          placeholder="✈ Travelling to? (updates relevance)"
          className="[&_input]:bg-orange-50 [&_input]:border-orange-200 [&_input]:text-orange-900 [&_input]:placeholder-orange-400 [&_svg:first-child]:text-orange-400"
        />
      )}

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-600 space-y-3">
          {categoryFilter !== 'animal' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Vaccine Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(typeLabels) as VaccineTypeFilter[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isFarmMode && (
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setHideOwned(h => !h)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${hideOwned ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${hideOwned ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Hide vaccines I already have</span>
            </label>
          )}
        </div>
      )}

      {/* Location / travel banners — IP takes priority; manual country shown as fallback */}
      {!ipLocation.loading && ipLocation.country && !travelDest && categoryFilter !== 'animal' && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-3 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium flex-1">
            Location detected: <strong>{ipLocation.country}</strong> — relevance scores adjusted
          </p>
        </div>
      )}
      {ipLocation.loading && !ipLocation.country && profile?.currentCountry && !travelDest && categoryFilter !== 'animal' && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-3 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium flex-1">
            Current location: <strong>{profile.currentCountry}</strong> — relevance scores adjusted
          </p>
        </div>
      )}
      {travelDest && (
        <div className="bg-orange-50 rounded-xl px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-orange-700 font-medium">
            Travel mode — showing vaccines relevant to <strong>{travelDest}</strong>
          </p>
          <button onClick={() => setTravelDest('')} className="text-orange-400 text-xs">Clear</button>
        </div>
      )}
      {healthConditions.length > 0 && categoryFilter !== 'animal' && (
        <div className="bg-red-50 rounded-xl px-3 py-2">
          <p className="text-xs text-red-600 font-medium">Contraindication warnings active based on your health profile</p>
        </div>
      )}
      {categoryFilter === 'animal' && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-xs text-green-700 dark:text-green-300 font-medium">
            Showing veterinary vaccines — for pets and livestock
          </p>
        </div>
      )}
    </div>
  )

  // ── Desktop split-pane layout ─────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* LEFT PANEL — list */}
        <div className="w-96 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 h-full">
          {/* Header */}
          <div
            className="px-4 pt-5 pb-3 border-b border-gray-200/60 dark:border-gray-700/60"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              background: isDark ? 'rgba(15,15,15,0.80)' : 'rgba(242,242,247,0.80)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-base font-bold text-gray-900 dark:text-white flex-1">{categoryTitle}</h1>
            </div>
            {filterBar}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
              <>
                <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
                  {scoredAndFiltered.length} {categoryFilter === 'animal' ? 'veterinary vaccines' : 'vaccines'} · sorted by relevance
                </p>
                {scoredAndFiltered.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {searchQ ? `No results for "${searchQ}"` : `No ${VACCINE_CATEGORY_LABELS[categoryFilter as VaccineCategory] ?? ''} vaccines yet`}
                    </p>
                  </div>
                ) : (
                  scoredAndFiltered.map(entry => (
                    <LibraryCard
                      key={entry.id}
                      entry={entry}
                      contraindication={entry.contraindication ?? null}
                      alreadyAdded={vaccines.some(v => v.vaccine_id === entry.id)}
                      onSelect={handleCardClick}
                      selected={entry.id === selectedId}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — detail */}
        <div className="flex-1 h-full overflow-y-auto">
          {selectedEntry ? (
            <div className="px-6 py-5">
              <LibraryDetail
                entry={selectedEntry}
                embedded
                showAddButton={true}
                onAdd={() => navigate('/vaccines/add', { state: { preselected: selectedEntry } })}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">Select a vaccine</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Click any vaccine from the list to view its details here</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Mobile full-page layout ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-40 px-4 pt-safe border-b border-white/20 dark:border-white/10"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
        }}
      >
        <div className="flex items-center h-14 gap-2">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">{categoryTitle}</h1>
        </div>
      </div>

      <div className="px-4 py-3 sticky top-14 bg-gray-50 dark:bg-gray-900 z-10 space-y-2">
        {filterBar}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-3 px-4 mt-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {scoredAndFiltered.length} {categoryFilter === 'animal' ? 'veterinary vaccines' : 'vaccines'}
            {travelDest ? ` · travel: ${travelDest}` : ipLocation.country && categoryFilter !== 'animal' ? ` · ${ipLocation.country}` : ' · sorted by relevance'}
          </p>
          {scoredAndFiltered.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {searchQ ? `No results for "${searchQ}"` : `No ${VACCINE_CATEGORY_LABELS[categoryFilter as VaccineCategory] ?? ''} vaccines in the library yet`}
              </p>
              {categoryFilter === 'animal' && !searchQ && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  An administrator can add animal vaccines via the Admin Panel.
                </p>
              )}
            </div>
          ) : (
            scoredAndFiltered.map(entry => (
              <LibraryCard
                key={entry.id}
                entry={entry}
                contraindication={entry.contraindication ?? null}
                alreadyAdded={vaccines.some(v => v.vaccine_id === entry.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
