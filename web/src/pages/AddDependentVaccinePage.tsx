import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAllVaccineLibraryEntries, searchLibrary } from '../services/vaccineLibraryService'
import { addDependentVaccine, getDependents } from '../services/dependentsService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import { getPractitionersForVaccineType } from '../services/practitionersService'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'
import type { Dependent } from '../types/dependent'
import type { Clinic, Practitioner } from '../types/admin'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'
import { VaccineRequestModal } from '../components/ui/VaccineRequestModal'
import { VACCINE_STATUS_COLOURS } from '../types/vaccineLibrary'

export function AddDependentVaccinePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { depId } = useParams<{ depId: string }>()
  const location = useLocation()

  const preselected = (location.state as { preselected?: VaccineLibraryEntry } | null)?.preselected ?? null

  const [step, setStep] = useState<'search' | 'details'>(preselected ? 'details' : 'search')
  const [library, setLibrary] = useState<VaccineLibraryEntry[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [selected, setSelected] = useState<VaccineLibraryEntry | null>(preselected)
  const [dependent, setDependent] = useState<Dependent | null>(null)
  const [saving, setSaving] = useState(false)
  const [showVaccineRequest, setShowVaccineRequest] = useState(false)

  const [form, setForm] = useState({
    date_administration: new Date().toISOString().split('T')[0],
    Clinic: '',
    Doctor: '',
    Expiration_date: '',
    Notes: '',
  })

  useEffect(() => {
    getAllVaccineLibraryEntries().then(all => {
      setLibrary(all.filter(e => e.category === 'human_child'))
    })
    getClinicsForVaccineType('human').then(setClinics)
    getPractitionersForVaccineType('human').then(setPractitioners)
    if (user && depId) {
      getDependents(user.uid).then(deps => {
        setDependent(deps.find(d => d.id === depId) ?? null)
      })
    }
  }, [user, depId])

  const results = searchLibrary(library, searchQ).slice(0, 30)
  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  async function saveForPendingRequest(): Promise<string | null> {
    if (!user || !selected || !depId) return null
    try {
      return await addDependentVaccine(user.uid, depId, {
        user_id:             user.uid,
        vaccine_id:          selected.id,
        vaccine_name:        selected.Vac_Name,
        Vaccine_Reference:   selected['Brand Name'] ?? selected.Vac_Name,
        date_administration: new Date(form.date_administration).toISOString(),
        Clinic:              form.Clinic,
        Doctor:              form.Doctor,
        Photo_Evidence:      '',
        Supporting_files:    [],
        Expiration_date:     form.Expiration_date ? new Date(form.Expiration_date).toISOString() : null,
        Authenticated:       null,
        Authentication_Date: null,
        authentication_level: 0,
        Authenticator:       null,
        Favourited:          false,
        pending_validation:  false,
        validator_email:     '',
        Notes:               form.Notes || undefined,
      })
    } catch (err) {
      console.error('saveForPendingRequest failed:', err)
      return null
    }
  }

  async function save() {
    if (!user || !selected || !depId) return
    setSaving(true)
    try {
      await addDependentVaccine(user.uid, depId, {
        user_id: user.uid,
        vaccine_id: selected.id,
        vaccine_name: selected.Vac_Name,
        Vaccine_Reference: selected['Brand Name'] ?? selected.Vac_Name,
        date_administration: new Date(form.date_administration).toISOString(),
        Clinic: form.Clinic,
        Doctor: form.Doctor,
        Photo_Evidence: '',
        Supporting_files: [],
        Expiration_date: form.Expiration_date ? new Date(form.Expiration_date).toISOString() : null,
        Authenticated: null,
        Authentication_Date: null,
        authentication_level: 0,
        Authenticator: null,
        Favourited: false,
        pending_validation: false,
        validator_email: '',
        Notes: form.Notes || undefined,
      })
      navigate(-1)
    } catch (e) {
      console.error(e)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 'search' ? 'Select Vaccine' : 'Add Details'}
          </h1>
          {dependent && (
            <p className="text-xs text-gray-500 dark:text-gray-400">for {dependent.name}</p>
          )}
        </div>
      </div>

      {/* Step 1: Search */}
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
                placeholder="Search children's vaccines, diseases, brands…"
                className="w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {results.map(entry => (
              <button
                key={entry.id}
                onClick={() => { setSelected(entry); setStep('details') }}
                className="w-full text-left py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 active:bg-gray-50 dark:active:bg-gray-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{entry.Vac_Name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry['Disease Target']} · {entry.Manufacturer}</p>
                  </div>
                  {entry.status && entry.status !== 'available' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${VACCINE_STATUS_COLOURS[entry.status]}`}>
                      {entry.status === 'trial' ? 'Trial' : 'Pre-market'}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {results.length === 0 && searchQ && (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-8">No vaccines found for "{searchQ}"</p>
            )}
            {!searchQ && (
              <p className="text-center text-gray-300 dark:text-gray-600 text-sm mt-12">Start typing to search the vaccine library</p>
            )}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Can't find the vaccine you're looking for?</p>
              <button onClick={() => setShowVaccineRequest(true)} className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Request a new vaccine be added
              </button>
            </div>
          </div>
        </div>
      )}

      {showVaccineRequest && <VaccineRequestModal initialName={searchQ} onClose={() => setShowVaccineRequest(false)} />}

      {/* Step 2: Details */}
      {step === 'details' && selected && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Selected vaccine chip */}
          <div className="rounded-2xl p-3 mb-4 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">{selected.Vac_Name}</p>
              <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                {selected['Disease Target']} · {selected.Manufacturer}
              </p>
            </div>
            <button onClick={() => setStep('search')} className="text-xs text-blue-500 font-medium ml-2 flex-shrink-0">
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
            <ClinicCombobox
              value={form.Clinic}
              onChange={v => update('Clinic', v)}
              clinics={clinics}
              userCountry={profile?.currentCountry ?? profile?.Passport_Issuing_Country ?? ''}
              vaccineContext={selected && depId ? {
                vaccineId:   selected.id,
                vaccineName: selected.Vac_Name,
                date:        form.date_administration,
                doctor:      form.Doctor || undefined,
                targetType:  'dependent',
                targetId:    depId,
              } : undefined}
              onSaveVaccine={selected ? saveForPendingRequest : undefined}
              onRequestComplete={() => navigate(-1)}
            />
            <PractitionerCombobox
              value={form.Doctor}
              onChange={v => update('Doctor', v)}
              onSelect={(name, clinicName) => {
                update('Doctor', name)
                if (!form.Clinic && clinicName) update('Clinic', clinicName)
              }}
              practitioners={practitioners}
              label="Doctor / Nurse"
              preferClinic={form.Clinic}
              vaccineContext={selected && depId ? {
                vaccineId:   selected.id,
                vaccineName: selected.Vac_Name,
                date:        form.date_administration,
                doctor:      form.Doctor || undefined,
                targetType:  'dependent',
                targetId:    depId,
              } : undefined}
              onSaveVaccine={selected ? saveForPendingRequest : undefined}
              onRequestComplete={() => navigate(-1)}
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
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
