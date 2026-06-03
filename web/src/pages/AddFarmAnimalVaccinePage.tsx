import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAllVaccineLibraryEntries } from '../services/vaccineLibraryService'
import { addFarmVaccine, getFarmAnimals } from '../services/farmService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import { getPractitionersForVaccineType } from '../services/practitionersService'
import type { VaccineLibraryEntry, AnimalVaccineType } from '../types/vaccineLibrary'
import type { FarmAnimal, FarmSpecies } from '../types/farm'
import type { Clinic, Practitioner } from '../types/admin'
import { FARM_SPECIES_EMOJI, FARM_SPECIES_LABELS } from '../types/farm'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'

// Map farm species to the AnimalVaccineType used in the unified library
const SPECIES_TO_ANIMAL_TYPE: Partial<Record<FarmSpecies, AnimalVaccineType>> = {
  cattle:  'cattle',
  sheep:   'sheep',
  goat:    'sheep',
  pig:     'pig',
  chicken: 'poultry',
  turkey:  'poultry',
  duck:    'poultry',
  goose:   'poultry',
  horse:   'horse',
  rabbit:  'rabbit',
  deer:    'cattle',
  alpaca:  'sheep',
  llama:   'sheep',
  other:   'general',
}

function searchAnimalEntries(
  entries: VaccineLibraryEntry[],
  query: string,
  species?: FarmSpecies,
): VaccineLibraryEntry[] {
  const animalType = species ? SPECIES_TO_ANIMAL_TYPE[species] : undefined

  // Pre-filter: only show entries relevant to the animal's type (or 'general')
  const relevant = animalType
    ? entries.filter(e => {
        if (!e.animalTypes) return true  // no type restriction = show for all animals
        const types = e.animalTypes.split(',').map(t => t.trim())
        return types.includes(animalType) || types.includes('general')
      })
    : entries

  const q = query.toLowerCase().trim()
  if (!q) return relevant

  return relevant.filter(e =>
    e.Vac_Name?.toLowerCase().includes(q) ||
    e['Disease Target']?.toLowerCase().includes(q) ||
    e['Brand Name']?.toLowerCase().includes(q) ||
    e.Manufacturer?.toLowerCase().includes(q) ||
    e.animalTypes?.toLowerCase().includes(q),
  )
}

export function AddFarmAnimalVaccinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { animalId } = useParams<{ animalId: string }>()

  const [step, setStep] = useState<'search' | 'details'>('search')
  const [library, setLibrary] = useState<VaccineLibraryEntry[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [selected, setSelected] = useState<VaccineLibraryEntry | null>(null)
  const [animal, setAnimal] = useState<FarmAnimal | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    date_administration: new Date().toISOString().split('T')[0],
    Clinic: '',
    Doctor: '',
    Expiration_date: '',
    batch_number: '',
    Notes: '',
  })

  useEffect(() => {
    getAllVaccineLibraryEntries()
      .then(all => {
        // Only keep animal-category entries from the unified library
        setLibrary(all.filter(e => e.category === 'animal'))
      })
      .catch(e => {
        setLibraryError(
          e?.code === 'permission-denied'
            ? 'Permission denied — check Firestore rules are published.'
            : 'Could not load the vaccine library. Check your connection and try again.',
        )
      })
    getClinicsForVaccineType('veterinary').then(setClinics)
    getPractitionersForVaccineType('veterinary').then(setPractitioners)
    if (user && animalId) {
      getFarmAnimals(user.uid).then(all => {
        setAnimal(all.find(a => a.id === animalId) ?? null)
      })
    }
  }, [user, animalId])

  const results = useMemo(
    () => searchAnimalEntries(library, searchQ, animal?.species).slice(0, 50),
    [library, searchQ, animal],
  )

  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  async function save() {
    if (!user || !selected || !animalId) return
    setSaving(true)
    try {
      const payload: Parameters<typeof addFarmVaccine>[2] = {
        vaccine_name:      selected.Vac_Name,
        animal_vaccine_id: selected.id,
        disease_target:    selected['Disease Target'] ?? '',
        date_administration: new Date(form.date_administration).toISOString(),
        Expiration_date: form.Expiration_date
          ? new Date(form.Expiration_date).toISOString()
          : null,
      }
      if (form.Clinic)        payload.Clinic        = form.Clinic
      if (form.Doctor)        payload.Doctor        = form.Doctor
      if (form.batch_number)  payload.batch_number  = form.batch_number
      if (form.Notes)         payload.Notes         = form.Notes
      await addFarmVaccine(user.uid, animalId, payload)
      navigate(-1)
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code === 'permission-denied') {
        alert('Permission denied — Firestore rules have not been published yet.')
      } else {
        alert(`Error saving: ${(e as Error)?.message ?? 'Unknown error'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const animalLabel = animal
    ? `${FARM_SPECIES_EMOJI[animal.species]} #${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`
    : ''

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => {
            if (step === 'details') setStep('search')
            else navigate(-1)
          }}
          className="p-2 -ml-2"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-semibold text-gray-900 dark:text-white">
            {step === 'search' ? 'Select Vaccine' : 'Add Details'}
          </h1>
          {animal && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {animalLabel} · {FARM_SPECIES_LABELS[animal.species]}
            </p>
          )}
        </div>
      </div>

      {/* Step 1 — Search */}
      {step === 'search' && (
        <div className="flex-1 flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={
                  animal
                    ? `Search vaccines for ${FARM_SPECIES_LABELS[animal.species]}s…`
                    : 'Search animal vaccines…'
                }
                className="w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:placeholder-gray-400"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Error state */}
            {libraryError && (
              <div className="mt-6 mx-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">⚠️ Library unavailable</p>
                <p className="text-xs text-red-500 dark:text-red-400">{libraryError}</p>
              </div>
            )}

            {/* Empty library */}
            {!libraryError && library.length === 0 && (
              <div className="mt-8 text-center px-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No animal vaccines in the library yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  An admin can add animal vaccines via Admin Panel → Library.
                </p>
              </div>
            )}

            {/* No search results */}
            {!libraryError && library.length > 0 && results.length === 0 && searchQ && (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-8">
                No vaccines found for "{searchQ}"
              </p>
            )}

            {/* Results */}
            {results.map(entry => (
              <button
                key={entry.id}
                onClick={() => { setSelected(entry); setStep('details') }}
                className="w-full text-left py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 active:bg-gray-50 dark:active:bg-gray-700"
              >
                <p className="font-medium text-gray-900 dark:text-white text-sm">{entry.Vac_Name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry['Disease Target']}</p>
                {entry.Manufacturer && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{entry.Manufacturer}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Details */}
      {step === 'details' && selected && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Selected vaccine chip */}
          <div className="rounded-2xl p-3 mb-4 bg-green-50 dark:bg-green-900/30 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">{selected.Vac_Name}</p>
              <p className="text-xs mt-0.5 text-green-600 dark:text-green-400">{selected['Disease Target']}</p>
              {selected.Manufacturer && (
                <p className="text-xs mt-0.5 text-green-500 dark:text-green-400">{selected.Manufacturer}</p>
              )}
            </div>
            <button onClick={() => setStep('search')} className="text-xs text-green-600 font-medium ml-2 flex-shrink-0">
              Change
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label="Date administered *"
              type="date"
              value={form.date_administration}
              onChange={e => update('date_administration', e.target.value)}
            />
            <Input
              label="Vaccine Batch / Lot Number"
              value={form.batch_number}
              onChange={e => update('batch_number', e.target.value)}
              placeholder="e.g. BT20240915-3A"
            />
            <ClinicCombobox
              value={form.Clinic}
              onChange={v => update('Clinic', v)}
              clinics={clinics}
              label="Veterinary Practice"
              placeholder="Search registered vet practices or type a name…"
            />
            <PractitionerCombobox
              value={form.Doctor}
              onChange={v => update('Doctor', v)}
              onSelect={(name, clinicName) => {
                update('Doctor', name)
                if (!form.Clinic && clinicName) update('Clinic', clinicName)
              }}
              practitioners={practitioners}
              label="Veterinarian"
              placeholder="Search registered vets or type a name…"
              preferClinic={form.Clinic}
            />
            <Input
              label="Expiry date (optional)"
              type="date"
              value={form.Expiration_date}
              onChange={e => update('Expiration_date', e.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes (optional)</label>
              <textarea
                value={form.Notes}
                onChange={e => update('Notes', e.target.value)}
                placeholder="Any additional notes…"
                rows={3}
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
          </div>

          <div className="mt-6 pb-10">
            <Button size="lg" fullWidth loading={saving} onClick={save}>
              Save Vaccine Record
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
