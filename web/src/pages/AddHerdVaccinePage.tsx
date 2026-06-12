import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { addFarmVaccine } from '../services/farmService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import { getPractitionersForVaccineType } from '../services/practitionersService'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'
import type { Clinic, Practitioner } from '../types/admin'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'

interface HerdVaccineState {
  herdName: string
  animalIds: string[]
  preselected: VaccineLibraryEntry
}

export function AddHerdVaccinePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const state = (location.state as HerdVaccineState | null)
  const herdName   = state?.herdName   ?? ''
  const animalIds  = state?.animalIds  ?? []
  const preselected = state?.preselected ?? null

  const [clinics,       setClinics]       = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [saving,        setSaving]        = useState(false)
  const [savedCount,    setSavedCount]    = useState(0)
  const [error,         setError]         = useState<string | null>(null)

  const [form, setForm] = useState({
    date_administration: new Date().toISOString().split('T')[0],
    Clinic:         '',
    Doctor:         '',
    Expiration_date:'',
    batch_number:   '',
    Notes:          '',
  })

  useEffect(() => {
    getClinicsForVaccineType('veterinary').then(setClinics)
    getPractitionersForVaccineType('veterinary').then(setPractitioners)
  }, [])

  function update(f: string, v: string) {
    setForm(prev => ({ ...prev, [f]: v }))
  }

  async function save() {
    if (!user || !preselected || animalIds.length === 0) return
    setSaving(true)
    setError(null)
    setSavedCount(0)

    try {
      for (let i = 0; i < animalIds.length; i++) {
        await addFarmVaccine(user.uid, animalIds[i], {
          vaccine_name:        preselected.Vac_Name,
          animal_vaccine_id:   preselected.id,
          disease_target:      preselected['Disease Target'] ?? '',
          date_administration: new Date(form.date_administration).toISOString(),
          Expiration_date:     form.Expiration_date
            ? new Date(form.Expiration_date).toISOString()
            : null,
          Clinic:       form.Clinic  || undefined,
          Doctor:       form.Doctor  || undefined,
          batch_number: form.batch_number || undefined,
          Notes:        form.Notes   || undefined,
        })
        setSavedCount(i + 1)
      }
      navigate(-1)
    } catch (e) {
      console.error(e)
      setError('Something went wrong saving one or more records. Please try again.')
      setSaving(false)
    }
  }

  // Guard — should never arrive here without state
  if (!preselected || animalIds.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No herd data found.</p>
          <Button onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2"
          disabled={saving}
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Add Herd Vaccination</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {herdName} · {animalIds.length} animal{animalIds.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Selected vaccine chip */}
        <div className="rounded-2xl p-3 mb-4 bg-green-50 dark:bg-green-900/30 flex items-center gap-3">
          <span className="text-2xl">💉</span>
          <div className="min-w-0">
            <p className="font-semibold text-green-900 dark:text-green-100 truncate">{preselected.Vac_Name}</p>
            <p className="text-xs mt-0.5 text-green-600 dark:text-green-400">
              {preselected['Disease Target']}
              {preselected.Manufacturer ? ` · ${preselected.Manufacturer}` : ''}
            </p>
          </div>
        </div>

        {/* Herd summary banner */}
        <div className="rounded-2xl p-3 mb-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            This record will be saved for <strong>all {animalIds.length} animals</strong> in <strong>{herdName}</strong>. A separate vaccination entry will be created for each animal.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Date administered *"
            type="date"
            value={form.date_administration}
            onChange={e => update('date_administration', e.target.value)}
          />
          <ClinicCombobox
            value={form.Clinic}
            onChange={v => update('Clinic', v)}
            clinics={clinics}
            userCountry={profile?.currentCountry ?? profile?.Passport_Issuing_Country ?? ''}
          />
          <PractitionerCombobox
            value={form.Doctor}
            onChange={v => update('Doctor', v)}
            onSelect={(name, clinicName) => {
              update('Doctor', name)
              if (!form.Clinic && clinicName) update('Clinic', clinicName)
            }}
            practitioners={practitioners}
            label="Vet / Practitioner"
            preferClinic={form.Clinic}
          />
          <Input
            label="Batch / Lot number (optional)"
            value={form.batch_number}
            onChange={e => update('batch_number', e.target.value)}
            placeholder="e.g. BN-20483"
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
              placeholder="Any notes about this vaccination event…"
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            {savedCount > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                {savedCount} of {animalIds.length} records were saved before the error.
              </p>
            )}
          </div>
        )}

        {/* Save button */}
        <div className="mt-6 pb-10">
          <Button size="lg" fullWidth loading={saving} onClick={save}>
            {saving
              ? `Saving… ${savedCount} / ${animalIds.length}`
              : `Save for all ${animalIds.length} animals`}
          </Button>
        </div>
      </div>
    </div>
  )
}
