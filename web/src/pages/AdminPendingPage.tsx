/**
 * AdminPendingPage — review and action user-submitted requests.
 *
 * Shows three sub-tabs (Clinics / Practitioners / Vaccines).
 * Selecting an item opens the detail panel with Approve / Reject controls.
 *
 * Approve clinic     → writes to Clinics collection + marks as approved
 * Approve practitioner → writes to Practitioners collection + marks as approved
 * Approve vaccine    → writes a basic Vaccine_Library entry + marks as approved
 * Reject any         → prompts for reason + marks as rejected
 */

import { useState, useEffect } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import {
  getPendingClinics, getPendingPractitioners, getPendingVaccines,
  approvePendingClinic, rejectPendingClinic,
  approvePendingPractitioner, rejectPendingPractitioner,
  approvePendingVaccine, rejectPendingVaccine,
} from '../services/pendingSubmissionsService'
import { addClinic } from '../services/clinicsService'
import { addPractitioner } from '../services/practitionersService'
import { addVaccineLibraryEntry } from '../services/vaccineLibraryService'
import { addUserNotification, queueUserPush } from '../services/userNotificationsService'
import { updateUserVaccine } from '../services/vaccineService'
import { updateDependentVaccine } from '../services/dependentsService'
import { updatePetVaccine } from '../services/petsService'
import { updateFarmVaccine } from '../services/farmService'
import type { PendingClinic, PendingPractitioner, PendingVaccine, VaccineContext } from '../types/pendingSubmissions'
import { VACCINE_CATEGORY_LABELS } from '../types/vaccineLibrary'
import { ResizableSplitPane } from '../components/layout/ResizableSplitPane'
import { formatDate, isoNow } from '../utils/dateUtils'

type SubTab = 'clinics' | 'practitioners' | 'vaccines'

const STATUS_CHIP: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

// ── Desktop detail panel ─────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white mt-0.5 break-all">{value}</p>
    </div>
  )
}

function EditField({
  label, value, onChange, type = 'text', multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; multiline?: boolean
}) {
  const cls = 'w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${cls} resize-none`} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} />
      }
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function AdminPendingPage() {
  const { profile } = useAuth()

  const [subTab, setSubTab] = useState<SubTab>('clinics')
  const [clinics,       setClinics]       = useState<PendingClinic[]>([])
  const [practitioners, setPractitioners] = useState<PendingPractitioner[]>([])
  const [vaccines,      setVaccines]      = useState<PendingVaccine[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedClinic,       setSelectedClinic]       = useState<PendingClinic | null>(null)
  const [selectedPractitioner, setSelectedPractitioner] = useState<PendingPractitioner | null>(null)
  const [selectedVaccine,      setSelectedVaccine]      = useState<PendingVaccine | null>(null)

  const [actioning,      setActioning]      = useState(false)
  const [rejectReason,   setRejectReason]   = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  // ── Inline edit state ──
  const [editMode,   setEditMode]   = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string>>({})

  function startEditing() {
    const base: Record<string, string> = {}
    if (selectedClinic) {
      Object.assign(base, {
        name: selectedClinic.name,
        phone: selectedClinic.phone,
        address: selectedClinic.address,
        city: selectedClinic.city,
        country: selectedClinic.country,
        website: selectedClinic.website ?? '',
        notes: selectedClinic.notes ?? '',
      })
    } else if (selectedPractitioner) {
      Object.assign(base, {
        name: selectedPractitioner.name,
        clinicName: selectedPractitioner.clinicName,
        phone: selectedPractitioner.phone ?? '',
        email: selectedPractitioner.email ?? '',
        speciality: selectedPractitioner.speciality ?? '',
        notes: selectedPractitioner.notes ?? '',
      })
    } else if (selectedVaccine) {
      Object.assign(base, {
        name: selectedVaccine.name,
        category: selectedVaccine.category,
        diseaseTarget: selectedVaccine.diseaseTarget ?? '',
        manufacturer: selectedVaccine.manufacturer ?? '',
        referenceUrl: selectedVaccine.referenceUrl,
        notes: selectedVaccine.notes ?? '',
      })
    }
    setEditFields(base)
    setEditMode(true)
  }

  // ── Update an EXISTING vaccine record's Clinic or Doctor field ─────────────
  // Called when the pending request already has a userVaccineRecordId stored.

  async function updateExistingVaccineRecord(
    ctx: VaccineContext,
    updates: { Clinic?: string; Doctor?: string },
    submittedByUid: string,
  ): Promise<boolean> {
    const id = ctx.userVaccineRecordId!
    try {
      switch (ctx.targetType) {
        case 'user':
          await updateUserVaccine(ctx.targetId, id, updates)
          break
        case 'dependent':
          await updateDependentVaccine(submittedByUid, ctx.targetId, id, updates)
          break
        case 'pet':
          await updatePetVaccine(submittedByUid, ctx.targetId, id, updates)
          break
        case 'farm':
          await updateFarmVaccine(submittedByUid, ctx.targetId, id, updates)
          break
        default:
          return false
      }
      return true
    } catch (err) {
      console.error('updateExistingVaccineRecord failed:', err)
      return false
    }
  }

  // ── Auto-create vaccine record from vaccineContext ──
  // Fallback for old pending requests that pre-date userVaccineRecordId.

  async function autoCreateVaccine(
    ctx: VaccineContext,
    clinicName: string,
    submittedByUid: string,
  ): Promise<string | null> {
    const now   = isoNow()
    const isoDate = new Date(ctx.date).toISOString()
    try {
      switch (ctx.targetType) {
        case 'user': {
          const ref = await addDoc(
            collection(db, 'User_Data', ctx.targetId, 'Vaccines'),
            {
              user_id: ctx.targetId, vaccine_id: ctx.vaccineId,
              vaccine_name: ctx.vaccineName, date_administration: isoDate,
              Clinic: clinicName, Doctor: ctx.doctor ?? '',
              Photo_Evidence: '', Supporting_files: [],
              Expiration_date: null, Authenticated: false,
              Authentication_Date: null, authentication_level: 1,
              Vaccine_Reference: '', Authenticator: null,
              Favourited: false, pending_validation: false,
              validator_email: '', Created: now, Updated: now,
            },
          )
          return ref.id
        }
        case 'dependent': {
          const ref = await addDoc(
            collection(db, 'Dependents', ctx.targetId, 'Vaccines'),
            {
              user_id: submittedByUid, vaccine_id: ctx.vaccineId,
              vaccine_name: ctx.vaccineName, date_administration: isoDate,
              Clinic: clinicName, Doctor: ctx.doctor ?? '',
              Photo_Evidence: '', Supporting_files: [],
              Expiration_date: null, Authenticated: false,
              Authentication_Date: null, authentication_level: 1,
              Vaccine_Reference: '', Authenticator: null,
              Favourited: false, pending_validation: false,
              validator_email: '', Created: now, Updated: now,
            },
          )
          return ref.id
        }
        case 'pet': {
          const ref = await addDoc(
            collection(db, 'Pets', ctx.targetId, 'Vaccines'),
            {
              vaccine_name: ctx.vaccineName, animal_vaccine_id: ctx.vaccineId,
              disease_target: '', date_administration: isoDate,
              Expiration_date: null, Clinic: clinicName,
              Doctor: ctx.doctor ?? '', Created: now, Updated: now,
            },
          )
          return ref.id
        }
        case 'farm': {
          const ref = await addDoc(
            collection(db, 'FarmAnimals', ctx.targetId, 'Vaccines'),
            {
              vaccine_name: ctx.vaccineName, animal_vaccine_id: ctx.vaccineId,
              disease_target: '', date_administration: isoDate,
              Expiration_date: null, Clinic: clinicName,
              Doctor: ctx.doctor ?? '', Created: now, Updated: now,
            },
          )
          return ref.id
        }
        default: return null
      }
    } catch (err) {
      console.error('autoCreateVaccine failed:', err)
      return null
    }
  }

  async function load() {
    setLoading(true)
    try {
      const [c, p, v] = await Promise.all([
        getPendingClinics(),
        getPendingPractitioners(),
        getPendingVaccines(),
      ])
      setClinics(c)
      setPractitioners(p)
      setVaccines(v)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function clearSelection() {
    setSelectedClinic(null)
    setSelectedPractitioner(null)
    setSelectedVaccine(null)
    setShowRejectForm(false)
    setRejectReason('')
    setEditMode(false)
    setEditFields({})
  }

  // ── Approve handlers ──

  async function approveClinic(item: PendingClinic) {
    if (!profile) return
    setActioning(true)
    // Merge any admin edits over the original submission
    const name    = editMode ? (editFields.name    || item.name)    : item.name
    const phone   = editMode ? (editFields.phone   || item.phone)   : item.phone
    const address = editMode ? (editFields.address || item.address) : item.address
    const city    = editMode ? (editFields.city    || item.city)    : item.city
    const country = editMode ? (editFields.country || item.country) : item.country
    const website = editMode ? editFields.website : (item.website ?? '')
    try {
      await addClinic({ name, phone, address, city, country, website, clinicType: 'human', verified: false })
      await approvePendingClinic(item.id, profile.Email ?? 'admin')

      // Link the clinic to the user's existing vaccine record (or create one as fallback)
      let autoCreated = false
      if (item.vaccineContext) {
        const ctx = item.vaccineContext
        if (ctx.userVaccineRecordId) {
          // New flow: vaccine was already saved — just fill in the Clinic field
          autoCreated = await updateExistingVaccineRecord(ctx, { Clinic: name }, item.submittedByUid)
        } else {
          // Fallback for older requests without a record ID
          const id = await autoCreateVaccine(ctx, name, item.submittedByUid)
          autoCreated = id !== null
        }
      }

      await addUserNotification(item.submittedByUid, {
        type:    'approval',
        subject: 'clinic',
        title:   'Clinic request approved',
        body:    autoCreated
          ? `"${name}" has been approved and your vaccine record has been automatically added. Check My Vaccines.`
          : `"${name}" has been added to the clinic directory. You can now select it when adding a vaccine.`,
      })
      clearSelection()
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve.')
    } finally {
      setActioning(false)
    }
  }

  async function approvePractitioner(item: PendingPractitioner) {
    if (!profile) return
    setActioning(true)
    const name       = editMode ? (editFields.name       || item.name)       : item.name
    const clinicName = editMode ? (editFields.clinicName || item.clinicName) : item.clinicName
    const email      = editMode ? editFields.email      : (item.email      ?? '')
    const speciality = editMode ? editFields.speciality : (item.speciality ?? '')
    try {
      await addPractitioner({
        name, email, clinicId: '', clinicName, speciality,
        practitionerType:  'human',
        verificationLevel: 1,
        verifiedBy:        profile.Email ?? 'admin',
        verifiedAt:        new Date().toISOString(),
        active:            true,
      })
      await approvePendingPractitioner(item.id, profile.Email ?? 'admin')

      let autoCreated = false
      if (item.vaccineContext) {
        const ctx = item.vaccineContext
        if (ctx.userVaccineRecordId) {
          // New flow: update the Doctor field on the already-saved vaccine record
          autoCreated = await updateExistingVaccineRecord(ctx, { Doctor: name }, item.submittedByUid)
        } else {
          // Fallback for older requests
          const id = await autoCreateVaccine(
            { ...ctx, doctor: name },
            '',
            item.submittedByUid,
          )
          autoCreated = id !== null
        }
      }

      await addUserNotification(item.submittedByUid, {
        type:    'approval',
        subject: 'practitioner',
        title:   'Practitioner request approved',
        body:    autoCreated
          ? `"${name}" has been approved and your vaccine record has been automatically added. Check My Vaccines.`
          : `"${name}" has been added to the practitioner directory. You can now select them when adding a vaccine.`,
      })
      clearSelection()
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve.')
    } finally {
      setActioning(false)
    }
  }

  async function approveVaccine(item: PendingVaccine) {
    if (!profile) return
    setActioning(true)
    const name          = editMode ? (editFields.name          || item.name)          : item.name
    const diseaseTarget = editMode ? editFields.diseaseTarget  : (item.diseaseTarget  ?? '')
    const manufacturer  = editMode ? editFields.manufacturer   : (item.manufacturer  ?? '')
    const referenceUrl  = editMode ? (editFields.referenceUrl  || item.referenceUrl)  : item.referenceUrl
    const notes         = editMode ? editFields.notes          : (item.notes          ?? '')
    const category      = (editMode ? editFields.category : item.category) as PendingVaccine['category']
    try {
      // 1. Add library entry and capture the new ID
      const libraryId = await addVaccineLibraryEntry({
        Vac_Name:               name,
        'Disease Target':       diseaseTarget,
        'Short Description':    `Requested by user — reference: ${referenceUrl}`,
        'Long Description':     '',
        'Brand Name':           '',
        Manufacturer:           manufacturer,
        'Type/Technology':      '',
        Administration:         '',
        'Dosing Schedule':      '',
        'Storage Requirements': '',
        'Efficacy Rate':        '',
        'Age Group':            '',
        'Target Population':    '',
        'Geographic Priority':  '',
        'Disease Prevalence':   '',
        'Special Notes':        notes,
        status:                 'available',
        category,
      })

      // 2. Auto-create a vaccine record in the submitting user's history
      const now = isoNow()
      const vaccineRef = await addDoc(
        collection(db, 'User_Data', item.submittedByUid, 'Vaccines'),
        {
          user_id:             item.submittedByUid,
          vaccine_id:          libraryId,
          vaccine_name:        name,
          date_administration: now,
          Clinic:              '',
          Doctor:              '',
          Photo_Evidence:      '',
          Supporting_files:    [],
          Expiration_date:     null,
          Authenticated:       false,
          Authentication_Date: null,
          authentication_level: 1,
          Vaccine_Reference:   referenceUrl,
          Authenticator:       null,
          Favourited:          false,
          pending_validation:  false,
          validator_email:     '',
          Created:             now,
          Updated:             now,
        },
      )

      // 3. Mark the pending request as approved
      await approvePendingVaccine(item.id, profile.Email ?? 'admin')

      // 4. Notify the user (in-app)
      await addUserNotification(item.submittedByUid, {
        type:             'approval',
        subject:          'vaccine',
        title:            'Vaccine request approved',
        body:             `"${name}" has been approved and added to your vaccine record. You can view and update it in My Vaccines.`,
        vaccineLibraryId: libraryId,
        userVaccineId:    vaccineRef.id,
      })

      clearSelection()
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve.')
    } finally {
      setActioning(false)
    }
  }

  // ── Reject handler (shared) ──

  async function handleReject() {
    if (!rejectReason.trim()) { alert('Please provide a rejection reason.'); return }
    if (!profile) return
    setActioning(true)
    const reason = rejectReason.trim()
    try {
      let submittedByUid = ''
      let subjectLabel   = ''
      let itemName       = ''

      if (selectedClinic) {
        await rejectPendingClinic(selectedClinic.id, profile.Email ?? 'admin', reason)
        submittedByUid = selectedClinic.submittedByUid
        subjectLabel   = 'clinic'
        itemName       = selectedClinic.name
      }
      if (selectedPractitioner) {
        await rejectPendingPractitioner(selectedPractitioner.id, profile.Email ?? 'admin', reason)
        submittedByUid = selectedPractitioner.submittedByUid
        subjectLabel   = 'practitioner'
        itemName       = selectedPractitioner.name
      }
      if (selectedVaccine) {
        await rejectPendingVaccine(selectedVaccine.id, profile.Email ?? 'admin', reason)
        submittedByUid = selectedVaccine.submittedByUid
        subjectLabel   = 'vaccine'
        itemName       = selectedVaccine.name
      }

      if (submittedByUid) {
        const title = `${subjectLabel.charAt(0).toUpperCase() + subjectLabel.slice(1)} request rejected`
        const body  = `Your request to add "${itemName}" was not approved. Reason: ${reason}`

        // In-app notification
        await addUserNotification(submittedByUid, {
          type:    'rejection',
          subject: subjectLabel as 'clinic' | 'practitioner' | 'vaccine',
          title,
          body,
        })

        // Queue a push notification (sent by GitHub Actions notifier)
        await queueUserPush(submittedByUid, title, body)
      }

      clearSelection()
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject.')
    } finally {
      setActioning(false)
    }
  }

  // ── List items ────────────────────────────────────────────────────────────

  const pendingClinics       = clinics.filter(c => c.status === 'pending')
  const pendingPractitioners = practitioners.filter(p => p.status === 'pending')
  const pendingVaccines      = vaccines.filter(v => v.status === 'pending')

  const subTabs: { key: SubTab; label: string; count: number }[] = [
    { key: 'clinics',       label: 'Clinics',       count: pendingClinics.length },
    { key: 'practitioners', label: 'Practitioners', count: pendingPractitioners.length },
    { key: 'vaccines',      label: 'Vaccines',      count: pendingVaccines.length },
  ]

  // ── Left panel ────────────────────────────────────────────────────────────

  function ListItem({ label, sub, status, isSelected, onClick }: {
    label: string; sub: string; status: string; isSelected: boolean; onClick: () => void
  }) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{sub}</p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CHIP[status]}`}>
            {status}
          </span>
        </div>
      </button>
    )
  }

  const currentList = subTab === 'clinics'       ? clinics
                    : subTab === 'practitioners' ? practitioners
                    :                              vaccines

  const leftPanel = (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setSubTab(t.key); clearSelection() }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              subTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">All clear</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">No submissions to review</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {subTab === 'clinics' && clinics.map(item => (
            <ListItem
              key={item.id}
              label={item.name}
              sub={`${item.city}, ${item.country} · ${item.submittedByEmail}`}
              status={item.status}
              isSelected={selectedClinic?.id === item.id}
              onClick={() => { clearSelection(); setSelectedClinic(item) }}
            />
          ))}
          {subTab === 'practitioners' && practitioners.map(item => (
            <ListItem
              key={item.id}
              label={item.name}
              sub={`${item.clinicName} · ${item.submittedByEmail}`}
              status={item.status}
              isSelected={selectedPractitioner?.id === item.id}
              onClick={() => { clearSelection(); setSelectedPractitioner(item) }}
            />
          ))}
          {subTab === 'vaccines' && vaccines.map(item => (
            <ListItem
              key={item.id}
              label={item.name}
              sub={`${VACCINE_CATEGORY_LABELS[item.category]} · ${item.submittedByEmail}`}
              status={item.status}
              isSelected={selectedVaccine?.id === item.id}
              onClick={() => { clearSelection(); setSelectedVaccine(item) }}
            />
          ))}
        </div>
      )}
    </div>
  )

  // ── Right panel ───────────────────────────────────────────────────────────

  const noSelection = !selectedClinic && !selectedPractitioner && !selectedVaccine

  const rightPanel = noSelection ? (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm text-gray-400 dark:text-gray-500">Select a submission to review</p>
    </div>
  ) : (
    <div className="h-full overflow-y-auto p-5 lg:p-6">
      {/* Back breadcrumb (mobile) */}
      <button onClick={clearSelection} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to list
      </button>

      {/* ── Clinic detail ── */}
      {selectedClinic && (() => {
        const item = selectedClinic
        const upd = (k: string, v: string) => setEditFields(p => ({ ...p, [k]: v }))
        return (
          <>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editMode ? (editFields.name || item.name) : item.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Submitted by {item.submittedByEmail} · {formatDate(item.submittedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === 'pending' && !editMode && (
                  <button
                    onClick={startEditing}
                    title="Edit before approving"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {editMode && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel edit
                  </button>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_CHIP[item.status]}`}>{item.status}</span>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-3 mb-6 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">✏️ Editing — changes will apply when you approve</p>
                <EditField label="Name"    value={editFields.name    ?? ''} onChange={v => upd('name', v)} />
                <EditField label="Phone"   value={editFields.phone   ?? ''} onChange={v => upd('phone', v)} />
                <EditField label="Address" value={editFields.address ?? ''} onChange={v => upd('address', v)} />
                <EditField label="City"    value={editFields.city    ?? ''} onChange={v => upd('city', v)} />
                <EditField label="Country" value={editFields.country ?? ''} onChange={v => upd('country', v)} />
                <EditField label="Website" value={editFields.website ?? ''} onChange={v => upd('website', v)} />
                <EditField label="Notes"   value={editFields.notes   ?? ''} onChange={v => upd('notes', v)} multiline />
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <DetailRow label="Phone"   value={item.phone} />
                <DetailRow label="Address" value={item.address} />
                <DetailRow label="City"    value={item.city} />
                <DetailRow label="Country" value={item.country} />
                <DetailRow label="Website" value={item.website} />
                <DetailRow label="Notes"   value={item.notes} />
                {item.rejectionReason && <DetailRow label="Rejection reason" value={item.rejectionReason} />}
              </div>
            )}

            {item.status === 'pending' && (
              <ActionButtons
                onApprove={() => approveClinic(item)}
                onReject={() => setShowRejectForm(true)}
                actioning={actioning}
                showRejectForm={showRejectForm}
                rejectReason={rejectReason}
                setRejectReason={setRejectReason}
                onConfirmReject={handleReject}
                onCancelReject={() => { setShowRejectForm(false); setRejectReason('') }}
              />
            )}
          </>
        )
      })()}

      {/* ── Practitioner detail ── */}
      {selectedPractitioner && (() => {
        const item = selectedPractitioner
        const upd = (k: string, v: string) => setEditFields(p => ({ ...p, [k]: v }))
        return (
          <>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editMode ? (editFields.name || item.name) : item.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Submitted by {item.submittedByEmail} · {formatDate(item.submittedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === 'pending' && !editMode && (
                  <button
                    onClick={startEditing}
                    title="Edit before approving"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {editMode && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel edit
                  </button>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_CHIP[item.status]}`}>{item.status}</span>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-3 mb-6 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">✏️ Editing — changes will apply when you approve</p>
                <EditField label="Name"             value={editFields.name       ?? ''} onChange={v => upd('name', v)} />
                <EditField label="Clinic / Practice" value={editFields.clinicName ?? ''} onChange={v => upd('clinicName', v)} />
                <EditField label="Phone"            value={editFields.phone      ?? ''} onChange={v => upd('phone', v)} />
                <EditField label="Email"            value={editFields.email      ?? ''} onChange={v => upd('email', v)} type="email" />
                <EditField label="Speciality"       value={editFields.speciality ?? ''} onChange={v => upd('speciality', v)} />
                <EditField label="Notes"            value={editFields.notes      ?? ''} onChange={v => upd('notes', v)} multiline />
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <DetailRow label="Clinic / Practice" value={item.clinicName} />
                <DetailRow label="Phone"             value={item.phone} />
                <DetailRow label="Email"             value={item.email} />
                <DetailRow label="Speciality"        value={item.speciality} />
                <DetailRow label="Notes"             value={item.notes} />
                {item.rejectionReason && <DetailRow label="Rejection reason" value={item.rejectionReason} />}
              </div>
            )}

            {item.status === 'pending' && (
              <ActionButtons
                onApprove={() => approvePractitioner(item)}
                onReject={() => setShowRejectForm(true)}
                actioning={actioning}
                showRejectForm={showRejectForm}
                rejectReason={rejectReason}
                setRejectReason={setRejectReason}
                onConfirmReject={handleReject}
                onCancelReject={() => { setShowRejectForm(false); setRejectReason('') }}
              />
            )}
          </>
        )
      })()}

      {/* ── Vaccine detail ── */}
      {selectedVaccine && (() => {
        const item = selectedVaccine
        const upd = (k: string, v: string) => setEditFields(p => ({ ...p, [k]: v }))
        return (
          <>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editMode ? (editFields.name || item.name) : item.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Submitted by {item.submittedByEmail} · {formatDate(item.submittedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === 'pending' && !editMode && (
                  <button
                    onClick={startEditing}
                    title="Edit before approving"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {editMode && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel edit
                  </button>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_CHIP[item.status]}`}>{item.status}</span>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-3 mb-6 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">✏️ Editing — changes will apply when you approve</p>
                <EditField label="Vaccine Name"    value={editFields.name          ?? ''} onChange={v => upd('name', v)} />
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Category</label>
                  <select
                    value={editFields.category ?? item.category}
                    onChange={e => upd('category', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(VACCINE_CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <EditField label="Disease Target" value={editFields.diseaseTarget  ?? ''} onChange={v => upd('diseaseTarget', v)} />
                <EditField label="Manufacturer"   value={editFields.manufacturer   ?? ''} onChange={v => upd('manufacturer', v)} />
                <EditField label="Reference URL"  value={editFields.referenceUrl   ?? ''} onChange={v => upd('referenceUrl', v)} />
                <EditField label="Notes"          value={editFields.notes          ?? ''} onChange={v => upd('notes', v)} multiline />
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <DetailRow label="Category"       value={VACCINE_CATEGORY_LABELS[item.category]} />
                <DetailRow label="Disease Target" value={item.diseaseTarget} />
                <DetailRow label="Manufacturer"   value={item.manufacturer} />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reference URL</p>
                  <a
                    href={item.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all mt-0.5 block"
                  >
                    {item.referenceUrl}
                  </a>
                </div>
                <DetailRow label="Notes" value={item.notes} />
                {item.rejectionReason && <DetailRow label="Rejection reason" value={item.rejectionReason} />}
              </div>
            )}

            {item.status === 'pending' && (
              <>
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2 mb-4">
                  Approving will add a basic library entry and automatically add this vaccine to the user's records. Use the Library tab to fill in the full details after approval.
                </p>
                <ActionButtons
                  onApprove={() => approveVaccine(item)}
                  onReject={() => setShowRejectForm(true)}
                  actioning={actioning}
                  showRejectForm={showRejectForm}
                  rejectReason={rejectReason}
                  setRejectReason={setRejectReason}
                  onConfirmReject={handleReject}
                  onCancelReject={() => { setShowRejectForm(false); setRejectReason('') }}
                />
              </>
            )}
          </>
        )
      })()}
    </div>
  )

  // ── Desktop layout ────────────────────────────────────────────────────────

  return (
    <ResizableSplitPane
      storageKey="splitPane:adminPending"
      leftClassName="flex flex-col overflow-hidden bg-white dark:bg-gray-800/50"
      rightClassName="bg-gray-50 dark:bg-gray-900"
      left={leftPanel}
      right={rightPanel}
    />
  )
}

// ── Shared approve / reject UI ───────────────────────────────────────────────

function ActionButtons({
  onApprove, onReject, actioning,
  showRejectForm, rejectReason, setRejectReason,
  onConfirmReject, onCancelReject,
}: {
  onApprove: () => void
  onReject: () => void
  actioning: boolean
  showRejectForm: boolean
  rejectReason: string
  setRejectReason: (v: string) => void
  onConfirmReject: () => void
  onCancelReject: () => void
}) {
  if (showRejectForm) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            placeholder="Explain why this request is being rejected…"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancelReject} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Cancel
          </button>
          <button
            onClick={onConfirmReject}
            disabled={actioning || !rejectReason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {actioning ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={onReject}
        disabled={actioning}
        className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
      >
        Reject
      </button>
      <button
        onClick={onApprove}
        disabled={actioning}
        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {actioning ? 'Approving…' : 'Approve'}
      </button>
    </div>
  )
}
