import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { getDependents, getDependentVaccines } from '../services/dependentsService'
import { getPets, getPetVaccines } from '../services/petsService'
import { getFarmAnimals, getFarmVaccines } from '../services/farmService'
import { generateFarmReport, generatePersonalReport } from '../utils/vaccinationReportPdf'
import type { Dependent } from '../types/dependent'
import type { Pet, PetVaccine } from '../types/pet'
import type { FarmAnimal, FarmVaccine } from '../types/farm'
import type { UserVaccine } from '../types/vaccine'
import { FARM_SPECIES_EMOJI, FARM_SPECIES_LABELS } from '../types/farm'
import { PET_SPECIES_EMOJI, PET_SPECIES_LABELS } from '../types/pet'
import { Spinner } from '../components/ui/Spinner'

// ── Shared helpers ────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
        ${checked
          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}
    >
      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
        ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500'}`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-white'}`}>
          {label}
        </p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}

function FarmToggle({ checked, onChange, label, sub }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
        ${checked
          ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}
    >
      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
        ${checked ? 'bg-green-600 border-green-600' : 'border-gray-300 dark:border-gray-500'}`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${checked ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-white'}`}>
          {label}
        </p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mt-2 mb-1">
      {children}
    </h2>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  FARM REPORT UI
// ─────────────────────────────────────────────────────────────────────────────

function FarmReportUI({ ownerName }: { ownerName: string }) {
  const { user }            = useAuth()
  const [loading, setLoading]   = useState(true)
  const [animals, setAnimals]   = useState<FarmAnimal[]>([])
  const [vaxMap, setVaxMap]     = useState<Record<string, FarmVaccine[]>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!user) return
    getFarmAnimals(user.uid).then(list => {
      setAnimals(list)
      setSelected(new Set(list.map(a => a.id)))
      // Load vaccines for all animals
      list.forEach(a =>
        getFarmVaccines(user.uid, a.id)
          .then(vs => setVaxMap(p => ({ ...p, [a.id]: vs })))
          .catch(() => {})
      )
      setLoading(false)
    })
  }, [user])

  const herds = [...new Set(animals.map(a => a.herd ?? 'Ungrouped'))]

  function toggleAnimal(id: string, on: boolean) {
    setSelected(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })
  }
  function toggleHerd(herd: string, on: boolean) {
    const ids = animals.filter(a => (a.herd ?? 'Ungrouped') === herd).map(a => a.id)
    setSelected(p => {
      const n = new Set(p)
      ids.forEach(id => on ? n.add(id) : n.delete(id))
      return n
    })
  }
  function herdState(herd: string): 'all' | 'none' | 'partial' {
    const ids = animals.filter(a => (a.herd ?? 'Ungrouped') === herd).map(a => a.id)
    const onCount = ids.filter(id => selected.has(id)).length
    return onCount === 0 ? 'none' : onCount === ids.length ? 'all' : 'partial'
  }

  const selectedAnimals = animals.filter(a => selected.has(a.id))
  const totalVax = selectedAnimals.reduce((s, a) => s + (vaxMap[a.id]?.length ?? 0), 0)

  async function generate() {
    setGenerating(true)
    try {
      const records = selectedAnimals.map(animal => ({
        animal,
        vaccines: vaxMap[animal.id] ?? [],
      }))
      generateFarmReport({ ownerName, animals: records })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (animals.length === 0) return (
    <div className="py-12 text-center text-gray-400 dark:text-gray-500">
      <p className="text-sm">No animals registered yet.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-green-50 dark:bg-green-900/20 px-4 py-3 text-center">
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{selectedAnimals.length}</p>
          <p className="text-xs text-green-600 dark:text-green-500 font-medium">Animals</p>
        </div>
        <div className="flex-1 rounded-xl bg-green-50 dark:bg-green-900/20 px-4 py-3 text-center">
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{totalVax}</p>
          <p className="text-xs text-green-600 dark:text-green-500 font-medium">Vaccine Records</p>
        </div>
        <div className="flex-1 rounded-xl bg-green-50 dark:bg-green-900/20 px-4 py-3 text-center">
          <p className="text-xl font-bold text-green-700 dark:text-green-400">
            {herds.length}
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 font-medium">Herds</p>
        </div>
      </div>

      {/* Select / deselect all */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelected(new Set(animals.map(a => a.id)))}
          className="flex-1 py-2 rounded-xl text-xs font-semibold border border-green-300 dark:border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
        >
          Select All
        </button>
        <button
          onClick={() => setSelected(new Set())}
          className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Deselect All
        </button>
      </div>

      {/* Per-herd sections */}
      {herds.map(herd => {
        const state = herdState(herd)
        const herdAnimals = animals.filter(a => (a.herd ?? 'Ungrouped') === herd)
        return (
          <div key={herd}>
            {/* Herd header toggle */}
            <button
              onClick={() => toggleHerd(herd, state !== 'all')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all mb-2
                ${state === 'all'
                  ? 'border-green-300 dark:border-green-600 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : state === 'partial'
                    ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400'}`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${state === 'all' ? 'bg-green-600 border-green-600' : state === 'partial' ? 'bg-green-300 border-green-300' : 'border-gray-400 dark:border-gray-500'}`}>
                {(state === 'all' || state === 'partial') && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={state === 'all' ? 'M5 13l4 4L19 7' : 'M5 12h14'} />
                  </svg>
                )}
              </div>
              <span className="flex-1 text-left">{herd}</span>
              <span className="text-xs opacity-70">{herdAnimals.length} animals</span>
            </button>

            {/* Individual animals */}
            <div className="space-y-1.5 pl-2">
              {herdAnimals.map(animal => {
                const vaccineCount = vaxMap[animal.id]?.length ?? 0
                const emoji = FARM_SPECIES_EMOJI[animal.species] ?? '🐾'
                const label = `${emoji}  ${animal.tagNumber}${animal.name ? ' · ' + animal.name : ''}`
                const sub   = `${FARM_SPECIES_LABELS[animal.species] ?? animal.species}${animal.breed ? ' · ' + animal.breed : ''} · ${vaccineCount} record${vaccineCount !== 1 ? 's' : ''}`
                return (
                  <FarmToggle
                    key={animal.id}
                    checked={selected.has(animal.id)}
                    onChange={on => toggleAnimal(animal.id, on)}
                    label={label}
                    sub={sub}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={generating || selected.size === 0}
        className="w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <Spinner />
            Generating PDF…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF Report ({selected.size} animal{selected.size !== 1 ? 's' : ''})
          </>
        )}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PERSONAL REPORT UI
// ─────────────────────────────────────────────────────────────────────────────

function PersonalReportUI({ ownerName }: { ownerName: string }) {
  const { user }              = useAuth()
  const { vaccines: selfVax } = useUserVaccines(user?.uid)

  const [loading, setLoading]         = useState(true)
  const [dependents, setDependents]   = useState<Dependent[]>([])
  const [depVax, setDepVax]           = useState<Record<string, UserVaccine[]>>({})
  const [pets, setPets]               = useState<Pet[]>([])
  const [petVax, setPetVax]           = useState<Record<string, PetVaccine[]>>({})

  const [includeSelf,   setIncludeSelf]   = useState(true)
  const [selDeps,  setSelDeps]   = useState<Set<string>>(new Set())
  const [selPets,  setSelPets]   = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getDependents(user.uid),
      getPets(user.uid),
    ]).then(([deps, pts]) => {
      setDependents(deps)
      setSelDeps(new Set(deps.map(d => d.id)))
      setPets(pts)
      setSelPets(new Set(pts.map(p => p.id)))

      deps.forEach(dep =>
        getDependentVaccines(user.uid, dep.id)
          .then(vs => setDepVax(p => ({ ...p, [dep.id]: vs })))
      )
      pts.forEach(pet =>
        getPetVaccines(user.uid, pet.id)
          .then(vs => setPetVax(p => ({ ...p, [pet.id]: vs })))
      )
      setLoading(false)
    })
  }, [user])

  function toggleDep(id: string, on: boolean) {
    setSelDeps(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })
  }
  function togglePet(id: string, on: boolean) {
    setSelPets(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })
  }

  const totalSelected =
    (includeSelf ? selfVax.length : 0) +
    [...selDeps].reduce((s, id) => s + (depVax[id]?.length ?? 0), 0) +
    [...selPets].reduce((s, id) => s + (petVax[id]?.length ?? 0), 0)

  const entityCount =
    (includeSelf ? 1 : 0) + selDeps.size + selPets.size

  async function generate() {
    setGenerating(true)
    try {
      generatePersonalReport({
        self: includeSelf ? { name: ownerName, vaccines: selfVax } : undefined,
        dependents: dependents
          .filter(d => selDeps.has(d.id))
          .map(dep => ({ dependent: dep, vaccines: depVax[dep.id] ?? [] })),
        pets: pets
          .filter(p => selPets.has(p.id))
          .map(pet => ({ pet, vaccines: petVax[pet.id] ?? [] })),
      })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-center">
          <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{entityCount}</p>
          <p className="text-xs text-blue-600 dark:text-blue-500 font-medium">Entities</p>
        </div>
        <div className="flex-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-center">
          <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{totalSelected}</p>
          <p className="text-xs text-blue-600 dark:text-blue-500 font-medium">Vaccine Records</p>
        </div>
      </div>

      {/* My Vaccines */}
      <SectionHeading>My Vaccines</SectionHeading>
      <Toggle
        checked={includeSelf}
        onChange={setIncludeSelf}
        label={ownerName}
        sub={`${selfVax.length} record${selfVax.length !== 1 ? 's' : ''}`}
      />

      {/* Dependents */}
      {dependents.length > 0 && (
        <>
          <SectionHeading>Dependents</SectionHeading>
          <div className="space-y-1.5">
            {/* Select/deselect all deps */}
            <div className="flex gap-2 mb-1">
              <button
                onClick={() => setSelDeps(new Set(dependents.map(d => d.id)))}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >All</button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button
                onClick={() => setSelDeps(new Set())}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
              >None</button>
            </div>
            {dependents.map(dep => (
              <Toggle
                key={dep.id}
                checked={selDeps.has(dep.id)}
                onChange={on => toggleDep(dep.id, on)}
                label={`👶 ${dep.name}`}
                sub={`${depVax[dep.id]?.length ?? 0} record${(depVax[dep.id]?.length ?? 0) !== 1 ? 's' : ''}${dep.dateOfBirth ? ' · DOB: ' + dep.dateOfBirth : ''}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Pets */}
      {pets.length > 0 && (
        <>
          <SectionHeading>Pets</SectionHeading>
          <div className="space-y-1.5">
            <div className="flex gap-2 mb-1">
              <button
                onClick={() => setSelPets(new Set(pets.map(p => p.id)))}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >All</button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button
                onClick={() => setSelPets(new Set())}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
              >None</button>
            </div>
            {pets.map(pet => (
              <Toggle
                key={pet.id}
                checked={selPets.has(pet.id)}
                onChange={on => togglePet(pet.id, on)}
                label={`${PET_SPECIES_EMOJI[pet.species]} ${pet.name}`}
                sub={`${PET_SPECIES_LABELS[pet.species]}${pet.breed ? ' · ' + pet.breed : ''} · ${petVax[pet.id]?.length ?? 0} record${(petVax[pet.id]?.length ?? 0) !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Generate */}
      <button
        onClick={generate}
        disabled={generating || entityCount === 0}
        className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <Spinner />
            Generating PDF…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF Report
          </>
        )}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function VaccinationReportPage() {
  const navigate         = useNavigate()
  const { profile, user } = useAuth()
  const { isDark }       = useTheme()
  const isFarmMode       = profile?.appMode === 'farm'

  const ownerName = profile?.Full_Name ?? profile?.Username ?? user?.email ?? 'User'

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 pb-28 ${isDark ? 'dark' : ''}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="h-14 flex items-center px-4 gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft />
          </button>
          <h1 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">
            Vaccination Report
          </h1>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            isFarmMode
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          }`}>
            {isFarmMode ? 'Farm' : 'Personal'}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5">
        {/* Info banner */}
        <div className={`rounded-2xl px-4 py-3.5 mb-5 flex items-start gap-3 ${
          isFarmMode
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
        }`}>
          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isFarmMode ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <p className={`text-sm font-semibold ${isFarmMode ? 'text-green-800 dark:text-green-300' : 'text-blue-800 dark:text-blue-300'}`}>
              {isFarmMode ? 'Livestock Vaccination Record' : 'Vaccination Summary Report'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isFarmMode
                ? 'Select which animals to include. The report is grouped by herd and includes vaccination dates, batch numbers, and expiry dates.'
                : 'Select who to include. The report covers all administered vaccines, authentication status, and expiry dates.'}
            </p>
          </div>
        </div>

        {isFarmMode
          ? <FarmReportUI ownerName={ownerName} />
          : <PersonalReportUI ownerName={ownerName} />
        }
      </div>
    </div>
  )
}
