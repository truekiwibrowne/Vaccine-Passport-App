import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { deleteUserVaccine, updateUserVaccine } from '../services/vaccineService'
import { createValidationRequest } from '../services/validationService'
import { uploadFile } from '../services/storageService'
import { getPractitionerByEmail, getPractitionersForVaccineType } from '../services/practitionersService'
import { getClinicsForVaccineType } from '../services/clinicsService'
import type { Practitioner, Clinic } from '../types/admin'
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_LEVEL_COLOURS } from '../types/admin'
import { VaccineStatusPill } from '../components/vaccine/VaccineStatusPill'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ClinicCombobox } from '../components/ui/ClinicCombobox'
import { PractitionerCombobox } from '../components/ui/PractitionerCombobox'
import { formatDate, isExpired, isoNow } from '../utils/dateUtils'

export function VaccineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const { vaccines } = useUserVaccines(user?.uid)
  const vaccine = vaccines.find(v => v.user_vaccine_id === id)

  const [validationModal, setValidationModal] = useState(false)
  const [validatorEmail, setValidatorEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Verification chain
  const [chainOpen, setChainOpen] = useState(false)
  const [chain, setChain] = useState<Practitioner[]>([])
  const [chainLoading, setChainLoading] = useState(false)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    date_administration: '',
    Clinic: '',
    Doctor: '',
    Expiration_date: '',
  })
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)

  // Clinic / practitioner combobox data (human vaccines)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  useEffect(() => {
    getClinicsForVaccineType('human').then(setClinics)
    getPractitionersForVaccineType('human').then(setPractitioners)
  }, [])

  function startEdit() {
    if (!vaccine) return
    setEditForm({
      date_administration: vaccine.date_administration
        ? new Date(vaccine.date_administration).toISOString().split('T')[0]
        : '',
      Clinic: vaccine.Clinic ?? '',
      Doctor: vaccine.Doctor ?? '',
      Expiration_date: vaccine.Expiration_date
        ? new Date(vaccine.Expiration_date).toISOString().split('T')[0]
        : '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!user || !vaccine) return
    setSaving(true)
    try {
      let photoUrl = vaccine.Photo_Evidence
      if (newPhotoFile) {
        try { photoUrl = await uploadFile(user.uid, newPhotoFile, 'evidence') }
        catch (e) { console.warn('Photo upload skipped:', e) }
      }
      await updateUserVaccine(user.uid, vaccine.user_vaccine_id, {
        date_administration: new Date(editForm.date_administration).toISOString(),
        Clinic: editForm.Clinic,
        Doctor: editForm.Doctor,
        Expiration_date: editForm.Expiration_date
          ? new Date(editForm.Expiration_date).toISOString()
          : null,
        Photo_Evidence: photoUrl,
        Updated: isoNow(),
      })
      setEditing(false)
    } catch (e) {
      console.error(e)
      alert('Error saving changes.')
    } finally {
      setSaving(false)
    }
  }

  async function requestValidation() {
    if (!user || !vaccine || !validatorEmail) return
    setSubmitting(true)
    try {
      await createValidationRequest({
        user_vaccine_id: vaccine.user_vaccine_id,
        user_id: user.uid,
        vaccine_name: vaccine.vaccine_name,
        requested_at: new Date().toISOString(),
        requestor_email: profile?.Email ?? user.email ?? '',
        validator_email: validatorEmail,
      })
      setValidationModal(false)
      setValidatorEmail('')
      alert('Validation request sent! The validator will see it when they log in.')
    } catch (e) {
      console.error(e)
      alert('Error sending request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!user || !vaccine) return
    if (!confirm('Delete this vaccine record?')) return
    setDeleting(true)
    try {
      await deleteUserVaccine(user.uid, vaccine.user_vaccine_id)
      navigate('/')
    } catch {
      alert('Error deleting.')
      setDeleting(false)
    }
  }

  async function loadChain() {
    if (!vaccine?.Authenticator) return
    setChainLoading(true)
    const result: Practitioner[] = []
    let email: string | null = vaccine.Authenticator
    const seen = new Set<string>()
    while (email && !seen.has(email) && result.length < 5) {
      seen.add(email)
      const p = await getPractitionerByEmail(email)
      if (!p) break
      result.push(p)
      email = p.verifiedBy || null
    }
    setChain(result)
    setChainLoading(false)
  }

  useEffect(() => {
    if (chainOpen) loadChain()
  }, [chainOpen])

  if (!vaccine) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 dark:text-gray-500">
      <p>Vaccine not found.</p>
    </div>
  )

  const expired = isExpired(vaccine.Expiration_date)
  // Can edit only if not verified AND not expired
  const canEdit = vaccine.Authenticated !== true && !expired

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header — sticky so it never scrolls away */}
      <div
        className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
        }}
      >
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto">
          <button onClick={() => editing ? setEditing(false) : navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Record' : 'Vaccine Record'}</h1>
          {!editing ? (
            <div className="flex items-center gap-1">
              {canEdit && (
                <button onClick={startEdit} className="p-2 text-blue-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button onClick={handleDelete} disabled={deleting} className="p-2 text-red-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ) : (
            <Button size="sm" loading={saving} onClick={saveEdit}>Save</Button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3 pb-32">

        {/* ── VIEW MODE ── */}
        {!editing && (
          <>
            {/* Hero card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{vaccine.vaccine_name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{vaccine.Vaccine_Reference}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <VaccineStatusPill
                  authenticated={vaccine.Authenticated}
                  pending={vaccine.pending_validation}
                  level={vaccine.authentication_level}
                />
                {expired && <span className="text-xs text-red-500 font-semibold">Expired</span>}
                {vaccine.Authenticated === true && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Cannot be edited after verification</span>
                )}
              </div>
            </div>

            {/* Details rows */}
            {([
              { label: 'Date Administered', value: formatDate(vaccine.date_administration) },
              { label: 'Expiry Date', value: formatDate(vaccine.Expiration_date) },
              { label: 'Clinic', value: vaccine.Clinic },
              { label: 'Doctor / Nurse', value: vaccine.Doctor },
              vaccine.Authenticated === true && { label: 'Verified By', value: vaccine.Authenticator },
              vaccine.Authenticated === true && { label: 'Verification Date', value: formatDate(vaccine.Authentication_Date) },
              vaccine.authentication_level > 0 && { label: 'Authentication Level', value: `Level ${vaccine.authentication_level}` },
            ] as any[]).filter(Boolean).map((item: { label: string; value: string }) => (
              <div key={item.label} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%]">{item.value || '—'}</span>
              </div>
            ))}

            {/* Verification Chain */}
            {vaccine.Authenticated === true && (
              <div className="mt-4">
                <button
                  onClick={() => setChainOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Verification Chain</span>
                    <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                      Level {vaccine.authentication_level}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${chainOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {chainOpen && (
                  <div className="mt-2 space-y-3">
                    {chainLoading && (
                      <p className="text-xs text-gray-400 text-center py-4">Loading chain…</p>
                    )}
                    {!chainLoading && chain.length === 0 && (
                      <p className="text-xs text-gray-400 px-4 py-2">
                        Verified by {vaccine.Authenticator} — not yet registered as a practitioner.
                      </p>
                    )}
                    {chain.map((p, i) => (
                      <div key={p.id} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 bg-white dark:bg-gray-800">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.email}</p>
                              {p.clinicName && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.clinicName}</p>}
                              {p.speciality && <p className="text-xs text-gray-400 dark:text-gray-500">{p.speciality}</p>}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${VERIFICATION_LEVEL_COLOURS[p.verificationLevel]}`}>
                              L{p.verificationLevel} · {VERIFICATION_LEVEL_LABELS[p.verificationLevel]}
                            </span>
                          </div>
                          {i === 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              Verified your vaccine on {formatDate(vaccine.Authentication_Date)}
                            </p>
                          )}
                          {i > 0 && p.verifiedAt && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              Verified by {chain[i - 1]?.name ?? '—'} on {formatDate(p.verifiedAt)}
                            </p>
                          )}
                        </div>
                        {p.verifiedBy && i < chain.length - 1 && (
                          <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-700/40 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Verified by ↑</p>
                          </div>
                        )}
                        {p.verifiedBy && i === chain.length - 1 && !chainLoading && (
                          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/40">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Chain root: verified by <span className="font-medium">{p.verifiedBy}</span></p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Photo evidence */}
            {vaccine.Photo_Evidence && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Photo Evidence</p>
                <img src={vaccine.Photo_Evidence} alt="Vaccine record" className="w-full rounded-xl object-cover max-h-60" />
              </div>
            )}

            {/* About this vaccine → library */}
            {vaccine.vaccine_id && (
              <button
                onClick={() => navigate(`/library/${vaccine.vaccine_id}`)}
                className="w-full bg-blue-50 dark:bg-blue-900/30 rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Read about this vaccine</span>
                </div>
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Validation */}
            {!vaccine.Authenticated && !vaccine.pending_validation && (
              <Button size="lg" fullWidth onClick={() => setValidationModal(true)}>
                Request Medical Validation
              </Button>
            )}
            {vaccine.pending_validation && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 text-center border border-yellow-100 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-700">
                  ⏳ Awaiting review by {vaccine.validator_email}
                </p>
                <p className="text-xs text-yellow-500 mt-1">
                  Ask them to sign in to the app and check their Validation Inbox
                </p>
              </div>
            )}
          </>
        )}

        {/* ── EDIT MODE ── */}
        {editing && (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-2xl p-3">
              <p className="font-semibold text-blue-900 dark:text-blue-100">{vaccine.vaccine_name}</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Vaccine cannot be changed — only administration details</p>
            </div>
            <div className="flex flex-col gap-4">
              <Input
                label="Date administered"
                type="date"
                value={editForm.date_administration}
                onChange={e => setEditForm(f => ({ ...f, date_administration: e.target.value }))}
              />
              <ClinicCombobox
                value={editForm.Clinic}
                onChange={v => setEditForm(f => ({ ...f, Clinic: v }))}
                clinics={clinics}
              />
              <PractitionerCombobox
                value={editForm.Doctor}
                onChange={v => setEditForm(f => ({ ...f, Doctor: v }))}
                onSelect={(name, clinicName) => {
                  setEditForm(f => ({
                    ...f,
                    Doctor: name,
                    Clinic: f.Clinic || clinicName,
                  }))
                }}
                practitioners={practitioners}
                label="Doctor / Nurse"
                preferClinic={editForm.Clinic}
              />
              <Input
                label="Expiry date"
                type="date"
                value={editForm.Expiration_date}
                onChange={e => setEditForm(f => ({ ...f, Expiration_date: e.target.value }))}
              />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Replace photo evidence</p>
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{newPhotoFile ? newPhotoFile.name : 'Upload new photo'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setNewPhotoFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" fullWidth onClick={() => setEditing(false)}>Cancel</Button>
              <Button fullWidth loading={saving} onClick={saveEdit}>Save Changes</Button>
            </div>
          </>
        )}
      </div>

      {/* Validation request modal */}
      <Modal open={validationModal} onClose={() => setValidationModal(false)} title="Request Medical Validation">
        <p className="text-sm text-gray-500 mb-1">
          Enter the email address of the medical professional who administered or can verify this vaccine.
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 mb-4">
          They'll need to sign in to this app with that email address to see and approve your request in their Validation Inbox.
        </p>
        <Input
          label="Validator's email address"
          type="email"
          value={validatorEmail}
          onChange={e => setValidatorEmail(e.target.value)}
          placeholder="doctor@clinic.com"
        />
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setValidationModal(false)}>Cancel</Button>
          <Button fullWidth loading={submitting} onClick={requestValidation} disabled={!validatorEmail}>
            Send Request
          </Button>
        </div>
      </Modal>
    </div>
  )
}
