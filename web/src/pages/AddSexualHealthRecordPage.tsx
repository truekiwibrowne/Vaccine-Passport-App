import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { addSHRecord, isSessionUnlocked } from '../services/sexualHealthService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import { getPractitionersForVaccineType } from '../services/practitionersService'
import { SH_CONDITION_LABELS, SH_RESULT_LABELS, SH_RESULT_COLOURS, SH_CURABILITY } from '../types/sexualHealth'
import type { SHCondition, SHResult } from '../types/sexualHealth'
import type { Clinic } from '../types/admin'
import type { Practitioner } from '../types/admin'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'

const CONDITIONS: { key: SHCondition; emoji: string }[] = [
  { key: 'hiv',            emoji: '🩸' },
  { key: 'chlamydia',      emoji: '🧫' },
  { key: 'gonorrhoea',     emoji: '🧫' },
  { key: 'syphilis',       emoji: '🧫' },
  { key: 'herpes_hsv1',    emoji: '🦠' },
  { key: 'herpes_hsv2',    emoji: '🦠' },
  { key: 'hepatitis_b',    emoji: '🩺' },
  { key: 'hepatitis_c',    emoji: '🩺' },
  { key: 'hpv',            emoji: '🔬' },
  { key: 'mycoplasma',     emoji: '🧫' },
  { key: 'trichomoniasis', emoji: '🔬' },
  { key: 'other',          emoji: '📋' },
]

const RESULTS: SHResult[] = ['negative', 'positive', 'undetectable', 'on_treatment', 'immune', 'pending']

export function AddSexualHealthRecordPage() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  // ── Auth guard — redirect to PIN gate if session expired ─────────────────────
  useEffect(() => {
    if (user && !isSessionUnlocked(user.uid)) {
      navigate('/health/sexual', { replace: true })
    }
  }, [user, navigate])

  const [step, setStep] = useState<'condition' | 'details'>('condition')
  const [selectedCondition, setSelectedCondition] = useState<SHCondition | null>(null)
  const [customCondition, setCustomCondition] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Clinic / practitioner lists ───────────────────────────────────────────────
  const [clinics, setClinics]           = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])

  useEffect(() => {
    getClinicsForVaccineType('human').then(setClinics).catch(console.error)
    getPractitionersForVaccineType('human').then(setPractitioners).catch(console.error)
  }, [])

  const [form, setForm] = useState({
    result:         'negative' as SHResult,
    testDate:       new Date().toISOString().split('T')[0],
    clinic:         '',
    clinicId:       '',
    practitioner:   '',
    practitionerId: '',
    medication:     '',
    viralLoad:      '',
    notes:          '',
    includeInShare: true,
  })

  function update(f: string, v: string | boolean) {
    setForm(prev => ({ ...prev, [f]: v }))
  }

  async function save() {
    if (!user || !selectedCondition) return
    setSaving(true)
    try {
      const conditionKey = selectedCondition === 'other' && customCondition.trim()
        ? customCondition.trim()
        : selectedCondition

      await addSHRecord(user.uid, {
        condition:      conditionKey,
        result:         form.result,
        testDate:       new Date(form.testDate).toISOString(),
        ...(form.clinic         ? { clinic: form.clinic }               : {}),
        ...(form.clinicId       ? { clinicId: form.clinicId }           : {}),
        ...(form.practitioner   ? { practitioner: form.practitioner }   : {}),
        ...(form.practitionerId ? { practitionerId: form.practitionerId } : {}),
        ...(form.medication     ? { medication: form.medication }        : {}),
        ...(form.viralLoad      ? { viralLoad: form.viralLoad }          : {}),
        ...(form.notes          ? { notes: form.notes }                  : {}),
        includeInShare: form.includeInShare,
      })
      navigate('/health/sexual')
    } catch (e) {
      console.error(e)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const stickyHeader = (
    <div
      className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
      }}
    >
      <div className="flex items-center h-14 gap-3">
        <button
          onClick={() => step === 'details' ? setStep('condition') : navigate('/health/sexual')}
          className="p-2 -ml-2"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg">
          {step === 'condition' ? 'Select Condition' : 'Add Details'}
        </h1>
      </div>
    </div>
  )

  // ── Step 1: Condition picker ──────────────────────────────────────────────────
  if (step === 'condition') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {stickyHeader}
        <div className="px-4 py-4 pb-32 max-w-lg mx-auto">
          <div className="grid grid-cols-2 gap-3">
            {CONDITIONS.map(({ key, emoji }) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedCondition(key)
                  if (key !== 'other') setStep('details')
                }}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm text-left active:opacity-80 transition-opacity flex items-center gap-3 ${
                  selectedCondition === key ? 'ring-2 ring-violet-500' : ''
                }`}
              >
                <span className="text-2xl leading-none">{emoji}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                  {SH_CONDITION_LABELS[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Custom condition input */}
          {selectedCondition === 'other' && (
            <div className="mt-4 flex flex-col gap-3">
              <Input
                label="Condition name"
                value={customCondition}
                onChange={e => setCustomCondition(e.target.value)}
                placeholder="e.g. Bacterial vaginosis"
              />
              <Button
                fullWidth
                disabled={!customCondition.trim()}
                onClick={() => setStep('details')}
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Step 2: Details ──────────────────────────────────────────────────────────
  const condLabel = selectedCondition
    ? (selectedCondition === 'other' ? customCondition : SH_CONDITION_LABELS[selectedCondition])
    : ''

  const showMedicationField = ['positive', 'undetectable', 'on_treatment'].includes(form.result)
  const showViralLoadField  = ['undetectable'].includes(form.result) && selectedCondition === 'hiv'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {stickyHeader}
      <div className="px-4 py-4 pb-32 max-w-lg mx-auto flex flex-col gap-4">

        {/* Selected condition chip */}
        <div className="rounded-2xl p-3 bg-violet-50 dark:bg-violet-900/30 flex items-center justify-between">
          <p className="font-semibold text-violet-900 dark:text-violet-100">{condLabel}</p>
          <button onClick={() => setStep('condition')} className="text-xs text-violet-500 font-medium">Change</button>
        </div>

        {/* Lifelong condition warning */}
        {selectedCondition && SH_CURABILITY[selectedCondition] === 'lifelong' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl px-3 py-2.5 text-xs">
            💊 This condition is lifelong and manageable. A positive result cannot be negated by a later negative test. Use 'On Treatment' or 'Undetectable' to reflect treatment status.
          </div>
        )}

        {/* Result selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Result *</label>
          <div className="flex flex-col gap-2">
            {RESULTS.map(r => {
              const { bg, text } = SH_RESULT_COLOURS[r]
              const label = SH_RESULT_LABELS[r]
              // Only show undetectable for HIV
              if (r === 'undetectable' && selectedCondition !== 'hiv') return null
              return (
                <button
                  key={r}
                  onClick={() => update('result', r)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                    form.result === r
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>{label}</span>
                  {r === 'undetectable' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">U=U · cannot sexually transmit</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <Input
          label="Test date *"
          type="date"
          value={form.testDate}
          onChange={e => update('testDate', e.target.value)}
        />

        {/* Clinic combobox */}
        <ClinicCombobox
          value={form.clinic}
          onChange={name => update('clinic', name)}
          clinics={clinics}
          label="Clinic / Testing site (optional)"
          placeholder="Search registered clinics or type any name…"
          userCountry={profile?.currentCountry}
        />

        {/* Practitioner combobox */}
        <PractitionerCombobox
          value={form.practitioner}
          onChange={name => update('practitioner', name)}
          onSelect={(name, clinicName) => {
            update('practitioner', name)
            // Pre-fill clinic if not already set
            if (!form.clinic && clinicName) update('clinic', clinicName)
          }}
          practitioners={practitioners}
          label="Doctor / Nurse (optional)"
          placeholder="Search registered practitioners or type a name…"
          preferClinic={form.clinic}
        />

        {showMedicationField && (
          <Input
            label={selectedCondition === 'hiv' ? 'ART regimen (optional)' : 'Medication / Treatment (optional)'}
            value={form.medication}
            onChange={e => update('medication', e.target.value)}
            placeholder={selectedCondition === 'hiv' ? 'e.g. Biktarvy, Triumeq…' : 'e.g. Doxycycline 100mg…'}
          />
        )}

        {showViralLoadField && (
          <Input
            label="Viral load (optional)"
            value={form.viralLoad}
            onChange={e => update('viralLoad', e.target.value)}
            placeholder="e.g. Undetectable, <20 copies/mL"
          />
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            rows={3}
            placeholder="Any additional context or notes…"
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none dark:placeholder-gray-500"
          />
        </div>

        {/* Include in QR share */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Include in QR share</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              This record will appear when a partner scans your QR code
            </p>
          </div>
          <button
            onClick={() => update('includeInShare', !form.includeInShare)}
            className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors mt-0.5 ${
              form.includeInShare ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              form.includeInShare ? 'left-6' : 'left-1'
            }`} />
          </button>
        </div>

        <Button size="lg" fullWidth loading={saving} onClick={save}>
          Save Record
        </Button>
      </div>
    </div>
  )
}
