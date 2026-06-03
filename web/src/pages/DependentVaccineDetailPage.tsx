import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getDependentVaccines, updateDependentVaccine, deleteDependentVaccine } from '../services/dependentsService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import { getPractitionersForVaccineType } from '../services/practitionersService'
import { formatDate } from '../utils/dateUtils'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'
import type { UserVaccine } from '../types/vaccine'
import type { Clinic, Practitioner } from '../types/admin'

function statusInfo(v: UserVaccine) {
  if (v.pending_validation) return { text: 'Pending', colour: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' }
  if (v.Authenticated) return { text: 'Verified', colour: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' }
  return { text: 'Recorded', colour: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' }
}

export function DependentVaccineDetailPage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { depId, vaccineId } = useParams<{ depId: string; vaccineId: string }>()

  const [vaccine, setVaccine] = useState<UserVaccine | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({ date_administration: '', Clinic: '', Doctor: '', Expiration_date: '' })
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])

  useEffect(() => {
    getClinicsForVaccineType('human').then(setClinics)
    getPractitionersForVaccineType('human').then(setPractitioners)
  }, [])

  useEffect(() => {
    if (!user || !depId) return
    getDependentVaccines(user.uid, depId).then(vaxes => {
      const v = vaxes.find(x => x.user_vaccine_id === vaccineId) ?? null
      setVaccine(v)
      if (v) setForm({
        date_administration: v.date_administration ? new Date(v.date_administration).toISOString().split('T')[0] : '',
        Clinic: v.Clinic ?? '',
        Doctor: v.Doctor ?? '',
        Expiration_date: v.Expiration_date ? new Date(v.Expiration_date).toISOString().split('T')[0] : '',
      })
    }).finally(() => setLoading(false))
  }, [user, depId, vaccineId])

  function update(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  const canEdit = vaccine ? vaccine.Authenticated !== true : false

  async function saveEdit() {
    if (!user || !depId || !vaccineId) return
    setSaving(true)
    try {
      const payload: Partial<UserVaccine> = {
        date_administration: new Date(form.date_administration).toISOString(),
        Clinic: form.Clinic,
        Doctor: form.Doctor,
        Expiration_date: form.Expiration_date ? new Date(form.Expiration_date).toISOString() : null,
      }
      await updateDependentVaccine(user.uid, depId, vaccineId, payload)
      setVaccine(prev => prev ? { ...prev, ...payload } : prev)
      setEditing(false)
    } catch (e) {
      console.error(e)
      alert('Error saving.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!user || !depId || !vaccineId || !vaccine) return
    if (!window.confirm(`Remove ${vaccine.vaccine_name}?`)) return
    setDeleting(true)
    try {
      await deleteDependentVaccine(user.uid, depId, vaccineId)
      navigate(-1)
    } catch (e) {
      console.error(e)
      alert('Error deleting.')
      setDeleting(false)
    }
  }

  const status = vaccine ? statusInfo(vaccine) : null

  const rows = vaccine ? [
    { label: 'Vaccine', value: vaccine.vaccine_name },
    { label: 'Date administered', value: formatDate(vaccine.date_administration) },
    vaccine.Clinic ? { label: 'Clinic', value: vaccine.Clinic } : null,
    vaccine.Doctor ? { label: 'Doctor', value: vaccine.Doctor } : null,
    vaccine.Expiration_date ? { label: 'Expiry', value: formatDate(vaccine.Expiration_date) } : null,
    vaccine.Authenticated ? { label: 'Verified By', value: vaccine.Authenticator ?? '—' } : null,
    vaccine.Authentication_Date ? { label: 'Verified On', value: formatDate(vaccine.Authentication_Date) } : null,
    vaccine.authentication_level > 0 ? { label: 'Auth Level', value: `Level ${vaccine.authentication_level}` } : null,
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
        <div className="flex items-center h-14 gap-2">
          <button onClick={() => editing ? setEditing(false) : navigate(-1)} className="p-2 -ml-2 flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-base truncate">
            {vaccine?.vaccine_name ?? 'Vaccine'}
          </h1>
          {status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.colour}`}>{status.text}</span>}
          {!editing && canEdit && (
            <button onClick={() => setEditing(true)} className="text-sm font-semibold text-blue-500 px-2 py-1 flex-shrink-0">Edit</button>
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
            />
            <Input label="Expiry date (optional)" type="date" value={form.Expiration_date} onChange={e => update('Expiration_date', e.target.value)} />
            <Button size="lg" fullWidth loading={saving} onClick={saveEdit}>Save Changes</Button>
            <button onClick={() => setEditing(false)} className="text-sm text-gray-400 text-center py-2">Cancel</button>
          </div>
        ) : (
          <>
            {vaccine.Authenticated && (
              <div className="mb-4 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">✓ Verified — this record is locked and cannot be edited.</p>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
              {rows.map((row, i) => (
                <div key={i} className={`px-4 py-3 ${i < rows.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{row.label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{row.value}</p>
                </div>
              ))}
            </div>
            {canEdit && (
              <button onClick={handleDelete} disabled={deleting}
                className="w-full py-3 rounded-xl text-red-500 text-sm font-semibold bg-red-50 dark:bg-red-900/20 active:opacity-70 transition-opacity">
                {deleting ? 'Deleting…' : 'Delete Record'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
