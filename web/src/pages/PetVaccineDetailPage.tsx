import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getPetVaccines, updatePetVaccine, deletePetVaccine } from '../services/petsService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import { getPractitionersForVaccineType } from '../services/practitionersService'
import { formatDate } from '../utils/dateUtils'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'
import type { PetVaccine } from '../types/pet'
import type { Clinic, Practitioner } from '../types/admin'

export function PetVaccineDetailPage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { petId, vaccineId } = useParams<{ petId: string; vaccineId: string }>()

  const [vaccine, setVaccine] = useState<PetVaccine | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    date_administration: '',
    Clinic: '',
    Doctor: '',
    Expiration_date: '',
    Notes: '',
  })
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])

  useEffect(() => {
    getClinicsForVaccineType('veterinary').then(setClinics)
    getPractitionersForVaccineType('veterinary').then(setPractitioners)
  }, [])

  useEffect(() => {
    if (!user || !petId) return
    getPetVaccines(user.uid, petId).then(vaxes => {
      const v = vaxes.find(x => x.pet_vaccine_id === vaccineId) ?? null
      setVaccine(v)
      if (v) {
        setForm({
          date_administration: v.date_administration ? new Date(v.date_administration).toISOString().split('T')[0] : '',
          Clinic: v.Clinic ?? '',
          Doctor: v.Doctor ?? '',
          Expiration_date: v.Expiration_date ? new Date(v.Expiration_date).toISOString().split('T')[0] : '',
          Notes: v.Notes ?? '',
        })
      }
    }).finally(() => setLoading(false))
  }, [user, petId, vaccineId])

  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  async function saveEdit() {
    if (!user || !petId || !vaccineId) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        date_administration: new Date(form.date_administration).toISOString(),
      }
      if (form.Clinic) payload.Clinic = form.Clinic
      if (form.Doctor) payload.Doctor = form.Doctor
      if (form.Expiration_date) payload.Expiration_date = new Date(form.Expiration_date).toISOString()
      else payload.Expiration_date = null
      if (form.Notes) payload.Notes = form.Notes
      await updatePetVaccine(user.uid, petId, vaccineId, payload as Parameters<typeof updatePetVaccine>[3])
      setVaccine(prev => prev ? { ...prev, ...payload } as PetVaccine : prev)
      setEditing(false)
    } catch (e) {
      console.error(e)
      alert('Error saving.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!user || !petId || !vaccineId || !vaccine) return
    if (!window.confirm(`Remove ${vaccine.vaccine_name}?`)) return
    setDeleting(true)
    try {
      await deletePetVaccine(user.uid, petId, vaccineId)
      navigate(-1)
    } catch (e) {
      console.error(e)
      alert('Error deleting.')
      setDeleting(false)
    }
  }

  const rows = vaccine ? [
    { label: 'Vaccine', value: vaccine.vaccine_name },
    { label: 'Disease target', value: vaccine.disease_target },
    { label: 'Date administered', value: formatDate(vaccine.date_administration) },
    vaccine.Clinic ? { label: 'Clinic / Vet', value: vaccine.Clinic } : null,
    vaccine.Doctor ? { label: 'Vet Name', value: vaccine.Doctor } : null,
    vaccine.Expiration_date ? { label: 'Expiry', value: formatDate(vaccine.Expiration_date) } : null,
    vaccine.Notes ? { label: 'Notes', value: vaccine.Notes } : null,
  ].filter(Boolean) as { label: string; value: string }[] : []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div
        className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
        }}
      >
        <div className="flex items-center h-14 gap-3">
          <button onClick={() => editing ? setEditing(false) : navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-base truncate">
            {vaccine?.vaccine_name ?? 'Vaccine'}
          </h1>
          {!editing && vaccine && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-blue-500 px-2 py-1"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : !vaccine ? (
          <p className="text-center text-gray-400 mt-12">Vaccine not found.</p>
        ) : editing ? (
          <div className="flex flex-col gap-4">
            <Input label="Date administered *" type="date" value={form.date_administration} onChange={e => update('date_administration', e.target.value)} />
            <ClinicCombobox
              value={form.Clinic}
              onChange={v => update('Clinic', v)}
              clinics={clinics}
              label="Veterinary Clinic"
              placeholder="Search registered vet clinics or type a name…"
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
            <Input label="Expiry date (optional)" type="date" value={form.Expiration_date} onChange={e => update('Expiration_date', e.target.value)} />
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes (optional)</label>
              <textarea value={form.Notes} onChange={e => update('Notes', e.target.value)} rows={3}
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <Button size="lg" fullWidth loading={saving} onClick={saveEdit}>Save Changes</Button>
            <button onClick={() => setEditing(false)} className="text-sm text-gray-400 text-center py-2">Cancel</button>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
              {rows.map((row, i) => (
                <div key={i} className={`px-4 py-3 ${i < rows.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{row.label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{row.value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-3 rounded-xl text-red-500 text-sm font-semibold bg-red-50 dark:bg-red-900/20 active:opacity-70 transition-opacity"
            >
              {deleting ? 'Deleting…' : 'Delete Record'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
