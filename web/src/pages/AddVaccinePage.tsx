import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { addUserVaccine } from '../services/vaccineService'
import { getAllVaccineLibraryEntries, searchLibrary } from '../services/vaccineLibraryService'
import { getClinics } from '../services/clinicsService'
import { createValidationRequest } from '../services/validationService'
import { uploadFile } from '../services/storageService'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'
import type { Clinic } from '../types/admin'
import { VACCINE_STATUS_LABELS, VACCINE_STATUS_COLOURS } from '../types/vaccineLibrary'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

// ── Clinic combobox: registered clinics + free-text fallback ─────────────────
function ClinicCombobox({
  value, onChange, clinics,
}: { value: string; onChange: (v: string) => void; clinics: Clinic[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = value.trim()
    ? clinics.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : clinics.slice(0, 8)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic / Hospital</label>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search registered clinics or type any name…"
        className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <li
              key={c.id}
              onMouseDown={e => { e.preventDefault(); onChange(c.name); setOpen(false) }}
              className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between"
            >
              <span>{c.name}</span>
              {c.verified && <span className="text-xs text-green-600 font-medium ml-2">✓ Verified</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function AddVaccinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const preselected = (location.state as { preselected?: VaccineLibraryEntry } | null)?.preselected ?? null

  const [step, setStep] = useState<'search' | 'details'>(preselected ? 'details' : 'search')
  const [library, setLibrary] = useState<VaccineLibraryEntry[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [selected, setSelected] = useState<VaccineLibraryEntry | null>(preselected)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    date_administration: new Date().toISOString().split('T')[0],
    Clinic: '',
    Doctor: '',
    Expiration_date: '',
    validator_email: '',   // required for trial/premarket vaccines
  })

  useEffect(() => {
    if (step === 'search') {
      getAllVaccineLibraryEntries().then(setLibrary)
      getClinics().then(setClinics)
    }
  }, [step])

  // Also load clinics when jumping straight to details (pre-selected)
  useEffect(() => {
    if (preselected) getClinics().then(setClinics)
  }, [preselected])

  const results = searchLibrary(library, searchQ).slice(0, 30)
  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  const isRestricted = selected?.status === 'trial' || selected?.status === 'premarket'

  async function save() {
    if (!user || !selected) return
    if (isRestricted && !form.validator_email.trim()) {
      alert('A validator email is required for trial/pre-market vaccines.')
      return
    }
    setSaving(true)
    try {
      let photoUrl = ''
      if (photoFile) {
        try { photoUrl = await uploadFile(user.uid, photoFile, 'evidence') }
        catch (e) { console.warn('Photo upload skipped:', e) }
      }

      const vaccineId = await addUserVaccine(user.uid, {
        user_id: user.uid,
        vaccine_id: selected.id,
        vaccine_name: selected.Vac_Name,
        Vaccine_Reference: selected['Brand Name'] ?? selected.Vac_Name,
        date_administration: new Date(form.date_administration).toISOString(),
        Clinic: form.Clinic,
        Doctor: form.Doctor,
        Photo_Evidence: photoUrl,
        Supporting_files: [],
        Expiration_date: form.Expiration_date ? new Date(form.Expiration_date).toISOString() : null,
        Authenticated: null,
        Authentication_Date: null,
        authentication_level: 0,
        Authenticator: null,
        Favourited: false,
        pending_validation: isRestricted,
        validator_email: isRestricted ? form.validator_email.trim().toLowerCase() : '',
      })

      // For trial/premarket, automatically create the validation request
      if (isRestricted && form.validator_email.trim()) {
        await createValidationRequest({
          user_id: user.uid,
          user_vaccine_id: vaccineId,
          vaccine_name: selected.Vac_Name,
          validator_email: form.validator_email.trim().toLowerCase(),
          requested_at: new Date().toISOString(),
          requestor_email: user.email ?? '',
        })
      }

      navigate('/')
    } catch (e) {
      console.error(e)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header — sticky so it never scrolls away */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => {
            if (step === 'details' && !preselected) setStep('search')
            else navigate(-1)
          }}
          className="p-2 -ml-2"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-900 dark:text-white">
          {step === 'search' ? 'Select Vaccine' : 'Add Details'}
        </h1>
      </div>

      {/* ── STEP 1: Search ── */}
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
                placeholder="Search vaccines, diseases, brands…"
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
          </div>
        </div>
      )}

      {/* ── STEP 2: Details ── */}
      {step === 'details' && selected && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Selected vaccine chip */}
          <div className={`rounded-2xl p-3 mb-4 flex items-center justify-between ${
            isRestricted ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-blue-50 dark:bg-blue-900/30'
          }`}>
            <div>
              <p className={`font-semibold ${isRestricted ? 'text-amber-900 dark:text-amber-100' : 'text-blue-900 dark:text-blue-100'}`}>{selected.Vac_Name}</p>
              <p className={`text-xs mt-0.5 ${isRestricted ? 'text-amber-700 dark:text-amber-300' : 'text-blue-600 dark:text-blue-400'}`}>
                {selected['Disease Target']} · {selected.Manufacturer}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
              {selected.status && selected.status !== 'available' && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${VACCINE_STATUS_COLOURS[selected.status]}`}>
                  {VACCINE_STATUS_LABELS[selected.status]}
                </span>
              )}
              {!preselected && (
                <button onClick={() => setStep('search')} className="text-xs text-blue-500 font-medium">
                  Change
                </button>
              )}
            </div>
          </div>

          {/* Trial / pre-market warning */}
          {isRestricted && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-3 mb-4">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">⚠️ Validation required</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This vaccine is <strong>{VACCINE_STATUS_LABELS[selected.status!]}</strong> and cannot be saved as a
                self-entered record. A validation request will be automatically sent to the practitioner you specify below.
              </p>
            </div>
          )}

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
            />

            <Input
              label="Doctor / Nurse"
              value={form.Doctor}
              onChange={e => update('Doctor', e.target.value)}
              placeholder="Dr. Jane Smith"
            />
            <Input
              label="Expiry date (optional)"
              type="date"
              value={form.Expiration_date}
              onChange={e => update('Expiration_date', e.target.value)}
            />

            {/* Validator email — required for trial/premarket, optional for others */}
            {isRestricted ? (
              <Input
                label="Validator email *"
                type="email"
                value={form.validator_email}
                onChange={e => update('validator_email', e.target.value)}
                placeholder="practitioner@clinic.com"
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Request validation (optional)
                </label>
                <input
                  type="email"
                  value={form.validator_email}
                  onChange={e => update('validator_email', e.target.value)}
                  placeholder="Enter practitioner email to request verification…"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                />
              </div>
            )}

            {/* Photo upload */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo evidence (optional)</p>
              <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {photoFile ? photoFile.name : 'Upload vaccination record photo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 pb-10">
            <Button
              size="lg"
              fullWidth
              loading={saving}
              onClick={save}
              disabled={isRestricted && !form.validator_email.trim()}
            >
              {isRestricted ? 'Save & Request Validation' : 'Save Vaccine Record'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
